/* 디자이너 상세 오른쪽 의뢰 패널의 줄들 — 상세 페이지와 스튜디오 미리보기가 같이 쓴다.
   미리보기는 아직 저장하지 않은 포함 항목(setup)을 넣어 같은 모양을 그린다.

   클라이언트 컴포넌트도 쓰므로 server-only 모듈에 두지 않는다. */

import type { PanelEntry } from '@/components/plan-panel'
import {
  bucketOf,
  COMMON_BUCKET,
  formatPrice,
  livePremium,
  resolveTier,
  slotOf,
  type BucketPlan,
  type DesignerOptionSetup,
  type DesignerPlanDetails,
  type DesignerPlanOptions,
  type DesignerPremiums,
  type OptionTemplate,
  type PlanCopies,
  type RegisteredOption,
} from './plans'
import { SCOPE_PLAN, type CategoryChoice, type CategoryMeta } from './inquiry-choices'

export type PanelSource = {
  /* 의뢰 폼과 같은 선택지(designerChoices) */
  choices: CategoryChoice[]
  metas: CategoryMeta[]
  copies: PlanCopies
  premiums: DesignerPremiums
  planDetails: DesignerPlanDetails
  showDuration: boolean
  templates: OptionTemplate[]
  /* 프리미엄 단계 항목, 0004 전이면 기본 단계도 여기서 */
  planOptions: DesignerPlanOptions
  /* null 이면 0004 전 */
  optionSetup: DesignerOptionSetup | null
}

/* 의뢰 패널 — 의뢰 폼과 같은 선택지(분야 × 범위), 같은 차례·같은 금액으로.
   이름·설명·기간은 어드민 설정의 공통값에 디자이너별 덮어쓰기를 얹는다.
   포함 항목은 디자이너가 등록한 것만 나간다(처음엔 비어 있다) —
     공통 목록 다음에 그 분야·범위의 개별 목록(0005). 목록마다 템플릿 항목, 직접 적은 항목 차례.
     고객에게는 출처 구분 없이 같은 한 줄로 보인다. 같은 글이 두 목록에 있으면 한 번만.
     0004 전이면 예전 플랜별 목록의 기본 칸.
   프리미엄은 유형 전체·디자이너별 스위치가 모두 켜졌을 때만, 항목은 플랜별 목록에서. */
export function panelEntries(src: PanelSource): PanelEntry[] {
  const { choices, metas, copies, premiums, planDetails, showDuration, templates, planOptions, optionSetup } = src

  const basicTier = (plan: BucketPlan, categoryId: string | undefined) => {
    const slot = slotOf(plan, 'basic')
    const tier = (registered: RegisteredOption[] | undefined) =>
      resolveTier(copies[plan].basic, planDetails[plan]?.basic, showDuration, slot, templates, registered)
    if (!optionSetup) return tier(planOptions[slot])

    const buckets = [COMMON_BUCKET, ...(categoryId ? [bucketOf(categoryId, plan)] : [])]
    const items = buckets.flatMap((b) => [
      ...tier(optionSetup.buckets[b]).items,
      ...(optionSetup.custom[b] ?? []).map((c) => c.text),
    ])
    return { duration: tier(undefined).duration, items: [...new Set(items)] }
  }

  const metaOf = new Map(metas.map((m) => [m.name, m]))
  /* 고객이 범위를 고르는 분야가 둘 이상이면 같은 플랜 이름이 겹친다 — 그때만 분야 이름을 앞에 붙인다 */
  const choiceCount = choices.filter((c) => metaOf.get(c.name)?.scope_mode === 'choice').length

  return choices.flatMap((c) =>
    c.options.map((o): PanelEntry => {
      const plan = SCOPE_PLAN[o.key] as BucketPlan
      const basic = basicTier(plan, metaOf.get(c.name)?.id)
      const live = livePremium(copies, premiums, plan)
      const premium = live
        ? resolveTier(
            copies[plan].premium,
            planDetails[plan]?.premium,
            showDuration,
            slotOf(plan, 'premium'),
            templates,
            planOptions[slotOf(plan, 'premium')],
          )
        : null
      const name = o.title ?? (choiceCount > 1 ? `${c.name} · ${o.label}` : o.label)
      return {
        key: `${c.name}:${o.key}`,
        category: c.name,
        scope: o.key,
        /* 범위가 정해진 분야는 플랜 설명 대신 비운다 — 로고에 '서비스 전체 디자인' 설명이 붙지 않게 */
        basic: { name, desc: o.title ? '' : copies[plan].basic.desc, priceLabel: o.priceLabel, ...basic },
        ...(live && premium
          ? {
              premium: {
                name: live.name,
                desc: live.desc,
                priceLabel: `${formatPrice(live.price)}~`,
                ...premium,
              },
            }
          : {}),
      }
    }),
  )
}
