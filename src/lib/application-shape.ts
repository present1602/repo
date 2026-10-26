/* 디자이너 지원서의 모양과 첨부 규칙(021_designer_applications.sql).

   지원 폼(클라이언트)과 접수 API·어드민(서버)이 함께 쓴다 —
   허용 형식이나 크기가 양쪽에서 어긋나면, 화면은 통과시켰는데 서버가
   거부하는 일이 생긴다. server-only 모듈에 두지 않는다. */

/* 비공개 버킷 이름 — 지원 폼이 서명 주소로 올릴 때도 써야 해서 여기 둔다 */
export const APPLICATION_FILES_BUCKET = 'designer-applications'

export const APPLICATION_FILE_KINDS = ['resume', 'portfolio'] as const
export type ApplicationFileKind = (typeof APPLICATION_FILE_KINDS)[number]

export const APPLICATION_FILE_LABELS: Record<ApplicationFileKind, string> = {
  resume: '이력서',
  portfolio: '포트폴리오',
}

/* 버킷의 file_size_limit 와 같은 값 — 실제로 막는 것은 버킷이다 */
export const MAX_APPLICATION_FILE_BYTES = 30 * 1024 * 1024

/* 이력서·포트폴리오로 올 법한 형식만. 실행 파일은 받지 않는다 —
   어드민이 내려받아 열기 때문이다. */
export const APPLICATION_FILE_EXT = [
  'pdf', 'doc', 'docx', 'hwp', 'hwpx', 'txt',
  'ppt', 'pptx', 'key', 'zip',
  'png', 'jpg', 'jpeg', 'webp',
]

/* input[type=file] 의 accept — 고르는 창에서 걸러 보이게 한다 */
export const APPLICATION_FILE_ACCEPT = APPLICATION_FILE_EXT.map((e) => `.${e}`).join(',')

export function fileExt(name: string) {
  return name.split('.').pop()?.toLowerCase() ?? ''
}

export type ApplicationFile = { name: string; path: string; size: number }

export type ApplicationStatus = 'unread' | 'read'

export type ApplicationRow = {
  id: string
  created_at: string
  name: string
  email: string
  resume: ApplicationFile
  portfolio: ApplicationFile
  submit_key: string
  status: ApplicationStatus
  status_at: string | null
}

/* 어드민 화면으로 내려보내는 모양 — 비공개 버킷이라 내려받기 링크를
   서버에서 서명해 붙인다 */
export type ApplicationWithLinks = ApplicationRow & {
  links: Record<ApplicationFileKind, string | null>
}
