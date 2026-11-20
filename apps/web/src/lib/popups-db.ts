import 'server-only'
import { connection } from 'next/server'
import { supabaseAdmin } from './supabase-admin'
import { inPeriod, type PopupRow, type PublicPopup } from './popup-shape'

/* 팝업 조회(023_popups.sql).

   RLS 로 전부 막아 둔 테이블이라 service_role 로만 닿는다. 공개 화면용
   함수는 기간·상태를 걸러 필요한 칸만 내보낸다. */

/* 노출 상태로 기간이 지난 팝업을 만료로 돌린다.

   예약 작업을 따로 두지 않고 조회할 때마다 정리한다 — 어드민 목록이든
   공개 화면이든 보는 순간 상태가 맞아 있으면 충분하다. 공개 조회는
   이 정리가 실패해도 기간으로 한 번 더 거르므로 지난 팝업이 뜨지 않는다. */
async function expireOverdue(nowIso: string) {
  if (!supabaseAdmin) return

  const { error } = await supabaseAdmin
    .from('popups')
    .update({ status: 'expired', status_at: nowIso })
    .eq('status', 'visible')
    .lte('ends_at', nowIso)

  if (error) console.error('[popup] 만료 처리 실패:', error.message)
}

export async function listPopups(): Promise<PopupRow[]> {
  if (!supabaseAdmin) return []

  await connection()
  await expireOverdue(new Date().toISOString())

  const { data, error } = await supabaseAdmin
    .from('popups')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) {
    /* 023 전이면 테이블이 없다 — 화면은 비우고 넘어간다 */
    console.error('[popup] 목록 조회 실패:', error.message)
    return []
  }
  return (data ?? []) as PopupRow[]
}

export async function getPopup(id: string): Promise<PopupRow | null> {
  if (!supabaseAdmin) return null

  await connection()
  await expireOverdue(new Date().toISOString())

  const { data, error } = await supabaseAdmin.from('popups').select('*').eq('id', id).maybeSingle()
  if (error) {
    console.error('[popup] 조회 실패:', error.message)
    return null
  }
  return (data as PopupRow) ?? null
}

/* 지금 사이트에 띄울 팝업 — 노출 상태이면서 게시 기간 안인 것만 */
export async function listActivePopups(): Promise<PublicPopup[]> {
  if (!supabaseAdmin) return []

  /* 현재 시각으로 거르므로 요청마다 새로 물어야 한다 */
  await connection()
  const now = new Date().toISOString()
  await expireOverdue(now)

  const { data, error } = await supabaseAdmin
    .from('popups')
    .select('id, title, body, files, starts_at, ends_at')
    .eq('status', 'visible')
    .order('created_at', { ascending: false })
    .limit(30)

  if (error) {
    console.error('[popup] 공개 조회 실패:', error.message)
    return []
  }

  /* 기간은 여기서 거른다 — 노출 중인 팝업은 몇 개뿐이고, 양 끝이 비어
     있을 수 있는 조건을 PostgREST 필터로 엮는 것보다 읽기 쉽다 */
  const t = Date.parse(now)
  return ((data ?? []) as (PublicPopup & Pick<PopupRow, 'starts_at' | 'ends_at'>)[])
    .filter((p) => inPeriod(p, t))
    .slice(0, 10)
    .map(({ id, title, body, files }) => ({ id, title, body, files }))
}
