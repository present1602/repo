/* 의뢰 폼의 선택지 — 분야를 먼저 고르고, 그 분야에서 맡길 범위를 고른다
   (0003_inquiry_category.sql).

   클라이언트 컴포넌트도 쓰므로 server-only 모듈에 두지 않는다. 선택지는 서버에서
   만들어 넘긴다 — 디자이너 가격·스위치를 브라우저가 다시 계산하지 않게.

   범위는 문의에 inquiry_type 글자로 남는다(SCOPE_INQUIRY_TYPE) —
   이전 문의와 같은 칸, 같은 check 제약을 쓴다. */

import type { PublicDesigner } from './designer-shape'
import {
  DEFAULT_DESIGN_PRICE,
  DEFAULT_FULL_DESIGN_PRICE,
  DEFAULT_PROJECT_PRICE,
  formatPrice,
  formatPriceRange,
  livePremium,
  type BucketPlan,
  type DesignerPremiums,
  type PlanCopies,
} from './plans'
import type { InquiryType } from './inquiry-types'
import type { Scope } from './scopes'
import {
  ownPriceOf,
  priceOf,
  type DesignerSpecialtyPrices,
  type SpecialtyPrices,
  type SpecialtyScopeMode,
} from './specialty-shape'

export const INQUIRY_SCOPES = ['sample', 'design', 'design_dev'] as const
export type InquiryScope = (typeof INQUIRY_SCOPES)[number]

export function isInquiryScope(v: string): v is InquiryScope {
  return (INQUIRY_SCOPES as readonly string[]).includes(v)
}

/* 범위 → 문의에 남는 글자(inquiries_type_allowed 가 허용하는 값) */
export const SCOPE_INQUIRY_TYPE: Record<InquiryScope, InquiryType> = {
  sample: '메인화면 시안 먼저 의뢰',
  design: '디자인',
  design_dev: '프로젝트 의뢰',
}

/* 거꾸로 — 상세 패널에서 고른 유형으로 폼의 범위를 골라 둔다. 로고는 분야라 없다 */
export const INQUIRY_TYPE_SCOPE_KEY: Partial<Record<InquiryType, InquiryScope>> = {
  '메인화면 시안 먼저 의뢰': 'sample',
  디자인: 'design',
  '프로젝트 의뢰': 'design_dev',
}

/* 범위마다 플랜 문구·프리미엄·노출 스위치가 걸린 플랜(plan_copy.plan) */
export const SCOPE_PLAN: Record<InquiryScope, Scope> = {
  sample: 'sample',
  design: 'full_design',
  design_dev: 'with_dev',
}

const SCOPE_TEXT: Record<InquiryScope, { label: string; desc: string }> = {
  sample: {
    label: '메인 시안 먼저 의뢰',
    desc: '메인화면 시안만 먼저 의뢰합니다. 이후 본계약 의뢰 시 메인화면 시안 비용을 제외한 나머지 본계약 비용을 지불합니다.',
  },
  design: { label: '디자인만 의뢰', desc: '' },
  design_dev: { label: '디자인 + 개발 의뢰', desc: '' },
}

/* 범위가 하나로 정해진 분야의 한 줄 제목 — 설명 대신 무엇을 맡기는지 분야 이름으로 적는다.
   디자인 + 개발 묶음은 '랜딩페이지 개발', 디자인만은 '로고/일러스트' 그대로 */
function fixedTitle(name: string, scope: 'design' | 'design_dev'): string {
  return scope === 'design_dev' ? `${name} 개발` : name
}

export type ScopeOption = {
  key: InquiryScope
  label: string
  /* 범위가 정해진 분야는 비운다 — 한 줄에 title 만 보인다 */
  desc: string
  /* 범위가 정해진 분야의 한 줄 제목(fixedTitle) */
  title?: string
  /* 분야까지 붙인 한 줄 이름 — 상세 패널·의뢰 폼의 유형 목록이 같은 이름을 쓴다.
     고르는 분야는 'web/app 디자인 의뢰', 범위가 정해진 분야는 '랜딩페이지 의뢰' */
  fullLabel: string
  priceLabel: string
  /* 유형 전체·디자이너별 프리미엄이 모두 켜졌을 때만 */
  premium?: { name: string; priceLabel: string }
  /* 본계약 줄에 메인화면 먼저 의뢰 옵션을 붙일 수 있는지 — 분야의 범위별 스위치(0013).
     분야에 메인 시안 줄이 있을 때만 뜻이 있다(splitSample) */
  sampleOk: boolean
}

