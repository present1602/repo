'use server'

import { revalidatePath } from 'next/cache'
import { getAdminUser } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { MAX_PLAN_DESC } from '@/lib/plans'

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

export type PlanCopyInput = {
  designName: string
  designDesc: string
  premiumName: string
  premiumDesc: string
}

/* 플랜 이름·설명은 모든 디자이너에게 같은 문구로 나간다.
   고치면 공개 상세가 전부 바뀌므로 해당 경로를 통째로 되살린다. */
export async function updatePlanCopy(input: PlanCopyInput): Promise<Result> {
  const db = await guard()

  const designName = input.designName.trim()
  const premiumName = input.premiumName.trim()
  const designDesc = input.designDesc.trim()
  const premiumDesc = input.premiumDesc.trim()

  /* 이름이 비면 공개 화면의 플랜 제목이 사라진다 — 설명과 달리 비울 수 없다 */
  if (!designName || !premiumName) {
    return fail('플랜 이름을 입력해 주세요.')
  }
  if (designDesc.length > MAX_PLAN_DESC || premiumDesc.length > MAX_PLAN_DESC) {
    return fail(`설명은 ${MAX_PLAN_DESC}자 이내로 입력해 주세요.`)
  }

  const { error } = await db
    .from('site_settings')
    .update({
      design_plan_name: designName,
      design_plan_desc: designDesc,
      premium_plan_name: premiumName,
      premium_plan_desc: premiumDesc,
    })
    .eq('id', true)

  if (error) {
    console.error('[settings] 플랜 문구 수정 실패:', error.message)
    return fail('저장에 실패했습니다.')
  }

  revalidatePath('/admin/settings')
  revalidatePath('/studio')
  /* 모든 디자이너의 공개 상세에 같은 문구가 실려 있다 */
  revalidatePath('/designers', 'layout')

  return { ok: true }
}
