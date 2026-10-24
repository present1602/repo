/* 가격 플랜의 보기와 기본값.

   클라이언트 컴포넌트도 이 값을 쓰므로 server-only 모듈에 두지 않는다. */

/* 디자이너가 고를 수 있는 금액(원).
   006_plans.sql 의 check 제약과 같은 값이다 — 함께 고쳐야 한다.
   자유 입력을 막는 이유는 1원이나 9,999,999원이 공개 화면에 박히면
   플랫폼 신뢰가 깨지기 때문이다. */
export const DESIGN_PRICES = [29000, 39000, 49000, 79000] as const
export const PREMIUM_PRICES = [79000, 109000, 169000] as const

export const DEFAULT_DESIGN_PRICE = DESIGN_PRICES[0]
export const DEFAULT_PREMIUM_PRICE = PREMIUM_PRICES[0]

/* 보기에 없는 값이면 기본값으로 되돌린다.
   서버 액션은 누구나 부를 수 있어 클라이언트가 보낸 숫자를 믿으면 안 된다.
   DB check 제약이 최종 방어하지만, 거부되면 뭉뚱그린 에러만 남는다. */
export function isDesignPrice(n: number): boolean {
  return (DESIGN_PRICES as readonly number[]).includes(n)
}

export function isPremiumPrice(n: number): boolean {
  return (PREMIUM_PRICES as readonly number[]).includes(n)
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
