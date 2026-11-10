'use server'

import { revalidatePath } from 'next/cache'
import { getAdminUser } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'

/* 서버 액션은 누구나 호출할 수 있는 엔드포인트다.
   페이지에서 막았더라도 여기서 권한을 다시 확인해야 한다. */
async function guard() {
  const user = await getAdminUser()
  if (!user) throw new Error('권한이 없습니다.')
  if (!supabaseAdmin) throw new Error('서버 설정이 완료되지 않았습니다.')
  return supabaseAdmin
}

export type Result = { ok: true } | { ok: false; error: string }

function fail(error: string) {
  return { ok: false as const, error }
}

function refresh() {
  revalidatePath('/admin/exposure')
  revalidatePath('/explore')
}

/* 테이블이 없을 때(032 전) 뭉뚱그린 실패 대신 무엇을 하라는지 알려준다 */
function failFor(message: string, what: string) {
  console.error(`[explore] ${what} 실패:`, message)
  if (message.includes('explore_features')) {
    return fail('노출 관리 테이블이 아직 없습니다. 032_explore_features.sql 을 먼저 적용해 주세요.')
  }
  return fail(`${what}에 실패했습니다.`)
}

/* 고른 디자이너들을 feature1 끝에 붙인다. 이미 올라 있는 사람은 건너뛴다 —
   다시 고른다고 차례가 맨 뒤로 밀리면 어드민이 정해 둔 순서가 흐트러진다. */
export async function addExploreFeatures(ids: string[]): Promise<Result> {
  const db = await guard()
  if (ids.length === 0) return { ok: true }

  const { data: rows, error: readErr } = await db
    .from('explore_features')
    .select('designer_id, sort_order')
    .eq('layout', 'feature1')
  if (readErr) return failFor(readErr.message, '추가')

  const have = new Set((rows ?? []).map((r) => r.designer_id as string))
  const last = Math.max(-1, ...(rows ?? []).map((r) => r.sort_order as number))
  const fresh = [...new Set(ids)].filter((id) => !have.has(id))
  if (fresh.length === 0) return { ok: true }

  const { error } = await db.from('explore_features').insert(
    fresh.map((id, i) => ({ designer_id: id, layout: 'feature1', sort_order: last + 1 + i })),
  )
  if (error) return failFor(error.message, '추가')

  refresh()
  return { ok: true }
}

/* 위쪽에서 빼면 기본 카드로 아래에 선다 — 디자이너가 사라지지는 않는다 */
export async function removeExploreFeature(id: string): Promise<Result> {
  const db = await guard()
  const { error } = await db.from('explore_features').delete().eq('designer_id', id)
  if (error) return failFor(error.message, '제외')

  refresh()
  return { ok: true }
}

export async function reorderExploreFeatures(ids: string[]): Promise<Result> {
  const db = await guard()
  if (ids.length === 0) return { ok: true }

  const { data: all, error: readErr } = await db
    .from('explore_features')
    .select('designer_id')
    .eq('layout', 'feature1')
  if (readErr) return failFor(readErr.message, '순서 변경')

  /* 화면이 가진 목록과 DB 가 어긋나면 섣불리 쓰지 않는다 —
     빠진 사람이 0번으로 몰려 순서가 뒤엉킨다 */
  const known = new Set((all ?? []).map((r) => r.designer_id as string))
  const clean = ids.filter((id) => known.has(id))
  if (clean.length !== known.size) {
    return fail('목록이 바뀌었습니다. 새로고침 후 다시 시도해 주세요.')
  }

  const results = await Promise.all(
    clean.map((id, i) =>
      db.from('explore_features').update({ sort_order: i }).eq('designer_id', id),
    ),
  )
  const failedOne = results.find((r) => r.error)
  if (failedOne?.error) return failFor(failedOne.error.message, '순서 변경')

  refresh()
  return { ok: true }
}

/* ─────────── 탐색 전체 차례(0026_designer_sort_order.sql) ───────────

   feature1 묶음과 다른 것이다 — 그쪽은 '맨 위에 크게 올릴 몇 명'이고,
   이것은 그 아래 줄지어 서는 전체 디자이너의 차례다. */

export async function reorderDesigners(ids: string[]): Promise<Result> {
  const db = await guard()
  if (ids.length === 0) return { ok: true }

  /* 화면이 가진 목록과 DB 가 어긋나면 섣불리 쓰지 않는다 — 빠진 사람이
     0번으로 몰려 차례가 뒤엉킨다(reorderExploreFeatures 와 같은 방침).
     탐색에 서는 사람만 센다 — 숨긴 계정은 애초에 목록에 없다. */
  const { data: all, error: readErr } = await db
    .from('designers')
    .select('id')
    .eq('visible', true)
    .eq('profile_public', true)

  if (readErr) {
    console.error('[explore] 디자이너 차례 변경 실패:', readErr.message)
    return fail('순서 변경에 실패했습니다.')
  }

  const known = new Set((all ?? []).map((r) => r.id as string))
  const clean = ids.filter((id) => known.has(id))
  if (clean.length !== known.size) {
    return fail('목록이 바뀌었습니다. 새로고침 후 다시 시도해 주세요.')
  }

  /* 받은 차례대로 0번부터 다시 매긴다 */
  const results = await Promise.all(
    clean.map((id, i) => db.from('designers').update({ sort_order: i }).eq('id', id)),
  )

  const failedOne = results.find((r) => r.error)
  if (failedOne?.error) {
    console.error('[explore] 디자이너 차례 변경 실패:', failedOne.error.message)
    if (failedOne.error.message.includes('sort_order')) {
      return fail('차례 칸이 아직 없습니다. 0026_designer_sort_order.sql 을 먼저 실행해 주세요.')
    }
    return fail('순서 변경에 실패했습니다.')
  }

  refresh()
  return { ok: true }
}
