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

/* ─────────── 본문 글 서식 ───────────

   DB 에는 글 그대로 둔다 — 그릴 때 아래 표시만 서식으로 바꾼다.
   어드민이 글자를 드래그하고 버튼을 눌러 감싼다(popup-form.tsx).
     **굵게**
     __밑줄__
     {{red:글자색}}                     색 이름은 POPUP_COLORS 의 키
     [보일 글자](주소)                   링크
   서로 겹쳐 쓸 수 있다({{red:**굵은 빨강**}}). 한 줄 안에서만 감싼다.
   링크는 http(s) 와 사이트 안 경로(/…)만 받는다 — javascript: 같은 주소가
   어드민 실수로 들어가도 링크가 되지 않게. '//' 로 시작하면 다른 사이트라 뺀다.
   글 속의 맨 주소는 링크로 바꾸지 않는다 — 걸고 싶은 곳에만 직접 건다. */

/* 흰 팝업 바탕에서 읽히는 진하기로 고른 색 — 키가 본문에 그대로 남으므로 바꾸지 않는다 */
export const POPUP_COLORS = {
  red: { label: '빨강', hex: '#dc2626' },
  orange: { label: '주황', hex: '#ea580c' },
  green: { label: '초록', hex: '#16a34a' },
  blue: { label: '파랑', hex: '#2563eb' },
  violet: { label: '보라', hex: '#7c3aed' },
  gray: { label: '회색', hex: '#737373' },
} as const
export type PopupColor = keyof typeof POPUP_COLORS

export type RichNode =
  | string
  | { kind: 'b'; children: RichNode[] }
  | { kind: 'u'; children: RichNode[] }
  | { kind: 'color'; color: PopupColor; children: RichNode[] }
  | { kind: 'link'; href: string; children: RichNode[] }

const COLOR_KEYS = Object.keys(POPUP_COLORS).join('|')
const RICH_RE = new RegExp(
  [
    String.raw`\*\*([^\n]+?)\*\*`,
    String.raw`__([^\n]+?)__`,
    String.raw`\{\{(${COLOR_KEYS}):([^\n]+?)\}\}`,
    String.raw`\[([^\]\n]+)\]\(((?:https?:\/\/|\/(?!\/))[^\s)]*)\)`,
  ].join('|'),
  'g',
)

export function richParts(text: string): RichNode[] {
  const out: RichNode[] = []
  let last = 0
  for (const m of text.matchAll(RICH_RE)) {
    const at = m.index ?? 0
    if (at > last) out.push(text.slice(last, at))
    if (m[1] != null) out.push({ kind: 'b', children: richParts(m[1]) })
    else if (m[2] != null) out.push({ kind: 'u', children: richParts(m[2]) })
    else if (m[3] != null) out.push({ kind: 'color', color: m[3] as PopupColor, children: richParts(m[4]) })
    else out.push({ kind: 'link', href: m[6], children: richParts(m[5]) })
    last = at + m[0].length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

/* 다른 사이트로 가는 링크는 새 탭에서 연다 — 팝업을 보던 화면은 그대로 둔다 */
export function isExternal(href: string) {
  return /^https?:\/\//.test(href)
}

/* 본문이 비었는지 —글이 있거나 이미지가 하나라도 있으면 찬 것이다 */
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
