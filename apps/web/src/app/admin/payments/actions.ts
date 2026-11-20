'use server'

import { revalidatePath } from 'next/cache'
import { getAdminUser } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { isMissingTable, newOrderNo, payUrl, randomToken } from '@/lib/payment-links-db'
import { sendLinkMail } from '@/lib/payment-mail'
import { cancelPayment, missingPayupEnv } from '@/lib/payup'
import {
  MISSING_TABLE_MSG,
  checkLinkInput,
  isExpired,
  type LinkInput,
  type PaymentLinkRow,
} from '@/lib/payment-link-shape'

type Fail = { ok: false; error: string }
const fail = (error: string): Fail => ({ ok: false, error })

/* 서버 액션은 누구나 부를 수 있는 엔드포인트다 — 여기서 권한을 다시 확인한다 */
async function guard() {
  const user = await getAdminUser()
  if (!user) return { error: fail('권한이 없습니다. 다시 로그인해 주세요.') }
  if (!supabaseAdmin) return { error: fail('서버 설정(SUPABASE_SERVICE_ROLE_KEY)이 완료되지 않았습니다.') }
  return { db: supabaseAdmin, email: user.email ?? null }
}

async function load(db: NonNullable<typeof supabaseAdmin>, id: string) {
  const { data, error } = await db.from('payment_links').select('*').eq('id', id).maybeSingle()
  if (error) return { error: fail(isMissingTable(error) ? MISSING_TABLE_MSG : '결제 링크를 불러오지 못했습니다.') }
  if (!data) return { error: fail('결제 링크를 찾을 수 없습니다. 새로고침해 주세요.') }
  return { row: data as PaymentLinkRow }
}

async function mailLink(db: NonNullable<typeof supabaseAdmin>, row: PaymentLinkRow) {
  const sent = await sendLinkMail(row, payUrl(row.token))
  await db
    .from('payment_links')
    .update(sent.ok ? { link_mailed_at: new Date().toISOString(), mail_error: null } : { mail_error: `링크 메일: ${sent.error}` })
    .eq('id', row.id)
  return sent
}

/* 링크 만들기 — 고객 이메일을 적고 sendMail 이면 바로 메일도 보낸다.
   메일이 실패해도 링크는 만들어진다(복사해 문자·카톡으로 보내면 된다). */
export async function createPaymentLink(
  input: LinkInput,
  sendMail: boolean,
): Promise<{ ok: true; url: string; mailed: boolean; mailError: string | null } | Fail> {
  const g = await guard()
  if ('error' in g) return g.error!
  const { db } = g

  const bad = Object.values(checkLinkInput(input))
  if (bad.length > 0) return fail(bad[0]!)

  const { data, error } = await db
    .from('payment_links')
    .insert({
      token: randomToken(),
      order_no: newOrderNo(),
      title: input.title.trim(),
      description: input.description.trim() || null,
      amount: input.amount,
      customer_name: input.customerName.trim() || null,
      customer_email: input.customerEmail.trim() || null,
      customer_tel: input.customerTel.replace(/[\s-]/g, '') || null,
      expires_at: new Date(Date.now() + input.expiresInDays * 86_400_000).toISOString(),
      created_by: g.email,
    })
    .select('*')
    .single()

  if (error || !data) {
    console.error('[admin/payments] 저장 실패:', error?.message)
    return fail(isMissingTable(error) ? MISSING_TABLE_MSG : '결제 링크를 저장하지 못했습니다.')
  }
  const row = data as PaymentLinkRow

  let mailError: string | null = null
  let mailed = false
  if (sendMail && row.customer_email) {
    const sent = await mailLink(db, row)
    mailed = sent.ok
    if (!sent.ok) mailError = sent.error
  }

  revalidatePath('/admin/payments')
  return { ok: true, url: payUrl(row.token), mailed, mailError }
}

export async function resendLinkMail(id: string): Promise<{ ok: true } | Fail> {
  const g = await guard()
  if ('error' in g) return g.error!
  const found = await load(g.db, id)
  if ('error' in found) return found.error!
  const { row } = found

  if (row.status !== 'pending') return fail('결제 대기 중인 링크만 보낼 수 있습니다.')
  if (isExpired(row)) return fail('기한이 지난 링크입니다. 새로 만들어 보내 주세요.')
  if (!row.customer_email) return fail('고객 이메일이 없습니다. 링크를 복사해 직접 보내 주세요.')

  const sent = await mailLink(g.db, row)
  revalidatePath('/admin/payments')
  return sent.ok ? { ok: true } : fail(`메일을 보내지 못했습니다: ${sent.error}`)
}

/* 결제 전 링크 거두기 — 링크를 열면 '취소된 결제 요청' 안내가 뜬다 */
export async function voidPaymentLink(id: string): Promise<{ ok: true } | Fail> {
  const g = await guard()
  if ('error' in g) return g.error!

  const { data, error } = await g.db
    .from('payment_links')
    .update({ status: 'void' })
    .eq('id', id)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle()

  if (error) return fail(isMissingTable(error) ? MISSING_TABLE_MSG : '링크를 취소하지 못했습니다.')
  revalidatePath('/admin/payments')
  if (!data) return fail('결제 대기 중인 링크가 아닙니다. 그사이 결제됐을 수 있으니 새로고침해 확인해 주세요.')
  return { ok: true }
}

/* 결제 완료 건 전액 환불. 부분 환불은 페이업 관리자 화면에서 한다. */
export async function refundPaymentLink(id: string, reason: string): Promise<{ ok: true } | Fail> {
  const g = await guard()
  if ('error' in g) return g.error!
  const found = await load(g.db, id)
  if ('error' in found) return found.error!
  const { row } = found

  if (row.status !== 'paid' || !row.transaction_id) return fail('결제 완료된 건만 환불할 수 있습니다.')
  const missing = missingPayupEnv()
  if (missing.length > 0) return fail(`페이업 설정이 비어 있습니다: ${missing.join(', ')}`)

  try {
    await cancelPayment(row.transaction_id, reason.trim() || '관리자 환불')
  } catch (err) {
    const msg = err instanceof Error ? err.message : '알 수 없는 오류'
    console.error('[admin/payments] 환불 실패:', row.id, msg)
    return fail(`환불하지 못했습니다: ${msg}`)
  }

  const { error } = await g.db
    .from('payment_links')
    .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
    .eq('id', id)
  revalidatePath('/admin/payments')
  if (error) return fail('환불은 되었지만 상태를 기록하지 못했습니다. 새로고침해 확인해 주세요.')
  return { ok: true }
}
