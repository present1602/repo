'use server'

import { revalidatePath } from 'next/cache'
import { getAdminUser } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import {
  ensureReviewToken,
  createStandaloneToken,
  markReviewLinkSent,
} from '@/lib/reviews-db'
import { sendReviewRequest } from '@/lib/review-mail'

/* 서버 액션은 누구나 호출할 수 있는 엔드포인트다.
   페이지에서 막았더라도 여기서 권한을 다시 확인한다. */
async function guard() {
  const user = await getAdminUser()
  if (!user) throw new Error('권한이 없습니다.')
  if (!supabaseAdmin) throw new Error('서버 설정이 완료되지 않았습니다.')
  return supabaseAdmin
}

function fail(error: string) {
  return { ok: false as const, error }
}

/* 만든 링크를 화면에 돌려준다 — 메일이 실패해도 어드민이 주소를 복사해
   카카오·문자로 직접 보낼 수 있어야 한다. */
export type LinkResult =
  | { ok: true; url: string; mailed: boolean; mailError?: string }
  | { ok: false; error: string }

function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/+$/, '')
}

/* ─────────── 문의에서 만들기 ─────────── */

/* 문의에 후기 링크를 붙이고, 이메일이 있으면 보낸다.

   디자이너는 선택이다. 의뢰에 이미 적혀 있으면 그대로 쓰고, 비어 있을 때
   골라 주면 의뢰에 함께 적는다 — 그래야 작성 화면과 저장이 같은 값을 본다. */
export async function sendReviewLinkForInquiry(
  inquiryId: string,
  designerId?: string | null,
): Promise<LinkResult> {
  const db = await guard()

  const { data: inq } = await db
    .from('inquiries')
    .select('id, name, email, designer_id, designer_name')
    .eq('id', inquiryId)
    .maybeSingle()

  if (!inq) return fail('문의를 찾을 수 없습니다.')
  const q = inq as {
    id: string
    name: string
    email: string
    designer_id: string | null
    designer_name: string | null
  }

  /* 골라 준 디자이너가 있으면 이름까지 함께 넘긴다 —
     designer_name 은 디자이너가 지워져도 남을 값이라 지금 베껴 둬야 한다. */
  let picked: { id: string; name: string | null } | null = null
  if (designerId) {
    const { data: d } = await db
      .from('designers')
      .select('id, name')
      .eq('id', designerId)
      .maybeSingle()
    if (!d) return fail('디자이너를 찾을 수 없습니다.')
    picked = d as { id: string; name: string | null }
  }

  const t = await ensureReviewToken(q.id, picked)
  if (!t.ok) return fail(t.error)

  const url = `${siteUrl()}/review/${t.token}`
  const designerName = picked?.name ?? q.designer_name

  const mail = await sendReviewRequest(q.email, q.name, url, designerName)
  if (mail.ok) await markReviewLinkSent(t.token)

  revalidatePath('/admin/inquiries')
  revalidatePath('/admin/reviews')
  return { ok: true, url, mailed: mail.ok, mailError: mail.error }
}

/* ─────────── 승인 ─────────── */

export type Result = { ok: true } | { ok: false; error: string }

/* 공개 여부를 바꾼다.

   승인해야 공개된다(기본 pending). 내릴 때는 사유를 함께 적어 둔다 —
   나중에 작성자가 "왜 안 보이냐" 물으면 근거가 된다. */
export async function setReviewStatus(
  id: string,
  status: 'pending' | 'approved' | 'rejected',
  memo?: string,
): Promise<Result> {
  const db = await guard()

  if (!['pending', 'approved', 'rejected'].includes(status)) {
    return fail('알 수 없는 상태입니다.')
  }

  const { data: row } = await db
    .from('reviews')
    .select('designer_id')
    .eq('id', id)
    .maybeSingle()

  const { error } = await db
    .from('reviews')
    .update({
      status,
      status_at: new Date().toISOString(),
      status_memo: memo?.trim() || null,
    })
    .eq('id', id)

  if (error) {
    console.error('[review] 상태 변경 실패:', error.message)
    return fail('변경에 실패했습니다.')
  }

  revalidatePath('/admin/reviews')
  /* 공개 화면도 바뀐다 — 승인한 후기가 바로 보여야 한다 */
  const designerId = (row as { designer_id?: string | null } | null)?.designer_id
  if (designerId) revalidatePath(`/designers/${designerId}`)
  return { ok: true }
}

/* ─────────── 문의 없이 만들기 ─────────── */

/* 전화·메신저로 직접 받은 의뢰용 링크.

   플랫폼을 거치지 않은 일도 후기는 받아야 한다. 이름만 필수이고
   이메일·디자이너는 선택이다 — 이메일이 없으면 링크만 만들어 주고,
   어드민이 카카오 등으로 직접 보낸다. */
export async function createReviewLink(input: {
  authorName: string
  authorEmail?: string
  designerId?: string | null
  memo?: string
}): Promise<LinkResult> {
  const db = await guard()

  let picked: { id: string; name: string | null } | null = null
  if (input.designerId) {
    const { data: d } = await db
      .from('designers')
      .select('id, name')
      .eq('id', input.designerId)
      .maybeSingle()
    if (!d) return fail('디자이너를 찾을 수 없습니다.')
    picked = d as { id: string; name: string | null }
  }

  const t = await createStandaloneToken({
    authorName: input.authorName,
    authorEmail: input.authorEmail,
    designer: picked,
    memo: input.memo,
  })
  if (!t.ok) return fail(t.error)

  const url = `${siteUrl()}/review/${t.token}`

  /* 이메일을 안 적었으면 보내지 않는다 — 링크만 돌려주면
     어드민이 복사해 카카오로 보낸다. */
  const email = input.authorEmail?.trim()
  if (!email) {
    revalidatePath('/admin/reviews')
    return { ok: true, url, mailed: false }
  }

  const mail = await sendReviewRequest(email, input.authorName.trim(), url, picked?.name)
  if (mail.ok) await markReviewLinkSent(t.token)

  revalidatePath('/admin/reviews')
  return { ok: true, url, mailed: mail.ok, mailError: mail.error }
}
