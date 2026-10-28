/* 초대코드의 모양과 규칙(024_designer_invites.sql).

   어드민 화면·가입 화면(클라이언트)과 서버 액션이 함께 쓴다.
   server-only 모듈에 두지 않는다. */

/* DB enum 과 같은 값을 쓴다 — 한쪽만 늘리면 저장이 거부된다 */
export const INVITE_STATUSES = ['active', 'verified', 'used', 'expired', 'canceled'] as const
export type InviteStatus = (typeof INVITE_STATUSES)[number]

export const INVITE_STATUS_LABELS: Record<InviteStatus, string> = {
  active: '사용 가능',
  verified: '인증함',
  used: '사용됨',
  expired: '만료',
  canceled: '취소',
}

/* 아직 가입에 쓸 수 있는 상태 — 인증함도 가입 전이라 계속 쓸 수 있다(026) */
export const OPEN_STATUSES: InviteStatus[] = ['active', 'verified']

export function isOpen(status: InviteStatus) {
  return OPEN_STATUSES.includes(status)
}

/* 한 브라우저에서 초대코드를 이만큼 틀리면 더 시도하지 못한다 */
export const MAX_INVITE_FAILS = 5

export const MAX_INVITE_DAYS = 14
export const DEFAULT_INVITE_DAYS = 7
export const MAX_INVITE_MEMO = 100

export type InviteRow = {
  id: string
  created_at: string
  code: string
  memo: string | null
  expires_at: string
  status: InviteStatus
  status_at: string | null
  /* 026 전이면 없다 */
  verified_at?: string | null
  used_at: string | null
  used_by: string | null
  used_email: string | null
}

/* 어드민 목록으로 내려보내는 모양 — 가입한 디자이너의 지금 이름을 붙인다 */
export type InviteWithUser = InviteRow & { used_name: string | null }

/* 코드 길이 — DB 제약(025_invite_code_custom.sql)과 같은 값.
   자동 발행은 8자리, 어드민이 직접 적으면 4~15자. */
export const CODE_MIN = 4
export const CODE_MAX = 15

/* 입력값 정리 — 대소문자·공백·하이픈이 섞여 와도 같은 코드로 본다.
   언더바는 코드의 일부라 지우지 않는다(SOOM_2026). */
export function normalizeCode(raw: string) {
  return raw.toUpperCase().replace(/[^A-Z0-9_]/g, '')
}

/* 어드민이 직접 적는 코드 — 영문 대문자·숫자·언더바만. 소문자는 받지 않고 알린다:
   조용히 대문자로 바꾸면 적은 것과 다른 코드가 발행된다. */
export function customCodeError(raw: string): string | null {
  const v = raw.trim()
  if (!v) return null
  if (!/^[A-Z0-9_]+$/.test(v)) return '코드는 영문 대문자, 숫자, 언더바(_)만 쓸 수 있습니다.'
  if (v.length < CODE_MIN || v.length > CODE_MAX) return `코드는 ${CODE_MIN}~${CODE_MAX}자로 적어 주세요.`
  return null
}

/* ─────────── 만료일 ───────────

   어드민은 날짜만 고른다. 그날 한국 시간 자정까지(=다음 날 00:00 직전) 쓸 수 있다. */

const KST = 9 * 60 * 60 * 1000
const DAY = 24 * 60 * 60 * 1000

/* 한국 시간 기준 오늘부터 n일 뒤의 YYYY-MM-DD */
export function kstDateAfter(days: number, now = Date.now()) {
  return new Date(now + KST + days * DAY).toISOString().slice(0, 10)
}

/* YYYY-MM-DD(한국 날짜) → 그날이 끝나는 시각(다음 날 00:00 KST)의 ISO */
export function endOfKstDate(date: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
  const t = Date.parse(`${date}T00:00:00+09:00`)
  return Number.isNaN(t) ? null : new Date(t + DAY).toISOString()
}

/* 만료 시각을 "그날"로 되돌려 보여 준다 — 2026. 11. 04.까지 */
const fmtDay = new Intl.DateTimeFormat('ko-KR', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  timeZone: 'Asia/Seoul',
})

export function expiresText(iso: string) {
  return `${fmtDay.format(new Date(Date.parse(iso) - 1))}까지`
}

/* ─────────── 가입 입력 ─────────── */

export const PASSWORD_MIN = 8
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
export const VERIFY_CODE_LEN = 6
