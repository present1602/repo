/* 문의 한 건의 모양(012_inquiries.sql, 015_inquiry_status_two.sql).

   클라이언트 컴포넌트도 이 타입을 쓰므로 server-only 모듈에 두지 않는다 —
   조회 모듈에서 가져오면 supabase-admin(service_role) 이 브라우저 번들로
   끌려온다. */

/* 확인 여부. DB check 제약과 같은 값을 쓴다 — 한쪽만 늘리면
   저장이 조용히 거부된다. */
export const INQUIRY_STATUSES = ['unread', 'read'] as const
export type InquiryStatus = (typeof INQUIRY_STATUSES)[number]

export function isInquiryStatus(v: string): v is InquiryStatus {
  return (INQUIRY_STATUSES as readonly string[]).includes(v)
}

export type InquiryFile = {
  name: string
  path: string
  /* 접수 때 만든 서명 링크 — 7일이 지나면 열리지 않는다.
     만료 후에도 파일은 Storage 에 남아 있다(path 로 다시 만들 수 있다). */
  url: string
  size: number
}

export type InquiryRow = {
  id: string
  created_at: string

  name: string
  email: string
  /* 013 이전에 들어온 문의는 비어 있다 */
  phone: string | null
  message: string
  /* 014 이전에 들어온 문의는 비어 있다 */
  inquiry_type: string | null

  /* 특정 디자이너에게 보낸 문의면 채워진다. 외래키가 없으므로
     그 디자이너가 지워졌어도 이름은 남아 있다. */
  designer_id: string | null
  designer_name: string | null

  files: InquiryFile[]

  status: InquiryStatus
  status_at: string | null
  memo: string | null

  /* 알림 메일이 나갔는지. 거짓이면 메일로는 못 받았다는 뜻이라
     목록에서 눈에 띄게 표시한다. */
  mailed: boolean
}

/* 목록 필터 — 전체와 두 상태 */
export const INQUIRY_FILTERS = ['all', 'unread', 'read'] as const
export type InquiryFilter = (typeof INQUIRY_FILTERS)[number]

export const FILTER_LABELS: Record<InquiryFilter, string> = {
  all: '전체',
  unread: '미확인',
  read: '확인',
}
