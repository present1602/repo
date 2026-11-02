import 'server-only'
import { supabaseAdmin } from './supabase-admin'
import {
  MAX_OPTION_N,
  needsN,
  templateAllows,
  type OptionTemplate,
  type PlanSlot,
  type PlanTier,
  type RegisteredOption,
} from './plans'
import { isPlanSlot } from './plans'
import { listOptionTemplates } from './site-settings'
import { acceptsScope, type Scope } from './scopes'

/* 디자이너가 플랜 하나에 등록하는 포함 항목 — 어드민 화면과 디자이너 스튜디오가 함께 쓴다.

   검사는 여기 한곳에서 한다. 서버 액션은 누구나 부를 수 있으므로 화면이 막았어도
   다시 본다: 템플릿이 있는지, 그 플랜에서 고를 수 있는지, {n} 이면 숫자가 있는지. */

/* 이 디자이너가 이 플랜에 항목을 등록할 수 있는가.
   기본은 받는 유형이어야 하고, 프리미엄은 유형 전체·디자이너별 스위치가 모두 켜져야 한다.
   어드민은 받지 않는 유형도 미리 채워 둘 수 있게 requireAccepted 를 끈다. */
export async function slotOpenFor(
  designerId: string,
  scope: Scope,
  tier: PlanTier,
  { requireAccepted }: { requireAccepted: boolean },
): Promise<string | null> {
  const db = supabaseAdmin!

  if (requireAccepted) {
    const { data: d } = await db
      .from('designers')
      .select('scope_sample, scope_logo, scope_full_design, scope_with_dev')
      .eq('id', designerId)
      .maybeSingle()
    if (!d || !acceptsScope(d as Parameters<typeof acceptsScope>[0], scope)) {
      return '받지 않는 의뢰 유형입니다.'
    }
  }

  if (tier === 'premium') {
    const [{ data: copy }, { data: mine }] = await Promise.all([
      db.from('plan_copy').select('enabled').eq('plan', scope).eq('tier', 'premium').maybeSingle(),
      requireAccepted
        ? db
            .from('designer_premium_prices')
            .select('enabled')
            .eq('designer_id', designerId)
            .eq('plan', scope)
            .maybeSingle()
        : Promise.resolve({ data: { enabled: true } }),
    ])
    if (!copy?.enabled) return '이 플랜에는 프리미엄이 없습니다.'
    if (!mine?.enabled) return '이 디자이너의 프리미엄이 꺼져 있습니다.'
  }
  return null
}

/* 플랜 하나의 등록 항목을 통째로 바꾼다 — 받은 목록이 그 플랜의 전부다.
   잘못된 것이 하나라도 있으면 아무것도 바꾸지 않고 이유를 돌려준다. */
export async function replaceSlotOptions(
  designerId: string,
  slot: PlanSlot,
  options: RegisteredOption[],
): Promise<string | null> {
  if (!isPlanSlot(slot)) return '알 수 없는 플랜입니다.'
  const db = supabaseAdmin!
  const [plan, tier] = slot.split(':') as [Scope, PlanTier]

  /* 공통 + 이 디자이너 전용만 — 다른 디자이너의 전용 항목은 고를 수 없다 */
  const templates = new Map<string, OptionTemplate>(
    (await listOptionTemplates({ designerId })).map((t) => [t.id, t]),
  )

  const rows: { designer_id: string; plan: Scope; tier: PlanTier; template_id: string; n: number | null }[] =
    []
  const seen = new Set<string>()
  for (const o of options) {
    if (seen.has(o.templateId)) continue
    seen.add(o.templateId)

    const t = templates.get(o.templateId)
    if (!t) return '없는 항목이 섞여 있습니다. 새로고침 후 다시 시도해 주세요.'
    if (!templateAllows(t, slot)) return `'${t.template}'은 이 플랜에서 고를 수 없습니다.`

    let n: number | null = null
    if (needsN(t.template)) {
      if (o.n == null || !Number.isInteger(o.n) || o.n < 0 || o.n > MAX_OPTION_N) {
        return `'${t.template}'의 숫자를 0~${MAX_OPTION_N} 사이로 적어 주세요.`
      }
      n = o.n
    }
    rows.push({ designer_id: designerId, plan, tier, template_id: t.id, n })
  }

  const { error: delErr } = await db
    .from('designer_plan_options')
    .delete()
    .eq('designer_id', designerId)
    .eq('plan', plan)
    .eq('tier', tier)
  if (delErr) {
    console.error('[plan-options] 등록 항목 지우기 실패:', delErr.message)
    if (delErr.message.includes('designer_plan_options')) {
      return '포함 항목 표가 아직 없습니다. 037_plan_details.sql 을 먼저 적용해 주세요.'
    }
    return '저장에 실패했습니다.'
  }

  if (rows.length > 0) {
    const { error } = await db.from('designer_plan_options').insert(rows)
    if (error) {
      console.error('[plan-options] 등록 항목 저장 실패:', error.message)
      return '저장에 실패했습니다.'
    }
  }
  return null
}
