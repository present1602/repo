import 'server-only'
import { supabaseAdmin } from './supabase-admin'
import {
  COMMON_BUCKET,
  MAX_CUSTOM_PER_BUCKET,
  MAX_CUSTOM_TEXT,
  MAX_OPTION_N,
  isBucket,
  needsN,
  templateAllows,
  templateAllowsBucket,
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
    /* 유형별 프리미엄 스위치는 뺐다(늘 켜짐) — 디자이너별 프리미엄만 본다 */
    const [{ data: mine }] = await Promise.all([
      requireAccepted
        ? db
            .from('designer_premium_prices')
            .select('enabled')
            .eq('designer_id', designerId)
            .eq('plan', scope)
            .maybeSingle()
        : Promise.resolve({ data: { enabled: true } }),
    ])
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
   공통 + 이 디자이너 전용만 고를 수 있다 — 다른 디자이너의 전용 항목은 안 된다.

   emptyN — {n} 항목을 숫자 없이 체크한 채로 둘 수 있는지. 기본 단계 목록은 체크하는 순간
   저장되므로 숫자를 적기 전 상태도 받는다. 숫자가 없으면 공개 화면에 나가지 않는다(plans.ts) */
async function checkOptions(
  designerId: string,
  options: RegisteredOption[],
  allows: (t: OptionTemplate) => boolean,
  emptyN = false,
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
    if (needsN(t.template) && !(emptyN && o.n == null)) {
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
   받은 목록이 그 자리의 전부다. 분야를 아직 고르지 않았어도 미리 채워 둘 수 있다.

   공통과 개별은 겹치지 않는다 — 개별 목록에는 공통에 없는 템플릿만 들어가고,
   공통에 새로 체크한 템플릿은 개별 목록들에서 빠진다(공통으로 옮겨 간다). */
export async function replaceBucketOptions(
  designerId: string,
  bucket: string,
  options: RegisteredOption[],
): Promise<string | null> {
  if (!isBucket(bucket)) return '알 수 없는 포함 항목 자리입니다.'
  const db = supabaseAdmin!

  const checkedAll = await checkOptions(designerId, options, (t) => templateAllowsBucket(t, bucket), true)
  if (typeof checkedAll === 'string') return checkedAll

  let checked = checkedAll
  if (bucket !== COMMON_BUCKET) {
    const { data, error: readErr } = await db
      .from('designer_category_options')
      .select('template_id')
      .eq('designer_id', designerId)
      .eq('bucket', COMMON_BUCKET)
    if (readErr) {
      console.error('[plan-options] 공통 항목 조회 실패:', readErr.message)
      return readErr.message.includes('designer_category_options') ? NO_TABLE : '저장에 실패했습니다.'
    }
    const common = new Set(((data ?? []) as { template_id: string }[]).map((r) => r.template_id))
    checked = checkedAll.filter((o) => !common.has(o.templateId))
  }

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

  if (bucket === COMMON_BUCKET && checked.length > 0) {
    const { error: moveErr } = await db
      .from('designer_category_options')
      .delete()
      .eq('designer_id', designerId)
      .neq('bucket', COMMON_BUCKET)
      .in(
        'template_id',
        checked.map((o) => o.templateId),
      )
    if (moveErr) console.error('[plan-options] 개별 목록에서 공통 항목 빼기 실패:', moveErr.message)
  }
  return null
}

const NO_CUSTOM_TABLE = '직접 입력 표가 아직 없습니다. 0005_custom_options.sql 을 먼저 적용해 주세요.'

/* 직접 적은 포함 항목 하나를 더한다(0005) — 그 목록(공통 또는 의뢰 유형 하나)에만 들어간다.
   같은 글이 이미 있거나 한 목록에 너무 많으면 막는다.

   공통과 개별은 겹치지 않는다 — 공통에 있는 글은 개별에 더할 수 없고,
   공통에 더한 글은 개별 목록들에서 빠진다(공통으로 옮겨 간다). */
export async function addCustomOption(designerId: string, bucket: string, raw: string): Promise<string | null> {
  if (!isBucket(bucket)) return '알 수 없는 포함 항목 자리입니다.'
  const text = raw.trim().replace(/\s+/g, ' ')
  if (!text) return '항목을 입력해 주세요.'
  if (text.length > MAX_CUSTOM_TEXT) return `항목은 ${MAX_CUSTOM_TEXT}자 이내로 입력해 주세요.`
  const db = supabaseAdmin!

  const { data, error: readErr } = await db
    .from('designer_custom_options')
    .select('bucket, text')
    .eq('designer_id', designerId)
    .in('bucket', [...new Set([bucket, COMMON_BUCKET])])
  if (readErr) {
    console.error('[plan-options] 직접 입력 조회 실패:', readErr.message)
    return readErr.message.includes('designer_custom_options') ? NO_CUSTOM_TABLE : '저장에 실패했습니다.'
  }
  const rows = (data ?? []) as { bucket: string; text: string }[]
  const mine = rows.filter((r) => r.bucket === bucket)
  if (mine.some((r) => r.text === text)) return '이미 있는 항목입니다.'
  if (bucket !== COMMON_BUCKET && rows.some((r) => r.bucket === COMMON_BUCKET && r.text === text)) {
    return '공통 항목에 이미 있는 항목입니다.'
  }
  if (mine.length >= MAX_CUSTOM_PER_BUCKET) {
    return `직접 입력은 한 목록에 ${MAX_CUSTOM_PER_BUCKET}개까지 더할 수 있습니다.`
  }

  const { error } = await db.from('designer_custom_options').insert({ designer_id: designerId, bucket, text })
  if (error) {
    console.error('[plan-options] 직접 입력 저장 실패:', error.message)
    return '저장에 실패했습니다.'
  }

  if (bucket === COMMON_BUCKET) {
    const { error: moveErr } = await db
      .from('designer_custom_options')
      .delete()
      .eq('designer_id', designerId)
      .neq('bucket', COMMON_BUCKET)
      .eq('text', text)
    if (moveErr) console.error('[plan-options] 개별 목록에서 공통 항목 빼기 실패:', moveErr.message)
  }
  return null
}

/* 직접 적은 항목 하나를 지운다 — 그 디자이너의 것만 */
export async function removeCustomOption(designerId: string, id: string): Promise<string | null> {
  const { error } = await supabaseAdmin!
    .from('designer_custom_options')
    .delete()
    .eq('designer_id', designerId)
    .eq('id', id)
  if (error) {
    console.error('[plan-options] 직접 입력 지우기 실패:', error.message)
    return '삭제에 실패했습니다.'
  }
  return null
}
