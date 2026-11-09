/* 디자이너 상세 오른쪽 의뢰 패널의 줄들 — 상세 페이지와 스튜디오 미리보기가 같이 쓴다.
   미리보기는 아직 저장하지 않은 포함 항목(setup)을 넣어 같은 모양을 그린다.

   클라이언트 컴포넌트도 쓰므로 server-only 모듈에 두지 않는다. */

import type { PanelEntry } from '@/components/plan-panel'
import {
  bucketOf,
  COMMON_BUCKET,
  formatPrice,
  needsN,
  optionText,
  resolveTier,
  slotOf,
  templateAllows,
  templateAllowsBucket,
  tierPicksOf,
  type BucketPlan,
  type DesignerOptionSetup,
  type DesignerPlanDetails,
  type DesignerPlanOptions,
  type DesignerPremiums,
  type OptionTemplate,
  type PlanCopies,
  type PlanTier,
} from './plans'
import { SCOPE_PLAN, categoryPremium, type CategoryChoice, type CategoryMeta } from './inquiry-choices'

export type PanelSource = {
  /* 의뢰 폼과 같은 선택지(designerChoices) */
  choices: CategoryChoice[]
  metas: CategoryMeta[]
  copies: PlanCopies
  premiums: DesignerPremiums
  planDetails: DesignerPlanDetails
  showDuration: boolean
  templates: OptionTemplate[]
  /* 0017 전 프리미엄 단계 항목, 0004 전이면 기본 단계도 여기서 */
  planOptions: DesignerPlanOptions
  /* null 이면 0004 전 */
  optionSetup: DesignerOptionSetup | null
}

/* 포함 항목 한 줄 — 단계마다 체크 여부와 숫자만 다르고 줄은 같다(0017).
   text 는 그 단계에서 보일 글(체크 안 했거나 숫자가 비었으면 null),
   label 은 그 단계에 없을 때 흐리게 보일 이름 — 숫자 항목은 단계마다 다른 값이라 두지 않는다 */
type Row = { key: string; text: string | null; label: string | null }

/* 한 단계의 포함 항목 줄 — 공통 목록 다음에 그 분야 목록(본계약은 디자인만·프로젝트가 한 목록, 0018).
   목록마다 템플릿 항목(템플릿 차례), 직접 적은 항목 차례.
   어느 줄을 고를 수 있는지는 두 단계 모두 같게 본다(같은 줄을 나눠 쓴다) — 공통은 그 플랜의 기본 칸,
   분야 목록은 편집 화면과 같은 기준(templateAllowsBucket) */
function setupRows(
  setup: DesignerOptionSetup,
  tier: PlanTier,
  plan: BucketPlan,
  categoryId: string | undefined,
  templates: OptionTemplate[],
): Row[] {
  const slot = slotOf(plan, 'basic')
  const buckets = [COMMON_BUCKET, ...(categoryId ? [bucketOf(categoryId, plan)] : [])]
  return buckets.flatMap((b) => {
    const mine = new Map(tierPicksOf(setup, tier, b).map((o) => [o.templateId, o.n]))
    const fromTemplates = templates
      .filter((t) => (b === COMMON_BUCKET ? templateAllows(t, slot) : templateAllowsBucket(t, b)))
      .map((t): Row => {
        const n = mine.get(t.id) ?? null
        const shown = mine.has(t.id) && !(needsN(t.template) && n == null)
        return {
          key: `t:${t.id}`,
          text: shown ? optionText(t.template, needsN(t.template) ? n : null) : null,
          label: needsN(t.template) ? null : t.template,
        }
      })
    const fromCustom = (setup.custom[b] ?? []).map(
      (c): Row => ({ key: `c:${c.id}`, text: c[tier] ? c.text : null, label: c.text }),
    )
    return [...fromTemplates, ...fromCustom]
  })
}

/* 보일 항목 — 같은 글이 두 목록에 있으면 한 번만 */
function itemsOf(rows: Row[]): string[] {
  return [...new Set(rows.flatMap((r) => (r.text ? [r.text] : [])))]
}

/* 이 단계에는 없고 다른 단계에는 있는 줄 — STANDARD·PREMIUM 을 견줄 때 흐리게 보인다 */
function missingOf(mine: Row[], other: Row[], items: string[]): string[] {
  const has = new Set(mine.filter((r) => r.text).map((r) => r.key))
  const out = other.flatMap((r) => (r.text && r.label && !has.has(r.key) ? [r.label] : []))
  return [...new Set(out)].filter((l) => !items.includes(l))
}

