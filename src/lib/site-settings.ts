import 'server-only'
import { supabaseAdmin } from './supabase-admin'
import {
  FALLBACK_PLAN_COPIES,
  isBucket,
  isPlanSlot,
  type DesignerOptionSetup,
  type DesignerPlanDetails,
  type DesignerPlanOptions,
  type OptionTemplate,
  type PlanSlot,
  type DesignerPremiums,
  type PlanCopies,
  type PlanTier,
  type RegisteredOption,
} from './plans'
import { isScope, type Scope } from './scopes'

/* 사이트 전역 설정 — 플랜 문구와 화면 스위치.
   site_settings 는 한 줄짜리 테이블이다(id = true). */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type CopyRow = {
  plan: string
  tier: string
  name: string
  description: string
  enabled?: boolean
  duration?: string
  visible?: boolean
}

/* 마이그레이션 판마다 없는 칸 — 실패 메시지에 이름이 나오면 그것만 빼고 다시 묻는다.
   036 의 이전 판에는 enabled 가, 037 전에는 duration 이, 038 전에는 visible 이 없다. */
const OPTIONAL_COPY_COLS = ['visible', 'duration', 'enabled']

/* 플랜 문구 — 유형 × 단계마다 한 줄(036_plan_copy_premium.sql),
   작업 기간(037_plan_details.sql)까지.
   빠진 줄은 기본 문구로 메운다 — 표가 비어도 카드 제목이 사라지지 않게. */
export async function getPlanCopies(): Promise<PlanCopies> {
  if (!supabaseAdmin) return FALLBACK_PLAN_COPIES
  const db = supabaseAdmin

  let cols = ['plan', 'tier', 'name', 'description', ...OPTIONAL_COPY_COLS]
  let r = await db.from('plan_copy').select(cols.join(', '))
  for (const c of OPTIONAL_COPY_COLS) {
    if (!r.error?.message.includes(c)) continue
    cols = cols.filter((x) => x !== c)
    r = await db.from('plan_copy').select(cols.join(', '))
  }

  if (r.error) {
    /* 마이그레이션 전이거나 조회 실패 — 화면이 비는 것보다 기본 문구가 낫다 */
    console.error('[settings] 플랜 문구 조회 실패:', r.error.message)
    return FALLBACK_PLAN_COPIES
  }

  /* 새 객체로 만든다 — 기본값 객체를 그대로 고쳐 쓰면 다음 요청에 섞인다 */
  const copies = Object.fromEntries(
    Object.entries(FALLBACK_PLAN_COPIES).map(([plan, t]) => [
      plan,
      { basic: { ...t.basic }, premium: { ...t.premium }, visible: t.visible },
    ]),
  ) as unknown as PlanCopies

  for (const row of (r.data ?? []) as unknown as CopyRow[]) {
    if (!isScope(row.plan)) continue
    const base = { name: row.name, desc: row.description, duration: row.duration ?? '' }
    if (row.tier === 'basic') {
      copies[row.plan].basic = base
      /* 칸이 없으면(038 전) 보여준다 — 지금까지 다 보였다 */
      copies[row.plan].visible = row.visible ?? true
    } else if (row.tier === 'premium') {
      /* 유형별 프리미엄 스위치는 뺐다 — 늘 켜진 것으로 본다. 켜고 끄기와 금액은
         전문 분야의 범위별 칸(0011)과 디자이너별 프리미엄이 맡는다. 칸(enabled)은 남겨 두고 읽지 않는다 */
      copies[row.plan].premium = { ...base, enabled: true }
    }
  }

  return copies
}

/* 작업 기간을 공개 화면에 보여주는지(037_plan_details.sql). 읽지 못하면 꺼진 것으로 본다. */
export async function getShowDuration(): Promise<boolean> {
  if (!supabaseAdmin) return false

  const { data, error } = await supabaseAdmin
    .from('site_settings')
    .select('show_duration')
    .eq('id', true)
    .maybeSingle()

  if (error) {
    console.error('[settings] 작업 기간 노출 조회 실패:', error.message)
    return false
  }
  return (data?.show_duration as boolean | undefined) ?? false
}

/* 한 디자이너의 작업 기간 덮어쓰기. 표가 없으면(037 전) 비운다. */
export async function getDesignerPlanDetails(designerId: string): Promise<DesignerPlanDetails> {
  if (!supabaseAdmin) return {}

  const { data, error } = await supabaseAdmin
    .from('designer_plan_details')
    .select('plan, tier, duration')
    .eq('designer_id', designerId)

  if (error) {
    console.error('[settings] 디자이너 플랜 상세 조회 실패:', error.message)
    return {}
  }

  const details: DesignerPlanDetails = {}
  for (const row of (data ?? []) as {
    plan: string
    tier: string
    duration: string | null
  }[]) {
    if (!isScope(row.plan) || (row.tier !== 'basic' && row.tier !== 'premium')) continue
    ;(details[row.plan] ??= {})[row.tier as PlanTier] = { duration: row.duration }
  }
  return details
}

