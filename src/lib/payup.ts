import 'server-only'

/* 페이업 표준결제 연동 — https://developers.payup.co.kr

   흐름:
   1) 결제 페이지가 페이업 SDK 의 goPayupPay() 로 결제창을 띄운다.
   2) 고객이 카드 인증을 마치면 페이업이 거래번호(transactionId)를 우리 쪽으로 넘긴다.
      PC 는 SDK 가 payupPaymentSubmit() 를 불러 우리가 정한 주소로 폼을 보내고,
      모바일은 결제창 화면이 returnUrl 로 되돌아온다. 둘 다 /api/payup/return 이 받는다.
   3) 서버가 거래번호·주문번호·금액으로 승인 API 를 불러야 결제가 끝난다.
      승인하지 않으면 돈이 나가지 않는다 — 그래서 웹훅 없이도 결제 완료 시점을 정확히 안다.

   주의: 페이업은 실패도 HTTP 200 + status "SUCCESS" 로 돌려줄 때가 있다
   (예: messageCode 9040 "주문 정보가 없습니다"). 반드시 messageCode 와
   data.responseCode 가 모두 "0000" 인지 본다. */

const HOSTS = {
  test: 'https://standard.testpayup.co.kr',
  live: 'https://standard.payup.co.kr',
} as const

const SDKS = {
  test: 'https://standard.testpayup.co.kr/assets/js/payup_standard_dev-1.0.js',
  live: 'https://standard.payup.co.kr/assets/js/payup_standard-1.0.js',
} as const

type Mode = keyof typeof HOSTS

/* 함수로 읽는다 — 상수로 두면 빌드 때 값이 번들에 박혀, 배포 뒤 넣은 환경변수가 안 먹는다 */
function mode(): Mode {
  return process.env.PAYUP_MODE?.trim() === 'live' ? 'live' : 'test'
}

export function payupMode(): Mode {
  return mode()
}

export function payupSdkUrl(): string {
  return SDKS[mode()]
}

export function merchantId(): string {
  return process.env.PAYUP_MERCHANT_ID?.trim() ?? ''
}

/* 비어 있는 환경변수 이름 — 값은 로그에 남기지 않는다 */
export function missingPayupEnv(): string[] {
  return (['PAYUP_MERCHANT_ID', 'PAYUP_API_KEY'] as const).filter((k) => !process.env[k]?.trim())
}

type Envelope<T> = {
  status?: string
  messageCode?: string
  message?: string
  data?: T | null
}

class PayupError extends Error {
  constructor(
    message: string,
    readonly code?: string,
  ) {
    super(message)
  }
}

async function post<T>(path: string, body: unknown, token?: string): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${HOSTS[mode()]}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        /* 토큰 앞에 "Bearer-" 가 이미 붙어 온다 — 그대로 넣는다 */
        ...(token ? { Authorization: token } : {}),
      },
      body: JSON.stringify(body),
      cache: 'no-store',
      signal: AbortSignal.timeout(20_000),
    })
  } catch (err) {
    console.error('[payup] 요청 실패:', path, err)
    throw new PayupError('결제사 서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.')
  }

  const json = (await res.json().catch(() => null)) as Envelope<T> | null
  if (!res.ok || !json || json.status !== 'SUCCESS' || json.messageCode !== '0000' || !json.data) {
    console.error('[payup] 응답 실패:', path, res.status, json?.messageCode, json?.message)
    throw new PayupError(json?.message || `결제사 요청에 실패했습니다. (HTTP ${res.status})`, json?.messageCode)
  }
  return json.data
}

/* 인증 토큰 — 유효기간이 1시간이지만 승인·취소는 드문 호출이라 매번 새로 받는다 */
async function accessToken(): Promise<string> {
  const missing = missingPayupEnv()
  if (missing.length > 0) throw new PayupError(`페이업 설정이 비어 있습니다: ${missing.join(', ')}`)
  const data = await post<{ accessToken?: string }>('/auth/v1/accessToken', {
    merchantId: merchantId(),
    apiKey: process.env.PAYUP_API_KEY!.trim(),
  })
  if (!data.accessToken) throw new PayupError('페이업 인증 토큰을 받지 못했습니다.')
  return data.accessToken
}

export type Approval = {
  transactionId: string
  orderNumber: string
  amount: number
  authNumber: string | null
  authDatetime: string | null
  cardName: string | null
  cardNo: string | null
  quota: string | null
}

type ApprovalData = {
  responseCode?: string
  responseMsg?: string
  transactionId?: string
  orderNumber?: string
  authDatetime?: string
  authNumber?: string
  amount?: string
  cardName?: string
  issueCompanyName?: string
  cardNo?: string
  quota?: string
}

/* 결제 승인 — 금액·주문번호는 반드시 DB 값으로 넘긴다 */
export async function approvePayment(input: {
  transactionId: string
  orderNumber: string
  amount: number
}): Promise<Approval> {
  const token = await accessToken()
  const d = await post<ApprovalData>(
    '/api/v1/payment',
    {
      transactionId: input.transactionId,
      merchantId: merchantId(),
      orderNumber: input.orderNumber,
      amount: String(input.amount),
    },
    token,
  )
  if (d.responseCode !== '0000') {
    throw new PayupError(d.responseMsg || '결제 승인이 거절되었습니다.', d.responseCode)
  }
  return {
    transactionId: d.transactionId || input.transactionId,
    orderNumber: d.orderNumber || input.orderNumber,
    amount: Number(d.amount ?? input.amount),
    authNumber: d.authNumber ?? null,
    authDatetime: d.authDatetime ?? null,
    cardName: d.cardName || d.issueCompanyName || null,
    cardNo: d.cardNo ?? null,
    quota: d.quota ?? null,
  }
}

/* 전액 취소 */
export async function cancelPayment(transactionId: string, reason: string): Promise<void> {
  const token = await accessToken()
  const d = await post<{ responseCode?: string; responseMsg?: string }>(
    '/api/v1/cancel',
    { transactionId, cancelReason: reason.slice(0, 250) },
    token,
  )
  if (d.responseCode !== '0000') {
    throw new PayupError(d.responseMsg || '결제 취소가 거절되었습니다.', d.responseCode)
  }
}

/* YYYYMMDDHHmmss(한국 시각) → ISO */
export function kstStampToIso(stamp: string | null): string | null {
  const m = stamp?.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/)
  if (!m) return null
  const t = Date.parse(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}+09:00`)
  return Number.isNaN(t) ? null : new Date(t).toISOString()
}
