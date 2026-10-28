'use server'

import { revalidatePath } from 'next/cache'
import { getAdminUser } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { generateInviteCode } from '@/lib/invites-db'
import {
  MAX_INVITE_DAYS,
  MAX_INVITE_MEMO,
  OPEN_STATUSES,
  customCodeError,
  endOfKstDate,
  kstDateAfter,
} from '@/lib/invite-shape'

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

/* 발행 — 만료일은 오늘부터 최대 14일 뒤까지(한국 날짜).
   코드를 직접 적으면 그 값으로, 비우면 8자리를 자동으로 만든다. */
export async function createInvite(
  expiresOn: string,
  memo: string,
  customCode = '',
): Promise<Result & { code?: string }> {
  const db = await guard()

  const today = kstDateAfter(0)
  const last = kstDateAfter(MAX_INVITE_DAYS)
  /* YYYY-MM-DD 는 글자 순서가 곧 날짜 순서다 */
  if (!endOfKstDate(expiresOn) || expiresOn < today || expiresOn > last) {
    return fail(`만료일은 오늘부터 ${MAX_INVITE_DAYS}일 안에서 골라 주세요.`)
  }
  const cleanMemo = memo.trim()
  if (cleanMemo.length > MAX_INVITE_MEMO) return fail(`메모는 ${MAX_INVITE_MEMO}자 이내로 적어 주세요.`)

  const custom = customCode.trim()
  const codeErr = customCodeError(custom)
  if (codeErr) return fail(codeErr)

  /* 직접 적은 코드는 다시 뽑을 수 없다 — 겹치면 바로 알린다.
     이미 쓰였거나 만료·취소된 코드와도 겹칠 수 없다(코드는 기록으로 남는다). */
  if (custom) {
    const { error } = await db.from('designer_invites').insert({
      code: custom,
      memo: cleanMemo || null,
      expires_at: endOfKstDate(expiresOn),
      status_at: new Date().toISOString(),
    })
    if (!error) {
      revalidatePath('/admin/invites')
      return { ok: true, code: custom }
    }
    if (error.code === '23505') return fail('이미 발행한 적 있는 코드입니다. 다른 코드를 적어 주세요.')
    console.error('[invite] 발행 실패:', error.message)
    /* 025 전이면 8자리 고정 제약에 걸린다 */
    if (/designer_invites_code_fmt/i.test(error.message)) {
      return fail('직접 정하는 코드를 쓰려면 마이그레이션(025)을 실행해 주세요.')
    }
    return fail('발행에 실패했습니다.')
  }

  /* 코드가 겹칠 확률은 아주 낮지만, 겹치면 unique 제약에 걸린다 — 몇 번 다시 뽑는다 */
  for (let i = 0; i < 5; i++) {
    const code = generateInviteCode()
    const { error } = await db.from('designer_invites').insert({
      code,
      memo: cleanMemo || null,
      expires_at: endOfKstDate(expiresOn),
      status_at: new Date().toISOString(),
    })
    if (!error) {
      revalidatePath('/admin/invites')
      return { ok: true, code }
    }
    if (error.code === '23505') continue
    console.error('[invite] 발행 실패:', error.message)
    if (/designer_invites/i.test(error.message)) {
      return fail('초대코드 테이블이 없습니다. 마이그레이션(024)을 실행해 주세요.')
    }
    return fail('발행에 실패했습니다.')
  }
  return fail('발행에 실패했습니다. 다시 시도해 주세요.')
}

/* 취소 — 아직 쓸 수 있는 코드만(사용 가능·인증함). 쓰였거나 만료된 코드는 기록으로 남긴다. */
export async function cancelInvite(id: string): Promise<Result> {
  const db = await guard()
  if (!id) return fail('초대코드를 찾을 수 없습니다.')

  /* 조건을 update 에 함께 건다 — 읽고 나서 바꾸는 사이에 누가 가입하면
     사용된 코드를 취소로 덮어쓰게 된다 */
  const { data, error } = await db
    .from('designer_invites')
    .update({ status: 'canceled', status_at: new Date().toISOString() })
    .eq('id', id)
    /* 인증함도 아직 가입 전이라 취소할 수 있다 */
    .in('status', OPEN_STATUSES)
    .gt('expires_at', new Date().toISOString())
    .select('id')

  if (error) {
    console.error('[invite] 취소 실패:', error.message)
    return fail('취소에 실패했습니다.')
  }
  revalidatePath('/admin/invites')
  if (!data || data.length === 0) return fail('이미 사용됐거나 만료된 코드라 취소할 수 없습니다.')
  return { ok: true }
}
