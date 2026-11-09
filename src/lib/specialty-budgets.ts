import 'server-only'
import { supabaseAdmin } from './supabase-admin'
import type { BudgetChoice, BudgetsByCategory } from './inquiry-budget'

/* 분야별 예산 범위 조회(0022_specialty_budgets.sql).

   간편 의뢰 폼(분야를 고르면 그 분야의 구간이 열린다)과 접수 API(보낸 값이
   그 분야에 실제로 있는 구간인지 확인)가 같은 목록을 쓴다 —
   한곳에서 읽어야 화면과 검사가 어긋나지 않는다.

   0022 전이면 표가 없다 — 그때는 빈 목록으로 둔다. 예산을 묻지 않을 뿐
   간편 의뢰는 그대로 접수된다. */

type Row = {
  id: string
  specialty_id: string
  label: string
  sort_order: number
}

/* 분야 id → 구간들. 표가 없으면 빈 Map */
export async function readBudgetRows(): Promise<Map<string, BudgetChoice[]>> {
  const map = new Map<string, BudgetChoice[]>()
  if (!supabaseAdmin) return map

  const { data, error } = await supabaseAdmin
    .from('specialty_budgets')
    .select('id, specialty_id, label, sort_order')
    .order('sort_order', { ascending: true })

  if (error) {
    /* 0022 전이면 표가 없다 — 화면이 비는 것이 맞다(예산을 묻지 않는다) */
    if (!/specialty_budgets/i.test(error.message)) {
      console.error('[budget] 예산 범위 조회 실패:', error.message)
    }
    return map
  }

  for (const r of (data ?? []) as Row[]) {
    const list = map.get(r.specialty_id) ?? []
    list.push({ id: r.id, label: r.label, sort_order: r.sort_order })
    map.set(r.specialty_id, list)
  }
  /* 차례가 같으면 문구순 — Postgres 정렬은 로케일에 기대므로 코드에서 맞춘다 */
  for (const list of map.values()) {
    list.sort((a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label, 'ko'))
  }
  return map
}

/* 분야 이름 → 구간들. 폼과 접수 API 가 쓴다 — 둘 다 분야를 이름으로 다룬다.
   구간이 없는 분야는 아예 넣지 않는다(그 분야는 예산을 묻지 않는다). */
export async function getBudgetsByCategory(): Promise<BudgetsByCategory> {
  if (!supabaseAdmin) return {}

  const [{ data: specs, error }, rows] = await Promise.all([
    supabaseAdmin.from('specialties').select('id, name'),
    readBudgetRows(),
  ])
  if (error) {
    console.error('[budget] 분야 조회 실패:', error.message)
    return {}
  }

  const out: BudgetsByCategory = {}
  for (const s of (specs ?? []) as { id: string; name: string }[]) {
    const list = rows.get(s.id)
    if (list?.length) out[s.name] = list
  }
  return out
}
