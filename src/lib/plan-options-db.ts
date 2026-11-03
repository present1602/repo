import 'server-only'
import { supabaseAdmin } from './supabase-admin'
import {
  COMMON_BUCKET,
  MAX_OPTION_N,
  isBucket,
  isOptionsMode,
  needsN,
  templateAllows,
  templateAllowsBucket,
  type OptionsMode,
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

  const checked = await checkOptions(designerId, options, (t) => templateAllows(t, slot))
  if (typeof checked === 'string') return checked
  const rows = checked.map((o) => ({ designer_id: designerId, plan, tier, template_id: o.templateId, n: o.n }))

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

/* 받은 항목을 검사해 저장할 모양으로 — 잘못된 것이 하나라도 있으면 이유(글자)를 돌려준다.
   공통 + 이 디자이너 전용만 고를 수 있다 — 다른 디자이너의 전용 항목은 안 된다. */
async function checkOptions(
  designerId: string,
  options: RegisteredOption[],
  allows: (t: OptionTemplate) => boolean,
): Promise<RegisteredOption[] | string> {
  const templates = new Map<string, OptionTemplate>(
    (await listOptionTemplates({ designerId })).map((t) => [t.id, t]),
  )

  const out: RegisteredOption[] = []
  const seen = new Set<string>()
  for (const o of options) {
    if (seen.has(o.templateId)) continue
    seen.add(o.templateId)

    const t = templates.get(o.templateId)
    if (!t) return '없는 항목이 섞여 있습니다. 새로고침 후 다시 시도해 주세요.'
    if (!allows(t)) return `'${t.template}'은 이 플랜에서 고를 수 없습니다.`

    let n: number | null = null
    if (needsN(t.template)) {
      if (o.n == null || !Number.isInteger(o.n) || o.n < 0 || o.n > MAX_OPTION_N) {
        return `'${t.template}'의 숫자를 0~${MAX_OPTION_N} 사이로 적어 주세요.`
      }
      n = o.n
    }
    out.push({ templateId: t.id, n })
  }
  return out
}

const NO_TABLE = '포함 항목 표가 아직 없습니다. 0004_plan_options_by_category.sql 을 먼저 적용해 주세요.'

/* 기본 단계 포함 항목 한 목록(공통 또는 분야·범위 하나)을 통째로 바꾼다(0004).
   받은 목록이 그 자리의 전부다. 분야를 아직 고르지 않았어도 미리 채워 둘 수 있다. */
export async function replaceBucketOptions(
  designerId: string,
  bucket: string,
  options: RegisteredOption[],
): Promise<string | null> {
  if (!isBucket(bucket)) return '알 수 없는 포함 항목 자리입니다.'
  const db = supabaseAdmin!

  const checked = await checkOptions(designerId, options, (t) => templateAllowsBucket(t, bucket))
  if (typeof checked === 'string') return checked

  const { error: delErr } = await db
    .from('designer_category_options')
    .delete()
    .eq('designer_id', designerId)
    .eq('bucket', bucket)
  if (delErr) {
    console.error('[plan-options] 포함 항목 지우기 실패:', delErr.message)
    return delErr.message.includes('designer_category_options') ? NO_TABLE : '저장에 실패했습니다.'
  }

  if (checked.length > 0) {
    const { error } = await db.from('designer_category_options').insert(
      checked.map((o) => ({ designer_id: designerId, bucket, template_id: o.templateId, n: o.n })),
    )
    if (error) {
      console.error('[plan-options] 포함 항목 저장 실패:', error.message)
      return '저장에 실패했습니다.'
    }
  }
  return null
}

/* 포함 항목 방식을 바꾼다. 분야별로 바꿀 때는 아직 비어 있는 분야 칸(seed)에
   공통 목록을 복사해 둔다 — 빈 화면에서 다시 시작하지 않게. 이미 채운 칸은 건드리지 않는다. */
export async function saveOptionsMode(
  designerId: string,
  mode: OptionsMode,
  seed: string[],
): Promise<string | null> {
  if (!isOptionsMode(mode)) return '알 수 없는 방식입니다.'
  const db = supabaseAdmin!

  const { error } = await db.from('designers').update({ plan_options_mode: mode }).eq('id', designerId)
  if (error) {
    console.error('[plan-options] 포함 항목 방식 저장 실패:', error.message)
    return error.message.includes('plan_options_mode') ? NO_TABLE : '저장에 실패했습니다.'
  }

  const targets = [...new Set(seed)].filter((b) => isBucket(b) && b !== COMMON_BUCKET)
  if (mode !== 'by_category' || targets.length === 0) return null

  const { data, error: readErr } = await db
    .from('designer_category_options')
    .select('bucket, template_id, n')
    .eq('designer_id', designerId)
  if (readErr) {
    console.error('[plan-options] 포함 항목 조회 실패:', readErr.message)
    return null
  }

  const rows = (data ?? []) as { bucket: string; template_id: string; n: number | null }[]
  const filled = new Set(rows.map((r) => r.bucket))
  const common = rows.filter((r) => r.bucket === COMMON_BUCKET)
  const copies = targets
    .filter((b) => !filled.has(b))
    .flatMap((bucket) => common.map((r) => ({ designer_id: designerId, bucket, template_id: r.template_id, n: r.n })))

  if (copies.length > 0) {
    const { error: insErr } = await db.from('designer_category_options').upsert(copies, {
      onConflict: 'designer_id,bucket,template_id',
      ignoreDuplicates: true,
    })
    if (insErr) console.error('[plan-options] 공통 항목 복사 실패:', insErr.message)
  }
  return null
}
