import { NextResponse, type NextRequest } from 'next/server'
import { confirmPayment } from '@/lib/payment-links-db'

/* 페이업 결제창 인증이 끝나면 오는 곳 — /api/payup/return?t={결제 링크 토큰}

   PC: SDK 가 payupPaymentSubmit(form) 을 부르면 결제 페이지가 폼을 이 주소로 보낸다.
       폼에는 결제창을 열 때 넣은 값 + transactionId 가 들어 있다.
   모바일: 결제창 화면이 returnUrl(이 주소)로 transactionId·orderNumber·amount 를 넘긴다.
       페이업 문서는 형식을 밝히지 않아 폼·JSON·쿼리 모두 읽는다.

   여기서 승인까지 마치고 결제 페이지로 돌려보낸다. 결과 화면은 결제 페이지가
   DB 상태를 보고 그린다 — 실패면 ?error= 로 까닭을 실어 보낸다.
   다른 도메인(페이업)에서 오는 요청이라 서버 액션이 아니라 라우트로 받는다. */

async function readParams(req: NextRequest): Promise<Record<string, string>> {
  const out: Record<string, string> = {}
  req.nextUrl.searchParams.forEach((v, k) => (out[k] = v))
  if (req.method !== 'POST') return out
  const type = req.headers.get('content-type') ?? ''
  try {
    if (type.includes('application/json')) {
      const json = (await req.json()) as Record<string, unknown>
      for (const [k, v] of Object.entries(json ?? {})) if (v != null) out[k] = String(v)
    } else {
      const form = await req.formData()
      form.forEach((v, k) => {
        if (typeof v === 'string') out[k] = v
      })
    }
  } catch (err) {
    console.error('[payup/return] 본문을 읽지 못함:', type, err)
  }
  return out
}

async function handle(req: NextRequest) {
  const p = await readParams(req)
  const token = p.t ?? ''
  if (!token) return NextResponse.redirect(new URL('/', req.url), 303)

  const back = new URL(`/pay/${encodeURIComponent(token)}`, req.url)

  /* 결제창을 닫았거나 카드사가 거절하면 거래번호 없이 돌아온다 */
  if (!p.transactionId) {
    back.searchParams.set('error', p.message || p.resultMsg || '결제가 완료되지 않았습니다.')
    return NextResponse.redirect(back, 303)
  }

  const r = await confirmPayment({
    token,
    transactionId: p.transactionId,
    orderNumber: p.orderNumber ?? '',
    amount: p.amount ?? null,
  })
  if (!r.ok) back.searchParams.set('error', r.error)
  /* POST 뒤 GET 으로 — 새로고침해도 폼이 다시 가지 않게 303 */
  return NextResponse.redirect(back, 303)
}

export const POST = handle
export const GET = handle
