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

/* 목록에서 치우기 — 줄은 지우지 않는다(0020_inquiry_hidden.sql).

   문의는 들어온 기록이고 첨부 파일까지 묶여 있어 되돌릴 수 없게 지우지 않는다.
   hidden_at 에 시각만 남기고 조회에서 뺀다(inquiries-db.ts) — 치운 건은
   SQL 로 다시 꺼낼 수 있다. 확인한 건만 치울 수 있다: 아직 안 본 문의가
   사라지면 그대로 묻힌다. */
export async function hideInquiry(id: string): Promise<Result> {
  const db = await guard()

  if (!id) return fail('문의를 찾을 수 없습니다.')

  const { data, error } = await db
    .from('inquiries')
    .update({ hidden_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'read')
    .select('id')

  if (error) {
    console.error('[inquiry] 삭제 실패:', error.message)
    /* 0020 전이면 칸이 없다 — 돌릴 파일 이름을 적어 준다 */
    if (error.message.includes('hidden_at')) {
      return fail('삭제 기록 칸이 없습니다. 0020_inquiry_hidden.sql 을 실행해 주세요.')
    }
    return fail('삭제에 실패했습니다.')
  }

  /* 확인하지 않은 문의거나 이미 치운 건 — 화면이 오래된 것이니 그대로 알린다 */
  if (!data?.length) return fail('확인한 문의만 삭제할 수 있습니다. 새로고침해 주세요.')

  revalidatePath('/admin/inquiries')
  revalidatePath('/admin', 'layout')
  return { ok: true }
}
