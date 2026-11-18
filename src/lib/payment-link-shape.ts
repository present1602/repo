/* 결제 링크(0031_payment_links.sql) — 화면과 서버가 같이 쓰는 모양·검사.
   클라이언트 컴포넌트가 불러 쓰므로 server-only 를 두지 않는다. */

export const MIN_AMOUNT = 100
export const MAX_AMOUNT = 100_000_000
export const MAX_TITLE = 60
export const MAX_DESCRIPTION = 2000

export const EXPIRE_OPTIONS = [
  { days: 3, label: '3일' },
  { days: 7, label: '7일' },
  { days: 14, label: '14일' },
  { days: 30, label: '30일' },
] as const
export const DEFAULT_EXPIRE_DAYS = 7

export type PaymentStatus = 'pending' | 'paid' | 'cancelled' | 'void'

export type PaymentLinkRow = {
  id: string
  created_at: string
  token: string
  order_no: string
  title: string
  description: string | null
  amount: number
  customer_name: string | null
  customer_email: string | null
  customer_tel: string | null
  status: PaymentStatus
  expires_at: string
  buyer_name: string | null
  buyer_email: string | null
  buyer_tel: string | null
  order_number: string | null
  transaction_id: string | null
  auth_number: string | null
  card_name: string | null
  card_no: string | null
  quota: string | null
  paid_at: string | null
  cancelled_at: string | null
  last_error: string | null
  link_mailed_at: string | null
  paid_mailed_at: string | null
  mail_error: string | null
  created_by: string | null
}

/* 만료는 저장된 상태가 아니라 '대기 + 기한 지남' 이다 */
export type BadgeStatus = PaymentStatus | 'expired'

export const STATUS_LABELS: Record<BadgeStatus, string> = {
  pending: '결제 대기',
  expired: '기한 만료',
  paid: '결제 완료',
  cancelled: '환불됨',
  void: '링크 취소',
}

export function isExpired(r: Pick<PaymentLinkRow, 'status' | 'expires_at'>, now = Date.now()) {
  return r.status === 'pending' && Date.parse(r.expires_at) <= now
}

export const won = (n: number) => `${n.toLocaleString('ko-KR')}원`

export const MISSING_TABLE_MSG = '결제 링크 표가 없습니다. 0031_payment_links.sql 을 실행해 주세요.'

export type LinkInput = {
  title: string
  amount: number
  description: string
  customerName: string
  customerEmail: string
  customerTel: string
  expiresInDays: number
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/* 칸 이름 → 까닭. 비어 있으면 통과. 화면은 이것으로 저장 버튼을 막고, 서버는 다시 확인한다 */
export function checkLinkInput(v: LinkInput): Partial<Record<keyof LinkInput, string>> {
  const bad: Partial<Record<keyof LinkInput, string>> = {}
  const title = v.title.trim()
  if (!title) bad.title = '상품명을 적어 주세요.'
  else if (title.length > MAX_TITLE) bad.title = `${MAX_TITLE}자 이내로 적어 주세요. (지금 ${title.length}자)`

  if (!Number.isInteger(v.amount) || v.amount < MIN_AMOUNT || v.amount > MAX_AMOUNT) {
    bad.amount = `${won(MIN_AMOUNT)} ~ ${won(MAX_AMOUNT)} 사이로 적어 주세요.`
  }

  if (v.description.trim().length > MAX_DESCRIPTION) bad.description = `${MAX_DESCRIPTION}자 이내로 적어 주세요.`
  if (v.customerName.trim().length > 50) bad.customerName = '50자 이내로 적어 주세요.'
  if (v.customerEmail.trim() && !EMAIL_RE.test(v.customerEmail.trim())) bad.customerEmail = '이메일 형식이 아닙니다.'
  if (v.customerTel.trim() && !isTel(v.customerTel)) bad.customerTel = '숫자 9~11자리로 적어 주세요.'
  if (!EXPIRE_OPTIONS.some((o) => o.days === v.expiresInDays)) bad.expiresInDays = '유효기간을 골라 주세요.'
  return bad
}

export function isTel(s: string) {
  return /^\d{9,11}$/.test(s.replace(/[\s-]/g, ''))
}

export type BuyerInput = { name: string; email: string; tel: string }

/* 결제 페이지에서 고객이 적는 칸 — 이름은 페이업 필수, 이메일은 결제 완료 메일을 받을 곳 */
export function checkBuyer(v: BuyerInput): Partial<Record<keyof BuyerInput, string>> {
  const bad: Partial<Record<keyof BuyerInput, string>> = {}
  const name = v.name.trim()
  if (!name) bad.name = '이름(회사명)을 적어 주세요.'
  else if (name.length > 50) bad.name = '50자 이내로 적어 주세요.'
  if (!EMAIL_RE.test(v.email.trim())) bad.email = '결제 확인 메일을 받을 이메일을 적어 주세요.'
  if (v.tel.trim() && !isTel(v.tel)) bad.tel = '숫자 9~11자리로 적어 주세요.'
  return bad
}