/* 탐색에서 의뢰유형을 묻는지(034_scope_prompt_toggle.sql).
   읽지 못하면 켜진 것으로 본다 — 마이그레이션 전의 동작 그대로다. */
export async function getScopePrompt(): Promise<boolean> {
  if (!supabaseAdmin) return true

  const { data, error } = await supabaseAdmin
    .from('site_settings')
    .select('scope_prompt')
    .eq('id', true)
    .maybeSingle()

  if (error) {
    console.error('[settings] 의뢰유형 묻기 조회 실패:', error.message)
    return true
  }

  return (data?.scope_prompt as boolean | undefined) ?? true
}

/* 탐색 '전체'일 때 제목 아래 문구(0002_specialty_description.sql). 읽지 못하면 빈 글자 —
   화면은 그때 문구를 비운다. */
export async function getExploreDesc(): Promise<string> {
  if (!supabaseAdmin) return ''

  const { data, error } = await supabaseAdmin
    .from('site_settings')
    .select('explore_desc')
    .eq('id', true)
    .maybeSingle()

  if (error) {
    if (!error.message.includes('explore_desc')) {
      console.error('[settings] 탐색 문구 조회 실패:', error.message)
    }
    return ''
  }

  return (data?.explore_desc as string | undefined) ?? ''
}

type PremiumRow = { designer_id: string; plan: string; price: number; enabled?: boolean }

/* 디자이너별 프리미엄 줄 — enabled 칸이 없는 DB(036 의 이전 판)에서는 빼고 다시 묻는다.
   그때는 줄이 있으면 켜진 것으로 본다(이전 판은 줄이 있는 것이 곧 켜짐이었다). */
async function selectPremiumRows(designerId?: string): Promise<PremiumRow[] | null> {
  const db = supabaseAdmin!
  const build = (cols: string) => {
    const q = db.from('designer_premium_prices').select(cols)
    return designerId ? q.eq('designer_id', designerId) : q
  }

  let r = await build('designer_id, plan, price, enabled')
  if (r.error?.message.includes('enabled')) r = await build('designer_id, plan, price')

  if (r.error) {
    console.error('[settings] 프리미엄 조회 실패:', r.error.message)
    return null
  }
  return (r.data ?? []) as unknown as PremiumRow[]
}

function toSetting(row: PremiumRow) {
  return { enabled: row.enabled ?? true, price: row.price }
}

/* 모든 디자이너의 프리미엄 — 탐색 목록의 의뢰 폼이 쓴다. 디자이너 id → 유형별 설정.
   한 번에 묻는다 — 디자이너마다 따로 물으면 N+1 이 된다. */
export async function listDesignerPremiums(): Promise<Record<string, DesignerPremiums>> {
  if (!supabaseAdmin) return {}

  const rows = await selectPremiumRows()
  const byDesigner: Record<string, DesignerPremiums> = {}
  for (const row of rows ?? []) {
    if (!isScope(row.plan)) continue
    ;(byDesigner[row.designer_id] ??= {})[row.plan as Scope] = toSetting(row)
  }
  return byDesigner
}

/* 한 디자이너의 프리미엄 — 유형마다 스위치와 금액. 줄이 없으면 그 유형은 프리미엄이 없다.
   표가 없어도(036 전) 빈 값으로 넘긴다 — 상세 화면이 404 가 되면 안 된다. */
export async function getDesignerPremiums(designerId: string): Promise<DesignerPremiums> {
  if (!supabaseAdmin) return {}

  const rows = await selectPremiumRows(designerId)
  const premiums: DesignerPremiums = {}
  for (const row of rows ?? []) {
    if (isScope(row.plan)) premiums[row.plan as Scope] = toSetting(row)
  }
  return premiums
}

/* 포함 항목 템플릿 — 어드민이 만든 차례대로(037_plan_details.sql). 표가 없으면 비운다.

   designerId 를 주면 공통 템플릿과 그 디자이너 전용을 함께, 안 주면 공통만.
   only: 'designer' 면 그 디자이너 전용만(어드민의 전용 항목 관리 칸). */