/* 의뢰 패널 — 의뢰 폼과 같은 선택지(분야 × 범위), 같은 차례·같은 금액으로.
   이름·설명·기간은 어드민 설정의 공통값에 디자이너별 덮어쓰기를 얹는다.
   포함 항목은 디자이너가 등록한 것만 나간다(처음엔 비어 있다) —
     공통 목록 다음에 그 분야·범위의 개별 목록(0005). 목록마다 템플릿 항목, 직접 적은 항목 차례.
     고객에게는 출처 구분 없이 같은 한 줄로 보인다. 같은 글이 두 목록에 있으면 한 번만.
     0004 전이면 예전 플랜별 목록의 기본 칸.
   프리미엄은 유형 전체·디자이너별·분야의 범위별 스위치가 모두 켜졌을 때만(categoryPremium).
     항목은 같은 목록의 PREMIUM 체크(0017), 그 전이면 예전 플랜별 목록에서. */
export function panelEntries(src: PanelSource): PanelEntry[] {
  const { choices, metas, copies, premiums, planDetails, showDuration, templates, planOptions, optionSetup } = src

  const durationOf = (plan: BucketPlan, tier: PlanTier) =>
    resolveTier(copies[plan][tier], planDetails[plan]?.[tier], showDuration, slotOf(plan, tier), [], undefined)
      .duration

  /* 예전 플랜별 목록에서 — 0004 전 기본, 0017 전 프리미엄 */
  const legacyItems = (plan: BucketPlan, tier: PlanTier) =>
    resolveTier(copies[plan][tier], undefined, false, slotOf(plan, tier), templates, planOptions[slotOf(plan, tier)])
      .items

  const metaOf = new Map(metas.map((m) => [m.name, m]))

  return choices.flatMap((c) =>
    c.options.map((o): PanelEntry => {
      const plan = SCOPE_PLAN[o.key] as BucketPlan
      const categoryId = metaOf.get(c.name)?.id
      /* 의뢰 폼과 같은 프리미엄 — 선택지(designerChoices)가 분야의 범위별 스위치와
         이 디자이너에게만 적어 둔 금액(0016)까지 보고 정한 것을 그대로 쓴다.
         선택지 없이 만든 줄(예전 호출)만 여기서 다시 계산한다 */
      const live = o.premium
        ? { name: o.premium.name, desc: copies[plan].premium.desc, priceLabel: o.premium.priceLabel }
        : (() => {
            const p = categoryPremium(copies, premiums, metaOf.get(c.name), o.key)
            return p ? { name: p.name, desc: p.desc, priceLabel: `${formatPrice(p.price)}~` } : null
          })()

      const basicRows = optionSetup ? setupRows(optionSetup, 'basic', plan, categoryId, templates) : null
      const premiumRows =
        live && optionSetup?.premium ? setupRows(optionSetup, 'premium', plan, categoryId, templates) : null

      const basicItems = basicRows ? itemsOf(basicRows) : legacyItems(plan, 'basic')
      const premiumItems = premiumRows ? itemsOf(premiumRows) : live ? legacyItems(plan, 'premium') : []

      /* 두 단계를 같은 줄로 견줄 수 있을 때만(0017) 빠진 줄을 적는다 */
      const compare = basicRows && premiumRows

      /* 의뢰 폼과 같은 한 줄 이름 — 'web/app 디자인 의뢰', '랜딩페이지 의뢰' */
      const name = o.fullLabel
      return {
        key: `${c.name}:${o.key}`,
        category: c.name,
        scope: o.key,
        sampleOk: o.sampleOk,
        basic: {
          name,
          /* 범위가 정해진 분야는 플랜 설명 대신 비운다 — 로고에 '서비스 전체 디자인' 설명이 붙지 않게 */
          desc: o.title ? '' : copies[plan].basic.desc,
          priceLabel: o.priceLabel,
          duration: durationOf(plan, 'basic'),
          items: basicItems,
          missing: compare ? missingOf(basicRows, premiumRows, basicItems) : [],
        },
        ...(live
          ? {
              premium: {
                name: live.name,
                desc: live.desc,
                priceLabel: live.priceLabel,
                duration: durationOf(plan, 'premium'),
                items: premiumItems,
                missing: compare ? missingOf(premiumRows, basicRows, premiumItems) : [],
              },
            }
          : {}),
      }
    }),
  )
}
