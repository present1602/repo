/* 가격 플랜의 보기와 기본값.

   클라이언트 컴포넌트도 이 값을 쓰므로 server-only 모듈에 두지 않는다. */

/* 시안 가격은 범위로 보여준다 — "시작가 ~ 상한".

   시작가(design_price)는 디자이너가 아래 보기 중에서 고르고,
   상한(price_max)은 어드민이 디자이너마다 직접 적는다. 금액을 올려 줄
   만한 디자이너를 가려내는 일은 사람이 판단한다.

   016_price_range.sql 의 check 제약과 같은 값이다 — 함께 고쳐야 한다.
   시작가를 자유 입력으로 두지 않는 이유는 1원이나 9,999,999원이 공개
   화면에 박히면 플랫폼 신뢰가 깨지기 때문이다. */
export const DESIGN_PRICES = [29000, 39000, 49000, 59000, 79000, 99000] as const
export const PREMIUM_PRICES = [79000, 109000, 169000] as const

export const DEFAULT_DESIGN_PRICE = DESIGN_PRICES[0]
export const DEFAULT_PREMIUM_PRICE = PREMIUM_PRICES[0]

/* 상한의 기본값과 한계(016_price_range.sql 의 check 제약과 같은 값) */
export const DEFAULT_PRICE_MAX = 99000
export const MIN_PRICE_MAX = 29000
export const MAX_PRICE_MAX = 1000000

/* 보기에 없는 값이면 거절한다.
   서버 액션은 누구나 부를 수 있어 클라이언트가 보낸 숫자를 믿으면 안 된다.
   DB check 제약이 최종 방어하지만, 거부되면 뭉뚱그린 에러만 남는다. */
export function isDesignPrice(n: number): boolean {
  return (DESIGN_PRICES as readonly number[]).includes(n)
}

export function isPremiumPrice(n: number): boolean {
  return (PREMIUM_PRICES as readonly number[]).includes(n)
}

export function isPriceMax(n: number): boolean {
  return Number.isInteger(n) && n >= MIN_PRICE_MAX && n <= MAX_PRICE_MAX
}

/* 이 디자이너가 고를 수 있는 시작가.

   상한보다 높은 시작가는 고를 수 없다 — 범위가 뒤집혀 공개 화면에
   "79,000 ~ 49,000원" 같은 글자가 나간다. 그래서 상한을 99,000 이상으로
   올려 둔 디자이너만 99,000원을 고를 수 있게 된다. */
export function designPriceOptions(priceMax: number): number[] {
  return DESIGN_PRICES.filter((p) => p <= priceMax)
}

/* 29000, 99000 → '29,000 ~ 99,000원'.
   둘이 같으면 한쪽만 적는다 — '29,000 ~ 29,000원'은 읽는 사람을 멈추게 한다. */
export function formatPriceRange(from: number, to: number): string {
  if (from >= to) return formatPrice(from)
  return `${from.toLocaleString('ko-KR')} ~ ${formatPrice(to)}`
}

/* 29000 → '29,000원' */
export function formatPrice(won: number): string {
  return `${won.toLocaleString('ko-KR')}원`
}

/* 전역 설정에서 오는 플랜 이름·설명 — 모든 디자이너에게 같은 문구가 나간다 */
export type PlanCopy = {
  design_plan_name: string
  design_plan_desc: string
  premium_plan_name: string
  premium_plan_desc: string
}

/* 설정 행을 못 읽었을 때 쓰는 값 — 화면이 비는 것보다 낫다.
   006_plans.sql 의 default 와 같은 문구를 쓴다. */
export const FALLBACK_COPY: PlanCopy = {
  design_plan_name: '디자인 플랜',
  design_plan_desc: '고객측에서 디자인할 화면에 들어갈 내용을 구체적으로 전달합니다.',
  premium_plan_name: '프리미엄 플랜',
  premium_plan_desc: '프리미엄플랜설명',
}

export const MAX_PLAN_DESC = 500
