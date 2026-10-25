'use server'

import { revalidatePath } from 'next/cache'
import { getAdminUser } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { isInquiryStatus, type InquiryStatus } from '@/lib/inquiry-shape'

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

/* 확인 / 미확인 전환.

   status_at 에 바꾼 시각을 함께 남긴다 — 언제 확인했는지 알아야
   밀린 문의를 찾을 수 있다. 미확인으로 되돌릴 때도 남긴다:
   "되돌린 시각"도 기록이다. */
export async function setInquiryStatus(id: string, status: string): Promise<Result> {
  const db = await guard()

  if (!id) return fail('문의를 찾을 수 없습니다.')
  /* 화면이 보낸 값을 믿지 않는다 — DB check 제약에 걸리면
     '변경에 실패했습니다' 라는 뭉뚱그린 메시지만 남는다. */
  if (!isInquiryStatus(status)) return fail('알 수 없는 상태입니다.')

  const { error } = await db
    .from('inquiries')
    .update({ status: status as InquiryStatus, status_at: new Date().toISOString() })
    .eq('id', id)

  if (error) {
    console.error('[inquiry] 상태 변경 실패:', error.message)
    return fail('변경에 실패했습니다.')
  }

  revalidatePath('/admin/inquiries')
  /* 사이드바의 미확인 배지도 함께 바뀐다 */
  revalidatePath('/admin', 'layout')
  return { ok: true }
}