export async function listOptionTemplates(
  opts: { designerId?: string; only?: 'designer' } = {},
): Promise<OptionTemplate[]> {
  if (!supabaseAdmin) return []

  /* id 는 주소에서 오기도 한다 — 조건 문자열(.or)에 그대로 끼우므로 uuid 모양만 받는다 */
  const designerId = opts.designerId && UUID_RE.test(opts.designerId) ? opts.designerId : null

  let q = supabaseAdmin.from('option_templates').select('id, template, targets, designer_id')
  if (designerId && opts.only === 'designer') q = q.eq('designer_id', designerId)
  else if (designerId) q = q.or(`designer_id.is.null,designer_id.eq.${designerId}`)
  else q = q.is('designer_id', null)

  /* 공통 먼저, 전용은 뒤에 — 같은 차례 안에서는 만든 순서 */
  const { data, error } = await q
    .order('designer_id', { nullsFirst: true })
    .order('sort_order')
    .order('created_at')

  if (error) {
    console.error('[settings] 포함 항목 템플릿 조회 실패:', error.message)
    return []
  }
  return (
    (data ?? []) as { id: string; template: string; targets: string[] | null; designer_id: string | null }[]
  ).map((t) => ({
    id: t.id,
    template: t.template,
    targets: t.targets ? (t.targets.filter(isPlanSlot) as PlanSlot[]) : null,
    designerId: t.designer_id,
  }))
}

/* 한 디자이너가 플랜마다 등록한 포함 항목. 처음 가입하면 비어 있다. */
export async function getDesignerPlanOptions(designerId: string): Promise<DesignerPlanOptions> {
  if (!supabaseAdmin) return {}

  const { data, error } = await supabaseAdmin
    .from('designer_plan_options')
    .select('plan, tier, template_id, n')
    .eq('designer_id', designerId)

  if (error) {
    console.error('[settings] 디자이너 포함 항목 조회 실패:', error.message)
    return {}
  }

  const options: DesignerPlanOptions = {}
  for (const row of (data ?? []) as { plan: string; tier: string; template_id: string; n: number | null }[]) {
    const slot = `${row.plan}:${row.tier}`
    if (!isPlanSlot(slot)) continue
    ;(options[slot] ??= []).push({ templateId: row.template_id, n: row.n })
  }
  return options
}

/* 한 디자이너의 포함 항목 — 공통·개별 목록마다 단계별로 고른 템플릿과 직접 적은 항목(0004·0005·0017).

   0004 전이면 null — 호출부는 예전 플랜별 목록(getDesignerPlanOptions)의 기본 칸을 쓴다.
   0005 전이면 직접 적은 항목만 비운다.
   0017 전이면 premium 이 null 이고 직접 적은 항목은 모두 기본 단계에만 있다. */
export async function getDesignerOptionSetup(designerId: string): Promise<DesignerOptionSetup | null> {
  if (!supabaseAdmin) return null
  const db = supabaseAdmin

  const readCustom = (withTiers: boolean) =>
    db
      .from('designer_custom_options')
      .select(withTiers ? 'id, bucket, text, in_basic, in_premium' : 'id, bucket, text')
      .eq('designer_id', designerId)
      .order('created_at')

  const [rows, premium, firstCustom] = await Promise.all([
    db.from('designer_category_options').select('bucket, template_id, n').eq('designer_id', designerId),
    db.from('designer_premium_options').select('bucket, template_id, n').eq('designer_id', designerId),
    readCustom(true),
  ])

  if (rows.error) {
    if (!rows.error.message.includes('designer_category_options')) {
      console.error('[settings] 포함 항목 조회 실패:', rows.error.message)
    }
    return null
  }
  if (premium.error && !premium.error.message.includes('designer_premium_options')) {
    console.error('[settings] 프리미엄 포함 항목 조회 실패:', premium.error.message)
  }

  /* 단계 칸(0017)이 없으면 예전 칸만 다시 읽는다 — 화면이 비지 않게 */
  const custom = firstCustom.error && /in_basic|in_premium/.test(firstCustom.error.message)
    ? await readCustom(false)
    : firstCustom
  if (custom.error && !custom.error.message.includes('designer_custom_options')) {
    console.error('[settings] 직접 입력 포함 항목 조회 실패:', custom.error.message)
  }

  type Row = { bucket: string; template_id: string; n: number | null }
  const group = (list: Row[]) => {
    const out: Record<string, RegisteredOption[]> = {}
    for (const row of list) {
      if (!isBucket(row.bucket)) continue
      ;(out[row.bucket] ??= []).push({ templateId: row.template_id, n: row.n })
    }
    return out
  }

  const setup: DesignerOptionSetup = {
    buckets: group((rows.data ?? []) as Row[]),
    premium: premium.error ? null : group((premium.data ?? []) as Row[]),
    custom: {},
  }
  type CustomRow = { id: string; bucket: string; text: string; in_basic?: boolean; in_premium?: boolean }
  for (const row of (custom.data ?? []) as unknown as CustomRow[]) {
    if (!isBucket(row.bucket)) continue
    ;(setup.custom[row.bucket] ??= []).push({
      id: row.id,
      text: row.text,
      basic: row.in_basic ?? true,
      premium: row.in_premium ?? false,
    })
  }
  return setup
}
