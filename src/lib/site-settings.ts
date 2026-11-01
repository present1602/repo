import 'server-only'
import { supabaseAdmin } from './supabase-admin'
import { FALLBACK_PLAN_COPIES, type DesignerPremiums, type PlanCopies } from './plans'
import { isScope, type Scope } from './scopes'

/* 사이트 전역 설정 — 플랜 문구와 화면 스위치.
   site_settings 는 한 줄짜리 테이블이다(id = true). */

type CopyRow = { plan: string; tier: string; name: string; description: string; enabled?: boolean }

/* 플랜 문구 — 유형 × 단계마다 한 줄(036_plan_copy_premium.sql).
   빠진 줄은 기본 문구로 메운다 — 표가 비어도 카드 제목이 사라지지 않게.
   enabled 칸이 없는 DB(036 의 이전 판)에서는 그것만 빼고 다시 묻는다 — 프리미엄은 꺼진 것으로 본다. */
export async function getPlanCopies(): Promise<PlanCopies> {
  if (!supabaseAdmin) return FALLBACK_PLAN_COPIES
  const db = supabaseAdmin

  let r = await db.from('plan_copy').select('plan, tier, name, description, enabled')
  if (r.error?.message.includes('enabled')) {
    r = await db.from('plan_copy').select('plan, tier, name, description')
  }

  if (r.error) {
    /* 마이그레이션 전이거나 조회 실패 — 화면이 비는 것보다 기본 문구가 낫다 */
    console.error('[settings] 플랜 문구 조회 실패:', r.error.message)
    return FALLBACK_PLAN_COPIES
  }

  /* 한 단계 깊이까지 복사한다 — 기본값 객체를 그대로 고쳐 쓰면 다음 요청에 섞인다 */
  const copies = Object.fromEntries(
    Object.entries(FALLBACK_PLAN_COPIES).map(([plan, tiers]) => [plan, { ...tiers }]),
  ) as PlanCopies

  for (const row of (r.data ?? []) as CopyRow[]) {
    if (!isScope(row.plan)) continue
    if (row.tier === 'basic') {
      copies[row.plan].basic = { name: row.name, desc: row.description }
    } else if (row.tier === 'premium') {
      copies[row.plan].premium = { name: row.name, desc: row.description, enabled: row.enabled ?? false }
    }
  }
  return copies
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
