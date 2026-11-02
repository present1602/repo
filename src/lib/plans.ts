/* 가격 플랜의 보기와 기본값.

   클라이언트 컴포넌트도 이 값을 쓰므로 server-only 모듈에 두지 않는다. */

import type { Scope } from './scopes'

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

/* 로고 디자인 시작가 — 디자이너가 고르고, 상한은 모두 99,000원으로 고정이다.
   033_logo_design.sql 의 check 제약과 같은 값이다 — 함께 고쳐야 한다. */
export const LOGO_PRICES = [19900, 29000, 39000, 49000, 59000, 79000, 99000] as const
export const DEFAULT_LOGO_PRICE = LOGO_PRICES[0]
export const LOGO_PRICE_MAX = 99000

/* 디자인 전체·프로젝트 의뢰 최소가의 기본값 — 어드민이 디자이너마다 바꾼다
   (035_full_design_project_price.sql 의 default 와 같은 값). 디자이너는 고르지 않는다.
   디자이너가 정해지지 않은 의뢰 폼(네비바)은 이 금액을 보여준다.
   허용 범위는 본 계약 시작가와 같다(isContractPrice). */
export const DEFAULT_FULL_DESIGN_PRICE = 179000
export const DEFAULT_PROJECT_PRICE = 349000

/* 상한의 기본값과 한계(016_price_range.sql 의 check 제약과 같은 값) */
export const DEFAULT_PRICE_MAX = 99000
export const MIN_PRICE_MAX = 29000
export const MAX_PRICE_MAX = 1000000

/* 본 계약 시작가 — 어드민이 디자이너마다 적는다(030_contract_price.sql 과 같은 값) */
export const DEFAULT_CONTRACT_PRICE = 189000
export const MIN_CONTRACT_PRICE = 10000
export const MAX_CONTRACT_PRICE = 100000000

export function isContractPrice(n: number): boolean {
  return Number.isInteger(n) && n >= MIN_CONTRACT_PRICE && n <= MAX_CONTRACT_PRICE
}

/* 보기에 없는 값이면 거절한다.
   서버 액션은 누구나 부를 수 있어 클라이언트가 보낸 숫자를 믿으면 안 된다.
   DB check 제약이 최종 방어하지만, 거부되면 뭉뚱그린 에러만 남는다. */
export function isDesignPrice(n: number): boolean {
  return (DESIGN_PRICES as readonly number[]).includes(n)
}