export type CategoryChoice = {
  name: string
  /* 탐색 사이드바에서의 차례 — 의뢰 폼의 분야 고르기가 사이드바와 같은 차례로 선다.
     options 목록(상세 패널)은 menuCategories 차례(web/app 먼저)를 그대로 쓴다 */
  order: number
  /* 고를 수 있는 범위 — 하나면 묻지 않고 한 줄로 보여준다 */
  options: ScopeOption[]
}

/* 분야 한 줄 — 서버가 specialties 에서 읽어 넘긴다 */
export type CategoryMeta = {
  /* 분야별 포함 항목의 열쇠(bucketOf) — 이름은 어드민이 바꿀 수 있어 id 로 잇는다 */
  id: string
  name: string
  visible: boolean
  scope_mode: SpecialtyScopeMode
  allow_sample: boolean
  /* 범위 × 단계별 노출·시작가(0011) — 비면 디자이너 가격 */
  prices: SpecialtyPrices
}

/* 그 분야·범위에 적힌 기본 시작가 — 메인 시안은 늘 디자이너 가격이라 null.

   디자이너 한 명에게만 적어 둔 금액(0016)이 있으면 그것이 분야 전체 금액을 덮는다 —
   "이 디자이너의 상세페이지만 더 비싸게" 를 두는 칸이다. own 을 주지 않으면 예전과 같다. */
export function categoryPrice(
  meta: Pick<CategoryMeta, 'id' | 'prices'>,
  scope: InquiryScope,
  own?: DesignerSpecialtyPrices,
): number | null {
  if (scope === 'sample') return null
  return ownPriceOf(own, meta.id, scope, 'basic') ?? priceOf(meta.prices, scope, 'basic').price
}

/* 이 분야·범위에서 나가는 프리미엄.
     분야에서 프리미엄을 켜고 시작가를 적었으면 그것으로 나간다 — 설정·디자이너 스위치를 따로 켜지 않아도.
     분야 시작가가 비면 예전처럼 설정의 유형별 프리미엄과 디자이너별 프리미엄이 모두 켜져야 하고 금액도 디자이너 것.
     분야에서 끄면 어느 쪽이든 나가지 않는다. 메인 시안은 분야 칸이 없어 예전 규칙만 본다.
   이름·설명은 설정의 프리미엄 문구(plan_copy) */
export function categoryPremium(
  copies: PlanCopies,
  premiums: DesignerPremiums,
  meta: Pick<CategoryMeta, 'id' | 'prices'> | undefined,
  scope: InquiryScope,
  ownPrices?: DesignerSpecialtyPrices,
): { name: string; desc: string; price: number } | null {
  const live = livePremium(copies, premiums, SCOPE_PLAN[scope])
  if (scope === 'sample' || !meta) return live
  const own = priceOf(meta.prices, scope, 'premium')
  /* 분야에서 끄면 디자이너에게 적어 둔 금액이 있어도 나가지 않는다 — 끄는 쪽이 이긴다 */
  if (!own.enabled) return null
  /* 디자이너에게만 적어 둔 프리미엄(0016)이 분야 금액을 덮는다 */
  const mine = ownPriceOf(ownPrices, meta.id, scope, 'premium') ?? own.price
  if (mine != null) {
    const copy = copies[SCOPE_PLAN[scope]].premium
    return { name: copy.name, desc: copy.desc, price: mine }
  }
  return live
}

/* 메인화면 먼저 의뢰는 따로 고르는 줄이 아니라 본계약(디자인만·디자인 + 개발) 줄 안의 옵션이다 —
   본계약을 고른 뒤에 '메인화면 먼저'를 덧붙인다. 붙일 수 있는 줄은 sampleOk 로 고른다(0013).
   본계약 줄이 하나도 없으면(플랜을 숨긴 경우) 메인 시안도 한 줄로 둔다 */
