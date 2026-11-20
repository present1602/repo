/* 비공개 디자이너 경력 페이지(0032_designer_roster.sql) — 화면과 서버가 같이 쓰는 모양·검사.
   클라이언트 컴포넌트가 불러 쓰므로 server-only 를 두지 않는다. */

export const MAX_NAME = 30
export const MAX_CAREER = 5000
export const MAX_MEMO = 100

/* 유효기간 1~7일, 기본 1일(24시간) */
export const EXPIRE_DAYS = [1, 2, 3, 4, 5, 6, 7] as const
export const DEFAULT_EXPIRE_DAYS = 1

export const MISSING_TABLE_MSG = '경력 페이지 표가 없습니다. 0032_designer_roster.sql 을 실행해 주세요.'

export type RosterDesignerRow = {
  id: string
  created_at: string
  name: string
  career: string
  avatar_url: string | null
  designer_id: string | null
  sort_order: number
}

export type RosterLinkRow = {
  id: string
  created_at: string
  token: string
  memo: string | null
  expires_at: string
  revoked_at: string | null
  open_count: number
  last_opened_at: string | null
  created_by: string | null
  /* 이 링크로 보여 줄 디자이너(0034). null·없음 = 전원 — 0034 이전 링크이거나 칸이 아직 없는 DB */
  designer_ids?: string[] | null
}

/* 디자이너별 포트폴리오 파일(0035_roster_files.sql) */
export const ROSTER_FILES_BUCKET = 'roster-files'
export const MAX_FILE_BYTES = 50 * 1024 * 1024
export const MAX_FILES_PER_DESIGNER = 10
/* 링크 페이지에서는 내려받지 않고 미리보기로만 본다 — 브라우저 안에서 그릴 수 있는 형식만 받는다.
   PPT·한글·키노트는 PDF 로 내보내 올린다. 영상은 어느 브라우저에서나 재생되는 MP4 만. */
export const FILE_EXT = ['pdf', 'png', 'jpg', 'jpeg', 'webp', 'gif', 'mp4'] as const

export type PreviewKind = 'pdf' | 'image' | 'video'

export function previewKind(name: string): PreviewKind | null {
  const ext = fileExt(name)
  if (ext === 'pdf') return 'pdf'
  if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext)) return 'image'
  if (ext === 'mp4') return 'video'
  return null
}
export const FILE_ACCEPT = FILE_EXT.map((e) => `.${e}`).join(',')
export const MISSING_FILES_MSG = '포트폴리오 파일 표가 없습니다. 0035_roster_files.sql 을 실행해 주세요.'

export type RosterFileRow = {
  id: string
  designer_id: string
  path: string
  name: string
  size: number
  sort_order: number
}

export function fileExt(name: string) {
  const m = /\.([A-Za-z0-9]{1,8})$/.exec(name)
  return m ? m[1]!.toLowerCase() : ''
}

/* 올리기 전에 화면에서 거르고, 서버가 다시 확인한다. 비어 있으면 통과 */
export function checkFile(name: string, size: number): string | null {
  if (!(FILE_EXT as readonly string[]).includes(fileExt(name))) {
    return `${name}: 올릴 수 없는 형식입니다. 링크 페이지에서 미리볼 수 있는 PDF·이미지(PNG·JPG·WEBP·GIF)·MP4만 올릴 수 있습니다. PPT·한글 파일은 PDF로 내보내 올려 주세요.`
  }
  if (!size) return `${name}: 빈 파일입니다.`
  if (size > MAX_FILE_BYTES) return `${name}: 50MB를 넘는 파일은 올릴 수 없습니다.`
  if (name.length > 200) return `${name.slice(0, 30)}…: 파일 이름이 너무 깁니다. 200자 이내로 바꿔 주세요.`
  return null
}

export function fileSize(n: number) {
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))}KB`
  return `${(n / 1024 / 1024).toFixed(1)}MB`
}

export const MISSING_PICK_MSG =
  '디자이너를 골라 링크를 만들 칸이 없습니다. 0034_roster_link_designers.sql 을 실행해 주세요. (전원을 체크하면 지금도 만들 수 있습니다)'

/* 링크가 보여 줄 디자이너만 — 목록 순서(sort_order)는 그대로 둔다 */
export function pickDesigners<T extends { id: string }>(all: T[], ids: string[] | null | undefined): T[] {
  if (!ids) return all
  const set = new Set(ids)
  return all.filter((d) => set.has(d.id))
}

/* 링크 한 번 열람(0033_roster_link_opens.sql) */
export type RosterOpenRow = {
  id: number
  link_id: string
  opened_at: string
  ip: string | null
  user_agent: string | null
  browser: string | null
  os: string | null
  device: string | null
  is_bot: boolean
}

export const MISSING_OPENS_MSG =
  '열람 기록 표가 없어 IP·브라우저 기록을 남기지 못합니다. 0033_roster_link_opens.sql 을 실행해 주세요.'

/* revoked_at 은 '비활성' 이다 — 어드민이 다시 켜면 비운다 */
export type LinkState = 'live' | 'expired' | 'revoked'

export function linkState(r: Pick<RosterLinkRow, 'expires_at' | 'revoked_at'>, now = Date.now()): LinkState {
  if (r.revoked_at) return 'revoked'
  return Date.parse(r.expires_at) <= now ? 'expired' : 'live'
}

export type DesignerInput = { name: string; career: string; designerId: string }

/* 칸 이름 → 까닭. 비어 있으면 통과. 화면은 이것으로 저장 버튼을 막고, 서버는 다시 확인한다 */
export function checkDesignerInput(v: DesignerInput): Partial<Record<keyof DesignerInput, string>> {
  const bad: Partial<Record<keyof DesignerInput, string>> = {}
  const name = v.name.trim()
  if (!name) bad.name = '이름을 적어 주세요.'
  else if (name.length > MAX_NAME) bad.name = `${MAX_NAME}자 이내로 적어 주세요.`
  if (v.career.trim().length > MAX_CAREER) {
    bad.career = `${MAX_CAREER.toLocaleString('ko-KR')}자 이내로 적어 주세요. (지금 ${v.career.trim().length.toLocaleString('ko-KR')}자)`
  }
  if (v.designerId && !/^[0-9a-f-]{36}$/i.test(v.designerId)) bad.designerId = '연결할 디자이너를 다시 골라 주세요.'
  return bad
}

/* 남은 시간 — '23시간 남음', '3일 남음' */
export function remaining(expiresAt: string, now = Date.now()): string {
  const ms = Date.parse(expiresAt) - now
  if (ms <= 0) return '만료'
  const h = Math.floor(ms / 3_600_000)
  if (h < 1) return `${Math.max(1, Math.floor(ms / 60_000))}분 남음`
  if (h < 48) return `${h}시간 남음`
  return `${Math.floor(h / 24)}일 남음`
}
