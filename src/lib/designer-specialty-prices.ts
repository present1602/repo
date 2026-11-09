import 'server-only'
import { supabaseAdmin } from './supabase-admin'
import type { DesignerSpecialtyPrices, PriceScope, PriceTier } from './specialty-shape'

/* 디자이너별 분야 시작가 조회(0016_designer_specialty_prices.sql).

   분야 전체 금액(specialty_plan_prices)을 디자이너 한 명에게만 덮는 층이다.
   읽는 차례는 categoryPrice 가 정한다 — 디자이너·분야 → 분야 → 디자이너 기본가. */

type Row = {
  designer_id: string
  specialty_id: string
  scope: PriceScope
  tier: PriceTier
  price: number
}

const COLS = 'designer_id, specialty_id, scope, tier, price'

function group(rows: Row[]): DesignerSpecialtyPrices {
  const out: DesignerSpecialtyPrices = {}
  for (const r of rows) {
    const cat = (out[r.specialty_id] ??= {})
    ;(cat[r.scope] ??= {})[r.tier] = r.price
  }
  return out
}

/* 여러 디자이너 몫을 한 번에 — 탐색 목록이 N+1 이 되지 않게.
   0016 전이면 표가 없다. 조용히 비워 돌려준다 — 그러면 지금까지처럼 분야 금액이 나간다. */
export async function readOwnPrices(
  designerIds: string[],
): Promise<Map<string, DesignerSpecialtyPrices>> {
  const empty = new Map<string, DesignerSpecialtyPrices>()
  if (!supabaseAdmin || designerIds.length === 0) return empty

  const { data, error } = await supabaseAdmin
    .from('designer_specialty_prices')
    .select(COLS)
    .in('designer_id', designerIds)

  if (error) {
    if (!/designer_specialty_prices/i.test(error.message)) {
      console.error('[designer-prices] 조회 실패:', error.message)
    }
    return empty
  }

  const byDesigner = new Map<string, Row[]>()
  for (const r of (data ?? []) as unknown as Row[]) {
    const list = byDesigner.get(r.designer_id)
    if (list) list.push(r)
    else byDesigner.set(r.designer_id, [r])
  }

  const out = new Map<string, DesignerSpecialtyPrices>()
  for (const [id, rows] of byDesigner) out.set(id, group(rows))
  return out
}

/* 어드민 화면용 — 한 명 몫 */
export async function getOwnPrices(designerId: string): Promise<DesignerSpecialtyPrices> {
  return (await readOwnPrices([designerId])).get(designerId) ?? {}
}
