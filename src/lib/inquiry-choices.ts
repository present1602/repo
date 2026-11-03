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
  type DesignerPremiums,
  type PlanCopies,
} from './plans'
import type { InquiryType } from './inquiry-types'
import type { Scope } from './scopes'
import type { SpecialtyScopeMode } from './specialty-shape'

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
const SCOPE_PLAN: Record<InquiryScope, Scope> = {
  sample: 'sample',
  design: 'full_design',
  design_dev: 'with_dev',
}

const SCOPE_TEXT: Record<InquiryScope, { label: string; desc: string }> = {
  sample: {
    label: '메인 시안 먼저 의뢰',
    desc: '메인 화면 시안만 먼저 받고 본계약을 결정해요. 본계약으로 이어지면 먼저 낸 금액은 빠져요.',
  },
  design: { label: '디자인만 의뢰', desc: '디자인까지 맡겨요. 개발은 직접 하거나 따로 맡겨요.' },
  design_dev: { label: '디자인 + 개발 의뢰', desc: 'SOOM 개발자가 팀이 되어 실제 서비스로 만들어요.' },
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
  priceLabel: string
  /* 유형 전체·디자이너별 프리미엄이 모두 켜졌을 때만 */
  premium?: { name: string; priceLabel: string }
}

export type CategoryChoice = {
  name: string
  /* 고를 수 있는 범위 — 하나면 묻지 않고 한 줄로 보여준다 */
  options: ScopeOption[]
}

/* 분야 한 줄 — 서버가 specialties 에서 읽어 넘긴다 */
export type CategoryMeta = {
  name: string
  visible: boolean
  scope_mode: SpecialtyScopeMode
  allow_sample: boolean
  price_from: number | null
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
  | 'scope_with_dev'
  | 'tags'
>

type Source = { copies: PlanCopies; premiums?: DesignerPremiums }

function build(
  metas: CategoryMeta[],
  { copies, premiums }: Source,
  prices: Record<InquiryScope, string>,
  allows: (scope: InquiryScope, meta: CategoryMeta) => boolean,
): CategoryChoice[] {
  return metas
    .map((meta) => {
      const scopes = scopesOf(meta).filter(
        /* 사이트에서 숨긴 플랜의 범위는 뺀다(038_plan_visibility.sql) */
        (s) => copies[SCOPE_PLAN[s]].visible && allows(s, meta),
      )
      const fixed = meta.scope_mode !== 'choice'
      const options = scopes.map((s): ScopeOption => {
        const live = premiums ? livePremium(copies, premiums, SCOPE_PLAN[s]) : null
        /* 범위가 정해진 분야는 어드민이 적은 분야 시작가가 이긴다 — 랜딩·로고가
           웹·앱 프로젝트 가격으로 보이지 않게. 메인 시안은 늘 디자이너 가격 */
        const priceLabel =
          fixed && s !== 'sample' && meta.price_from != null
            ? `${formatPrice(meta.price_from)}~`
            : prices[s]
        const fixedScope = fixed && s !== 'sample' ? s : null
        return {
          key: s,
          /* 이름은 어드민 플랜 이름(plan_copy)을 따른다 — 상세 패널과 같은 이름이어야
             패널에서 고른 유형이 폼에서 다른 이름으로 보이지 않는다. 비어 있을 때만 기본 문구 */
          label: copies[SCOPE_PLAN[s]].basic.name.trim() || SCOPE_TEXT[s].label,
          desc: fixedScope ? '' : SCOPE_TEXT[s].desc,
          ...(fixedScope ? { title: fixedTitle(meta.name, fixedScope) } : {}),
          priceLabel,
          ...(live ? { premium: { name: live.name, priceLabel: `${formatPrice(live.price)}~` } } : {}),
        }
      })
      return { name: meta.name, options }
    })
    .filter((c) => c.options.length > 0)
}

/* 디자이너가 정해지지 않은 폼(네비바·홈) — 탐색 메뉴에 나오는 분야 전부, 기본 금액 */
export function generalChoices(metas: CategoryMeta[], copies: PlanCopies): CategoryChoice[] {
  return build(
    metas.filter((m) => m.visible),
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

   분야를 고르면 그 분야 의뢰는 받는다 — 디자인은 늘 연다.
   메인 시안은 디자이너 스위치(scope_sample, 허용 분야는 public-designers.ts 가 이미 거름),
   고르는 분야의 디자인 + 개발은 어드민 승인(scope_with_dev)이 있어야 연다.
   랜딩처럼 디자인 + 개발로 정해진 분야는 승인 없이 연다 — 개발은 SOOM 이 이어받는다.

   고른 분야가 하나도 없으면 탐색 메뉴의 분야를 그 디자이너 가격으로 보여준다 —
   고를 게 없는 폼은 보낼 수 없다. */
export function designerChoices(
  d: DesignerPrices,
  metas: CategoryMeta[],
  source: Source,
): CategoryChoice[] {
  const menu = metas.filter((m) => m.visible)
  const mine = menu.filter((m) => d.tags.includes(m.name))
  return build(
    mine.length > 0 ? mine : menu,
    source,
    {
      sample: formatPriceRange(d.design_price, d.price_max),
      design: `${formatPrice(d.full_design_price)}~`,
      design_dev: `${formatPrice(d.project_price)}~`,
    },
    (s, meta) => {
      if (s === 'sample') return d.scope_sample
      if (s === 'design_dev') return meta.scope_mode === 'design_dev' || d.scope_with_dev
      return true
    },
  )
}