export function splitSample<T extends { key: InquiryScope; sampleOk: boolean }>(
  options: T[],
): { main: T[]; sample: T | null } {
  const main = options.filter((o) => o.key !== 'sample')
  if (main.length === 0) return { main: options, sample: null }
  /* 어느 본계약 줄에도 붙일 수 없으면 메인 시안은 없는 것과 같다 */
  const sample = main.some((o) => o.sampleOk) ? (options.find((o) => o.key === 'sample') ?? null) : null
  return { main, sample }
}

/* 처음 골라 둘 범위 — 디자인만과 디자인 + 개발을 둘 다 받으면 디자인 + 개발(프로젝트 의뢰),
   하나뿐이면 그것. 그 밖에는 null(고객이 직접 고른다) */
export function defaultScope(keys: InquiryScope[]): InquiryScope | null {
  if (keys.includes('design') && keys.includes('design_dev')) return 'design_dev'
  return keys.length === 1 ? keys[0] : null
}

/* 탐색에서 고른 의뢰유형(디자인만·디자인 + 개발)에 맞는 줄만 남긴다 — 탐색에서 들어온 상세·의뢰 폼.
   메인 시안은 남은 본계약 줄에 붙는 옵션이라 함께 둔다(splitSample 이 붙일 줄이 없으면 뺀다).
   범위가 하나로 정해진 분야(랜딩·로고)는 고른 범위가 없어도 그대로 둔다 — 비우면 그 분야를 의뢰할 길이 없다 */
export function onlyScope(choices: CategoryChoice[], scope: 'design' | 'design_dev'): CategoryChoice[] {
  return choices.map((c) => {
    if (!c.options.some((o) => o.key === scope)) return c
    return { ...c, options: c.options.filter((o) => o.key === scope || o.key === 'sample') }
  })
}

/* 분야가 허용하는 범위 — 메인 시안은 그 분야가 허용할 때 맨 앞 */
export function scopesOf(meta: Pick<CategoryMeta, 'scope_mode' | 'allow_sample'>): InquiryScope[] {
  const base: InquiryScope[] =
    meta.scope_mode === 'choice'
      ? ['design', 'design_dev']
      : meta.scope_mode === 'design'
        ? ['design']
        : ['design_dev']
  return meta.allow_sample ? ['sample', ...base] : base
}

type DesignerPrices = Pick<
  PublicDesigner,
  | 'design_price'
  | 'price_max'
  | 'full_design_price'
  | 'project_price'
  | 'scope_sample'
  | 'scope_full_design'
  | 'scope_with_dev'
  | 'tags'
  | 'own_prices'
>

/* 이 디자이너가 이 분야에서 그 범위를 받는지(0004_plan_options_by_category.sql).
     메인 시안      — 어드민 스위치(scope_sample). 허용 분야는 scopesOf 가 이미 거른다
     범위가 정해진 분야(랜딩·로고) — 분야를 고르면 받는다
     고객이 선택하는 분야(web/app) — 디자인·프로젝트 둘 다. 고객이 의뢰할 때 고르는 옵션이라
       디자이너가 따로 켜고 끄지 않는다 */
export function designerAllows(
  d: Pick<DesignerPrices, 'scope_sample' | 'scope_full_design' | 'scope_with_dev'>,
  scope: InquiryScope,
): boolean {
  return scope === 'sample' ? d.scope_sample : true
}

/* 이 디자이너가 이 분야에서 받는 범위 — 스튜디오·상세 패널의 분야별 포함 항목 칸 */
export function designerScopesOf(
  d: Pick<DesignerPrices, 'scope_sample' | 'scope_full_design' | 'scope_with_dev'>,
  meta: Pick<CategoryMeta, 'scope_mode' | 'allow_sample'>,
): InquiryScope[] {
  return scopesOf(meta).filter((s) => designerAllows(d, s))
}

/* 의뢰 받는 분야의 차례 — 탐색 메뉴에 나오는 분야만, 고객이 범위를 고르는 분야(web/app)를 맨 앞에.
   그 분야가 메인 시안·디자인·프로젝트를 다 품어 가장 먼저 보여야 한다. 나머지는 어드민 차례대로 */
export function menuCategories<T extends Pick<CategoryMeta, 'visible' | 'scope_mode'>>(metas: T[]): T[] {
  const menu = metas.filter((m) => m.visible)
  return [...menu.filter((m) => m.scope_mode === 'choice'), ...menu.filter((m) => m.scope_mode !== 'choice')]
}

