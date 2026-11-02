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
  /* 의뢰 범위(039_specialty_scope_mode.sql) — choice 일 때만 탐색 제목 옆에
     '전체 | 디자인 | 디자인 + 개발' 필터가 나온다 */
  scope_mode: SpecialtyScopeMode
  /* 이 분야에서 '메인 시안만 먼저 의뢰'를 받을 수 있는지(039). 디자이너별 scope_sample 과 둘 다 켜져야 한다 */
  allow_sample: boolean
  /* 이 분야를 고른 디자이너 수 — 어드민 목록에서만 채워진다.
     끄거나 이름을 바꾸기 전에 영향 범위를 보여주는 값이다. */
  used?: number
}

/* 039 의 check 제약과 같은 값 — 함께 고쳐야 한다 */
export const SPECIALTY_SCOPE_MODES = ['choice', 'design', 'design_dev'] as const
export type SpecialtyScopeMode = (typeof SPECIALTY_SCOPE_MODES)[number]

export const SPECIALTY_SCOPE_MODE_LABELS: Record<SpecialtyScopeMode, string> = {
  choice: '고객이 선택',
  design: '디자인만',
  design_dev: '디자인 + 개발',
}

export function isSpecialtyScopeMode(v: string): v is SpecialtyScopeMode {
  return (SPECIALTY_SCOPE_MODES as readonly string[]).includes(v)
}

/* 이 디자이너가 메인 시안 우선 의뢰를 받을 수 있는 분야를 골랐는지.
   allowed 가 null 이면(039 전) 거르지 않는다. */
export function sampleAllowed(tags: string[], allowed: string[] | null): boolean {
  return allowed == null || tags.some((t) => allowed.includes(t))
}

/* 한 디자이너가 고를 수 있는 분야 수.
   너무 많으면 탐색에서 아무 데나 걸려 필터 구실을 못 한다. */
export const MAX_TAGS = 5
