/* 전문 분야의 모양(011_specialties.sql).

   클라이언트 컴포넌트도 이 타입을 쓰므로 server-only 모듈에 두지 않는다 —
   specialties.ts 에서 가져오면 supabase-admin(service_role) 이
   브라우저 번들로 끌려온다. */

export type Specialty = {
  id: string
  /* 화면에 보이는 이름이자 designers.tags 에 담기는 값 */
  name: string
  sort_order: number
  /* 끄면 탐색 필터와 디자이너 선택지에서 빠진다.
     이미 그 분야를 고른 디자이너의 tags 는 건드리지 않는다. */
  visible: boolean
  /* 이 분야를 고른 디자이너 수 — 어드민 목록에서만 채워진다.
     끄거나 이름을 바꾸기 전에 영향 범위를 보여주는 값이다. */
  used?: number
}

/* 한 디자이너가 고를 수 있는 분야 수.
   너무 많으면 탐색에서 아무 데나 걸려 필터 구실을 못 한다. */
export const MAX_TAGS = 5
