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

/* 탐색 목록 카드에 미리 실을 썸네일 장수 — 나머지는 "+N개 더보기" 로 접는다.

   이 수를 넘지 않으면 가로 스크롤로 전부 볼 수 있어 더보기 칸이 뜨지 않는다.
   조회(public-designers.ts)와 어드민 미리보기(designer-detail.tsx)가 함께
   쓴다 — 미리보기는 클라이언트 컴포넌트라, server-only 인 조회 모듈이 아니라
   여기에 둔다. */
export const CARD_THUMBS = 7

export type WorkRow = {
  id: string
  created_at: string
  updated_at: string
  designer_id: string
  /* 원본 — 상세로 크게 띄우는 자리에 쓴다 */
  image_url: string
  /* 목록용 작은 이미지(010_work_thumbnails.sql).
     010 전에 올라간 작업은 비어 있으므로 thumbSrc() 로 읽는다. */
  thumb_url: string | null
  width: number | null
  height: number | null
  title: string | null
  description: string | null
  row_span: number
  visible: boolean
  sort_order: number
  /* 선택 입력 — 비어 있으면 공개 화면에서 해당 표기가 사라진다 */
  client: string | null
  /* AI 사용 여부 — 본인이 올릴 때 체크한다(008_work_ai_used.sql).
     null 은 "묻기 전에 올라간 작업"이고 false 와 뜻이 다르다. */
  ai_used: boolean | null
  /* 썸네일 영역 — 원본에 대한 0~1 비율(009_work_thumb_crop.sql).
     넷 다 null 이면 영역을 잡지 않은 것이다. */
  crop_x: number | null
  crop_y: number | null
  crop_w: number | null
  crop_h: number | null
  /* 어드민이 메인 화면에 걸려고 고른 작업인지(007_featured_works.sql).
     디자이너가 켜는 visible 과 주인이 다르다 — 메인에 뜨려면 둘 다 참이어야 한다. */
  featured: boolean
  featured_at: string | null
  /* 컬럼은 남아 있지만 화면·입력에서 빼기로 했다. select('*') 로 받으므로
     타입에는 남겨 두되, 어디서도 읽거나 쓰지 않는다. */
  year: number | null
}

/* 메인 노출 설정 화면의 한 줄 — 작업에 주인 정보를 붙인 모양.

   어드민 화면이라 공개 피드(FeedWork)와 달리 이메일까지 싣는다.
   동명이인이 있을 때 이름만으로는 누구인지 가릴 수 없기 때문이다. */
export type FeaturedCandidate = WorkRow & {
  designer: {
    id: string
    name: string | null
    email: string
    avatar_url: string | null
    /* 디자이너 쪽이 닫혀 있으면 골라도 메인에 안 뜬다 — 화면에서 그 이유를 알려준다 */
    visible: boolean
    profile_public: boolean
  }
}

/* 관리 화면 목록에서 쓸 이미지 주소.

   공개 화면은 조회 계층(public-designers.ts 의 strip)이 thumb_url 을 채워
   내보내지만, 관리 화면은 select('*') 로 행을 그대로 받아 그 보정을 거치지
   않는다 — 폴백을 여기 한 곳에 둔다. 화면마다 적으면 어드민·디자이너
   양쪽에 같은 분기가 흩어진다.

   크게 띄우는 자리(상세 모달)는 이것을 쓰지 않고 image_url 을 쓴다. */
export function thumbSrc(w: Pick<WorkRow, 'thumb_url' | 'image_url'>): string {
  return w.thumb_url || w.image_url
}
