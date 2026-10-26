'use server'

import { revalidatePath } from 'next/cache'
import { getAdminUser } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'

/* 서버 액션은 누구나 호출할 수 있는 엔드포인트다 —
   페이지에서 막았더라도 여기서 권한을 다시 확인한다. */
async function guard() {
  const user = await getAdminUser()
  if (!user) throw new Error('권한이 없습니다.')
  if (!supabaseAdmin) throw new Error('서버 설정이 완료되지 않았습니다.')
  return supabaseAdmin
}

export type Result = { ok: true } | { ok: false; error: string }

/* 확인 / 미확인 전환 — 문의(inquiries/actions.ts)와 같은 규칙 */
export async function setApplicationStatus(id: string, status: string): Promise<Result> {
  const db = await guard()

  if (!id) return { ok: false, error: '지원서를 찾을 수 없습니다.' }
  if (status !== 'unread' && status !== 'read') {
    return { ok: false, error: '알 수 없는 상태입니다.' }
  }

  const { error } = await db
    .from('designer_applications')
    .update({ status, status_at: new Date().toISOString() })
    .eq('id', id)

  if (error) {
    console.error('[apply] 상태 변경 실패:', error.message)
    return { ok: false, error: '변경에 실패했습니다.' }
  }

  revalidatePath('/admin/applications')
  /* 사이드바의 미확인 배지도 함께 바뀐다 */
  revalidatePath('/admin', 'layout')
  return { ok: true }
}
