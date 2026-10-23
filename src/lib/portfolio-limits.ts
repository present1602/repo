/* 포트폴리오 제한값과 작업 타입.

   클라이언트 컴포넌트도 이 값을 쓰므로 server-only 모듈에 두지 않는다 —
   designers-db.ts 에 두면 supabase-admin(service_role) 이 브라우저 번들로 끌려온다. */

/* 올릴 수 있는 총량. DB 트리거에도 같은 값이 박혀 있다(003_designer_works.sql) —
   함께 고쳐야 한다. */
export const MAX_WORKS = 30

/* 상세 설명 길이 — textarea 와 DB check 제약이 같은 값을 쓴다 */
export const MAX_DESCRIPTION = 1000

/* 긴 소개글 길이 — 005_public_profile_fields.sql 의 check 제약과 같은 값 */
export const MAX_BIO = 2000

/* masonry 에서 카드가 차지할 세로 칸 수의 범위 */
export const MIN_ROW_SPAN = 1
export const MAX_ROW_SPAN = 3

export type WorkRow = {
  id: string
  created_at: string
  updated_at: string
  designer_id: string
  image_url: string
  width: number | null
  height: number | null
  title: string | null
  description: string | null
  row_span: number
  visible: boolean
  sort_order: number
  /* 선택 입력 — 비어 있으면 공개 화면에서 해당 표기가 사라진다 */
  client: string | null
  /* 컬럼은 남아 있지만 화면·입력에서 빼기로 했다. select('*') 로 받으므로
     타입에는 남겨 두되, 어디서도 읽거나 쓰지 않는다. */
  year: number | null
}
