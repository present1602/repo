import 'server-only'
import { supabaseAdmin } from './supabase-admin'
import type { InquiryRow } from './inquiry-shape'

/* 문의 조회 — 어드민 전용(012_inquiries.sql).

   RLS 로 전부 막아 둔 테이블이라 service_role 로만 닿는다.
   호출부에서 권한을 먼저 확인한다. */

export async function listInquiries(): Promise<InquiryRow[]> {
  if (!supabaseAdmin) return []

  const { data, error } = await supabaseAdmin
    .from('inquiries')
    .select('*')
    /* 최근 것이 위로 — 미확인을 먼저 올리지는 않는다.
       확인했다고 목록에서 자리가 바뀌면 방금 뭘 봤는지 놓친다. */
    .order('created_at', { ascending: false })
    /* 쌓이면 끊어 받아야 하지만, 당분간은 한 번에 다 받아도 된다 */
    .limit(500)

  if (error) {
    /* 012 전이면 테이블이 없다 — 화면은 비우고 넘어간다 */
    console.error('[inquiry] 목록 조회 실패:', error.message)
    return []
  }

  return (data ?? []) as InquiryRow[]
}

/* 미확인 건수 — 사이드바 배지에 쓴다.
   목록 전체를 받지 않고 세기만 한다. */
export async function countUnreadInquiries(): Promise<number> {
  if (!supabaseAdmin) return 0

  const { count, error } = await supabaseAdmin
    .from('inquiries')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'unread')

  if (error) {
    console.error('[inquiry] 미확인 건수 조회 실패:', error.message)
    return 0
  }
  return count ?? 0
}