export function isLogoPrice(n: number): boolean {
  return (LOGO_PRICES as readonly number[]).includes(n)
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

/* 플랜 문구 — 의뢰 유형(scopes.ts) 넷 × 단계(기본·프리미엄)마다 이름·설명.
   모든 디자이너에게 같은 문구가 나가고 어드민 설정에서 고친다(036_plan_copy_premium.sql).

   프리미엄 스위치는 두 겹이다 — 유형 전체(premium.enabled)가 켜져야
   디자이너별(DesignerPremiums)로 켤 수 있고, 둘 다 켜지고 금액이 있어야 나간다. */
export const PLAN_TIERS = ['basic', 'premium'] as const
export type PlanTier = (typeof PLAN_TIERS)[number]

export type PlanText = { name: string; desc: string }

/* 플랜 하나의 전체 공통값 — 이름·설명과 작업 기간(037_plan_details.sql) */
export type PlanTierCopy = PlanText & { duration: string }
export type PremiumText = PlanTierCopy & { enabled: boolean }
/* visible — 플랜을 사이트에 보여주는지(038_plan_visibility.sql). 끄면 공개 화면 어디에도 안 나간다 */
export type PlanCopies = Record<Scope, { basic: PlanTierCopy; premium: PremiumText; visible: boolean }>

/* 디자이너별 작업 기간 — null 이면 전체 공통값 */
export type PlanTierOverride = { duration: string | null }
export type DesignerPlanDetails = Partial<Record<Scope, Partial<Record<PlanTier, PlanTierOverride>>>>

/* 플랜 칸 — 유형 × 단계. 포함 항목 템플릿을 어디서 고를 수 있는지, 디자이너가
   어디에 등록했는지를 이 글자로 적는다('sample:basic'). DB 의 targets 와 같은 값. */
export type PlanSlot = `${Scope}:${PlanTier}`
export function slotOf(scope: Scope, tier: PlanTier): PlanSlot {
  return `${scope}:${tier}`
}

export const PLAN_SLOTS: PlanSlot[] = (['sample', 'logo', 'full_design', 'with_dev'] as const).flatMap(
  (s) => PLAN_TIERS.map((t) => slotOf(s, t)),
)

export function isPlanSlot(v: string): v is PlanSlot {
  return (PLAN_SLOTS as string[]).includes(v)
}

/* 포함 항목 템플릿 — 어드민이 만든다. {n} 자리에 디자이너가 넣은 숫자가 들어간다.
   targets 가 null 이면 모든 플랜에서 고를 수 있다.
   designerId 가 있으면 그 디자이너 전용 — 어드민이 디자이너마다 따로 만든다. */
export type OptionTemplate = {
  id: string
  template: string
  targets: PlanSlot[] | null
  designerId: string | null
}

/* 디자이너가 플랜 하나에 등록한 포함 항목 */
export type RegisteredOption = { templateId: string; n: number | null }
export type DesignerPlanOptions = Partial<Record<PlanSlot, RegisteredOption[]>>

export const N_TOKEN = '{n}'

export function needsN(template: string): boolean {
  return template.includes(N_TOKEN)
}

export function templateAllows(t: OptionTemplate, slot: PlanSlot): boolean {
  return t.targets == null || t.targets.includes(slot)
}

/* 포함 항목 한 줄을 글로 — '수정 {n}회' + 2 → '수정 2회' */
export function optionText(template: string, n: number | null): string {
  return n == null ? template : template.replaceAll(N_TOKEN, String(n))
}

/* 이 디자이너의 한 플랜에 나갈 작업 기간과 포함 항목.

   포함 항목은 디자이너가 등록한 것만, 템플릿 차례대로. 템플릿이 지워졌거나
   그 플랜에서 막혔거나({n} 인데 숫자가 없으면) 빼낸다 — 처음 가입한 디자이너는 비어 있다.
   기간은 노출 스위치가 꺼져 있거나 비어 있으면 null. */
export function resolveTier(
  copy: PlanTierCopy,
  override: PlanTierOverride | undefined,
  showDuration: boolean,
  slot: PlanSlot,
  templates: OptionTemplate[],
  registered: RegisteredOption[] | undefined,
): { duration: string | null; items: string[] } {
  const duration = (override?.duration ?? copy.duration).trim()
  const mine = new Map((registered ?? []).map((r) => [r.templateId, r.n]))
  const items: string[] = []
  for (const t of templates) {
    if (!mine.has(t.id) || !templateAllows(t, slot)) continue
    const n = mine.get(t.id) ?? null
    if (needsN(t.template) && n == null) continue
    items.push(optionText(t.template, needsN(t.template) ? n : null))
  }
  return { duration: showDuration && duration ? duration : null, items }
}

/* 사이트에 보여주는 플랜만 — 숨긴 플랜은 공개 화면 어디에도 나가지 않는다 */
export function hiddenScopes(copies: PlanCopies): Scope[] {
  return (Object.keys(copies) as Scope[]).filter((s) => !copies[s].visible)
}

/* 디자이너·유형별 프리미엄 — 어드민만 정한다. 꺼도 금액은 남겨 둔다. */
export type PremiumSetting = { enabled: boolean; price: number }
export type DesignerPremiums = Partial<Record<Scope, PremiumSetting>>

/* 공개 화면에 나갈 프리미엄 — 두 스위치가 모두 켜졌을 때만, 아니면 null */
export function livePremium(
  copies: PlanCopies,
  premiums: DesignerPremiums,
  scope: Scope,
): (PlanText & { price: number }) | null {
  const p = premiums[scope]
  if (!copies[scope].premium.enabled || !p?.enabled) return null
  return { name: copies[scope].premium.name, desc: copies[scope].premium.desc, price: p.price }
}

/* 표를 못 읽었을 때 쓰는 값 — 화면이 비는 것보다 낫다.
   036 이 처음 넣는 문구와 같다. */
const blank = { duration: '' }
export const FALLBACK_PLAN_COPIES: PlanCopies = {
  sample: {
    basic: { name: '메인화면 우선 의뢰', desc: '메인화면 시안만 먼저 의뢰합니다.', ...blank },
    premium: { name: '메인화면 우선 의뢰 프리미엄', desc: '', enabled: false, ...blank },
    visible: true,
  },
  logo: {
    basic: { name: '로고 디자인', desc: '로고 디자인을 의뢰합니다.', ...blank },
    premium: { name: '로고 디자인 프리미엄', desc: '', enabled: false, ...blank },
    visible: true,
  },
  full_design: {
    basic: { name: '디자인 전체 의뢰', desc: '서비스 전체 디자인을 맡깁니다.', ...blank },
    premium: { name: '디자인 전체 의뢰 프리미엄', desc: '', enabled: false, ...blank },
    visible: true,
  },
  with_dev: {
    basic: {
      name: '프로젝트 의뢰',
      desc: '기획, 개발까지 포함한 프로젝트 전체 의뢰를 맡깁니다.',
      ...blank,
    },
    premium: { name: '프로젝트 의뢰 프리미엄', desc: '', enabled: false, ...blank },
    visible: true,
  },
}

/* 036·037 의 check 제약과 같은 값 */
export const MAX_PLAN_NAME = 40
export const MAX_PLAN_DESC = 500
export const MAX_PLAN_DURATION = 40
export const MAX_OPTION_N = 999
export const MAX_OPTION_TEMPLATE = 80