/* 유형 목록의 구분선 자리 — 여러 유형을 품은 분야(web/app) 묶음이 끝나는 곳에만.
   cats 는 줄마다의 분야 이름. 한 줄짜리 분야(랜딩·로고)끼리는 긋지 않는다 */
export function dividerBefore(cats: string[], i: number): boolean {
  if (i === 0 || cats[i] === cats[i - 1]) return false
  return cats.filter((c) => c === cats[i - 1]).length > 1
}

type Source = {
  copies: PlanCopies
  premiums?: DesignerPremiums
  /* 이 디자이너에게만 적어 둔 분야별 시작가(0016) — 분야 전체 금액을 덮는다 */
  ownPrices?: DesignerSpecialtyPrices
}

function build(
  all: CategoryMeta[],
  metas: CategoryMeta[],
  { copies, premiums, ownPrices }: Source,
  prices: Record<InquiryScope, string>,
  allows: (scope: InquiryScope, meta: CategoryMeta) => boolean,
): CategoryChoice[] {
  /* 사이드바는 노출 분야를 설정 차례대로 보여준다(listExploreSpecialties) */
  const sidebar = all.filter((m) => m.visible).map((m) => m.name)
  return metas
    .map((meta) => {
      const scopes = scopesOf(meta).filter(
        /* 사이트에서 숨긴 플랜의 범위는 뺀다(038_plan_visibility.sql) */
        (s) => copies[SCOPE_PLAN[s]].visible && allows(s, meta),
      )
      const fixed = meta.scope_mode !== 'choice'
      const options = scopes.map((s): ScopeOption => {
        /* 디자이너가 정해지지 않은 폼은 분야 프리미엄만 나간다 */
        const live = categoryPremium(copies, premiums ?? {}, meta, s, ownPrices)
        /* 어드민이 적은 분야 시작가가 이긴다(0011) — 분야마다 금액이 다르게 나가게.
           그 디자이너에게만 적어 둔 금액이 있으면 그것이 또 이긴다(0016).
           둘 다 비어 있으면 디자이너 기본가. 메인 시안은 늘 디자이너 가격 */
        const own = categoryPrice(meta, s, ownPrices)
        const priceLabel = own != null ? `${formatPrice(own)}~` : prices[s]
        const fixedScope = fixed && s !== 'sample' ? s : null
        const label = copies[SCOPE_PLAN[s]].basic.name.trim() || SCOPE_TEXT[s].label
        return {
          key: s,
          /* 이름은 어드민 플랜 이름(plan_copy)을 따른다 — 상세 패널과 같은 이름이어야
             패널에서 고른 유형이 폼에서 다른 이름으로 보이지 않는다. 비어 있을 때만 기본 문구 */
          label,
          fullLabel: fixedScope ? `${meta.name} 의뢰` : `${meta.name} ${label}`,
          desc: fixedScope ? '' : SCOPE_TEXT[s].desc,
          ...(fixedScope ? { title: fixedTitle(meta.name, fixedScope) } : {}),
          priceLabel,
          ...(live ? { premium: { name: live.name, priceLabel: `${formatPrice(live.price)}~` } } : {}),
          sampleOk: s !== 'sample' && priceOf(meta.prices, s, 'basic').allowSample,
        }
      })
      return { name: meta.name, order: sidebar.indexOf(meta.name), options }
    })
    .filter((c) => c.options.length > 0)
}

/* 디자이너가 정해지지 않은 폼(네비바·홈) — 탐색 메뉴에 나오는 분야 전부, 기본 금액 */
export function generalChoices(metas: CategoryMeta[], copies: PlanCopies): CategoryChoice[] {
  return build(
    metas,
    menuCategories(metas),
    { copies },
    {
      sample: `${formatPrice(DEFAULT_DESIGN_PRICE)}~`,
      design: `${formatPrice(DEFAULT_FULL_DESIGN_PRICE)}~`,
      design_dev: `${formatPrice(DEFAULT_PROJECT_PRICE)}~`,
    },
    () => true,
  )
}

