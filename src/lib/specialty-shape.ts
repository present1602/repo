/* 전문 분야의 모양(011_specialties.sql).

   클라이언트 컴포넌트도 이 타입을 쓰므로 server-only 모듈에 두지 않는다 —
   specialties.ts 에서 가져오면 supabase-admin(service_role) 이
   브라우저 번들로 끌려온다. */

export type Specialty = {
  id: string
  /* 화면에 보이는 이름이자 designers.tags 에 담기는 값 */
  name: string
  sort_order: number
  /* 끄면 탐색 사이드바에서만 빠진다. 디자이너는 계속 고를 수 있고 프로필에도 나간다. */
  visible: boolean
  /* 의뢰 범위(039_specialty_scope_mode.sql) — choice 일 때만 탐색 제목 옆에
     '전체 | 디자인 | 디자인 + 개발' 필터가 나온다 */
  scope_mode: SpecialtyScopeMode
  /* 이 분야에서 '메인 시안만 먼저 의뢰'를 받을 수 있는지(039). 디자이너별 scope_sample 과 둘 다 켜져야 한다 */
  allow_sample: boolean
  /* 탐색에서 이 분야를 고르면 제목 아래에 나가는 문구(0002). 비면 나가지 않는다 */
  description: string
  /* 범위 × 단계마다의 노출·시작가(0011_specialty_scope_prices.sql). 비면 기본값(priceOf).
     의뢰 범위를 바꿔도 남아 있다 — 지금 범위가 받는 칸만 쓴다 */
  prices: SpecialtyPrices
  /* 이 분야를 고른 디자이너 수 — 어드민 목록에서만 채워진다.
     끄거나 이름을 바꾸기 전에 영향 범위를 보여주는 값이다. */
  used?: number
}

/* 디자이너가 고르는 선택지 한 칸 — visible 이면 탐색 사이드바(메뉴)에 나오는 분야다 */
export type SpecialtyOption = { name: string; visible: boolean }

/* 분야 시작가를 두는 범위·단계 — 0011 의 check 제약과 같은 값, 함께 고쳐야 한다.
   메인화면 먼저 의뢰는 디자이너 가격이라 없다. 단계가 늘면 PRICE_TIERS 와 check 를 넓힌다 */
export const PRICE_SCOPES = ['design', 'design_dev'] as const
export type PriceScope = (typeof PRICE_SCOPES)[number]
export const PRICE_TIERS = ['basic', 'premium'] as const
export type PriceTier = (typeof PRICE_TIERS)[number]

/* enabled — 그 단계를 이 분야·범위에서 내보내는지(기본 단계는 늘 true).
   price — 시작가(원). null 이면 디자이너 가격.
   allowSample — 기본 단계에서만: 이 범위에 메인화면 먼저 의뢰 옵션을 붙일지(0013) */
export type ScopePrice = { enabled: boolean; price: number | null; allowSample: boolean }
export type SpecialtyPrices = Partial<Record<PriceScope, Partial<Record<PriceTier, ScopePrice>>>>

/* 줄이 없으면 노출·디자이너 가격 — 0011 을 돌려도 화면이 그대로이게 */
export function priceOf(prices: SpecialtyPrices, scope: PriceScope, tier: PriceTier): ScopePrice {
  return prices[scope]?.[tier] ?? { enabled: true, price: null, allowSample: true }
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
