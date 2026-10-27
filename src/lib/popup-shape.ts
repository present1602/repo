/* 팝업 한 건의 모양과 규칙(023_popups.sql).

   어드민 폼(클라이언트)·서버 액션·공개 화면이 함께 쓴다 — 허용 형식이나
   크기가 양쪽에서 어긋나면 화면은 통과시켰는데 서버가 거부한다.
   server-only 모듈에 두지 않는다. */

/* 공개 버킷 — 폼이 서명 주소로 바로 올릴 때도 이름을 알아야 한다 */
export const POPUP_FILES_BUCKET = 'popup-files'

/* DB enum 과 같은 값을 쓴다 — 한쪽만 늘리면 저장이 거부된다 */
export const POPUP_STATUSES = ['visible', 'hidden', 'expired'] as const
export type PopupStatus = (typeof POPUP_STATUSES)[number]

export function isPopupStatus(v: string): v is PopupStatus {
  return (POPUP_STATUSES as readonly string[]).includes(v)
}

export const STATUS_LABELS: Record<PopupStatus, string> = {
  visible: '노출',
  hidden: '숨김',
  expired: '만료',
}

/* 본문 블록 — 위에서부터 차례로 그린다. 이미지는 경로만 남기고
   주소는 그릴 때 만든다(publicUrl). 버킷 주소가 바뀌어도 데이터는 그대로다. */
export type PopupBlock = { type: 'text'; text: string } | { type: 'image'; path: string }

export type PopupFile = { name: string; path: string; size: number }

export type PopupRow = {
  id: string
  created_at: string
  updated_at: string
  title: string | null
  body: PopupBlock[]
  files: PopupFile[]
  starts_at: string | null
  ends_at: string | null
  status: PopupStatus
  status_at: string | null
}

/* 공개 화면으로 내보내는 모양 — 상태·시각 같은 관리용 값은 뺀다 */
export type PublicPopup = Pick<PopupRow, 'id' | 'title' | 'body' | 'files'>

export const MAX_TITLE = 100
export const MAX_TEXT_BLOCK = 5000
export const MAX_BLOCKS = 30
export const MAX_FILES = 10

/* 버킷의 file_size_limit 와 같은 값 — 실제로 막는 것은 버킷이다 */
export const MAX_POPUP_FILE_BYTES = 20 * 1024 * 1024

export const POPUP_IMAGE_EXT = ['png', 'jpg', 'jpeg', 'webp', 'gif']

/* 방문자가 내려받는 파일이다 — 실행 파일은 받지 않는다 */
export const POPUP_FILE_EXT = [
  'pdf', 'doc', 'docx', 'hwp', 'hwpx', 'txt',
  'ppt', 'pptx', 'xls', 'xlsx', 'csv', 'zip',
  ...POPUP_IMAGE_EXT,
]

export const POPUP_IMAGE_ACCEPT = POPUP_IMAGE_EXT.map((e) => `.${e}`).join(',')
export const POPUP_FILE_ACCEPT = POPUP_FILE_EXT.map((e) => `.${e}`).join(',')

export type UploadKind = 'image' | 'file'

export function fileExt(name: string) {
  return name.split('.').pop()?.toLowerCase() ?? ''
}

/* 공개 버킷 주소. download 를 주면 원래 파일명으로 내려받게 한다 —
   저장 경로는 uuid 라 그대로 받으면 이름을 알아볼 수 없다. */
export function publicUrl(path: string, download?: string) {
  const base = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${POPUP_FILES_BUCKET}/${path}`
  return download ? `${base}?download=${encodeURIComponent(download)}` : base
}

/* 본문이 비었는지 — 글이 있거나 이미지가 하나라도 있으면 찬 것이다 */
export function hasBody(body: PopupBlock[]) {
  return body.some((b) => (b.type === 'image' ? Boolean(b.path) : b.text.trim().length > 0))
}

/* 지금 게시 기간 안인지. 비운 쪽 끝은 열린 것으로 본다. */
export function inPeriod(p: Pick<PopupRow, 'starts_at' | 'ends_at'>, now = Date.now()) {
  if (p.starts_at && Date.parse(p.starts_at) > now) return false
  if (p.ends_at && Date.parse(p.ends_at) <= now) return false
  return true
}

/* ─────────── datetime-local ↔ ISO ───────────

   입력칸은 시간대 없이 "2026-10-27T09:00" 을 주고받는다. 서버(UTC)와
   브라우저가 각자 해석하면 9시간이 어긋나므로 한국 시간으로 못 박는다. */

const KST_OFFSET = 9 * 60 * 60 * 1000

export function isoToLocalInput(iso: string | null): string {
  if (!iso) return ''
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return ''
  return new Date(t + KST_OFFSET).toISOString().slice(0, 16)
}

export function localInputToIso(v: string): string | null {
  if (!v) return null
  const t = Date.parse(`${v}:00+09:00`)
  return Number.isNaN(t) ? null : new Date(t).toISOString()
}

/* 목록에 쓰는 기간 표기 — 2026. 10. 27. 09:00 */
const fmt = new Intl.DateTimeFormat('ko-KR', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'Asia/Seoul',
})

export function periodText(p: Pick<PopupRow, 'starts_at' | 'ends_at'>) {
  if (!p.starts_at && !p.ends_at) return '상시'
  const a = p.starts_at ? fmt.format(new Date(p.starts_at)) : '즉시'
  const b = p.ends_at ? fmt.format(new Date(p.ends_at)) : '종료 없음'
  return `${a} ~ ${b}`
}