/* 디자이너에게 보내는 폼 — 탐색 메뉴에 나오는 분야 중 그 디자이너가 고른 것만, 그 디자이너 가격.
   숨긴 분야는 프로필 표기일 뿐 의뢰 유형이 아니다 — 고르게 두면 메뉴에 없는 유형으로 의뢰가 들어온다.

   어느 범위를 여는지는 designerAllows 가 정한다 — 메인 시안은 어드민 스위치,
   고르는 분야(web/app)의 디자인·프로젝트는 디자이너 스위치, 랜딩·로고처럼 범위가
   정해진 분야는 분야를 고르면 연다.

   고른 분야가 하나도 없으면 탐색 메뉴의 분야를 그 디자이너 가격으로 보여준다 —
   고를 게 없는 폼은 보낼 수 없다. */
export function designerChoices(
  d: DesignerPrices,
  metas: CategoryMeta[],
  source: Source,
): CategoryChoice[] {
  const menu = menuCategories(metas)
  const mine = menu.filter((m) => d.tags.includes(m.name))
  return build(
    metas,
    mine.length > 0 ? mine : menu,
    /* 디자이너에게만 적어 둔 분야 시작가(0016)는 디자이너 줄에 실려 온다 —
       호출부마다 따로 넘기지 않게 */
    { ...source, ownPrices: source.ownPrices ?? d.own_prices },
    {
      sample: formatPriceRange(d.design_price, d.price_max),
      design: `${formatPrice(d.full_design_price)}~`,
      design_dev: `${formatPrice(d.project_price)}~`,
    },
    (s) => designerAllows(d, s),
  )
}

/* 분야별 포함 항목 칸 — 탐색 메뉴에 나오는 분야마다, 그 디자이너가 받는 범위의 목록(0004·0018).
   on 은 디자이너가 그 분야를 골랐는지. 고르지 않은 분야도 칸은 보여준다(비활성).
   사이트에서 숨긴 플랜은 뺀다.
   본계약(디자인만·프로젝트)은 분야마다 한 목록이다 — 같은 디자이너가 맡으니 포함 항목을 나누지 않는다.
     plan 은 그 목록의 열쇠(bucketOf)를 만들 대표 플랜, label 은 두 범위 이름을 잇는다.
     범위가 정해진 분야는 플랜 이름 대신 분야 이름.
   메인화면 먼저 의뢰는 따로 받는 작은 의뢰라 목록이 따로다.
   scope — 이 칸을 건드리면 미리보기가 고를 줄. 본계약은 패널이 처음 고르는 범위(defaultScope)
   premium — 그 목록의 범위 중 하나라도 프리미엄이 나가는지(상세 패널·의뢰 폼과 같은 categoryPremium).
     켜진 칸에만 PREMIUM 열이 생긴다. 프리미엄 정보를 주지 않으면 모두 false */
export type OptionCategory = {
  id: string
  name: string
  on: boolean
  plans: { plan: BucketPlan; scope: InquiryScope; label: string; premium: boolean }[]
}

export function optionCategories(
  d: Pick<DesignerPrices, 'scope_sample' | 'scope_full_design' | 'scope_with_dev' | 'tags'>,
  metas: CategoryMeta[],
  copies: PlanCopies,
  source?: { premiums: DesignerPremiums; ownPrices?: DesignerSpecialtyPrices },
): OptionCategory[] {
  return menuCategories(metas).map((m) => {
    const scopes = designerScopesOf(d, m).filter((s) => copies[SCOPE_PLAN[s]].visible)
    const premiumOf = (s: InquiryScope) =>
      source != null && categoryPremium(copies, source.premiums, m, s, source.ownPrices) != null
    const labelOf = (s: InquiryScope) => {
      const plan = SCOPE_PLAN[s] as BucketPlan
      return m.scope_mode !== 'choice' && s !== 'sample'
        ? fixedTitle(m.name, s === 'design_dev' ? 'design_dev' : 'design')
        : copies[plan].basic.name.trim() || SCOPE_TEXT[s].label
    }

    const main = scopes.filter((s) => s !== 'sample')
    const plans: OptionCategory['plans'] = []
    if (scopes.includes('sample')) {
      plans.push({ plan: 'sample', scope: 'sample', label: labelOf('sample'), premium: premiumOf('sample') })
    }
    if (main.length > 0) {
      plans.push({
        plan: SCOPE_PLAN[main[0]] as BucketPlan,
        scope: defaultScope(main) ?? main[0],
        label: main.map(labelOf).join(' · '),
        premium: main.some(premiumOf),
      })
    }
    return { id: m.id, name: m.name, on: d.tags.includes(m.name), plans }
  })
}

