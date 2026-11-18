import 'server-only'
import { connection } from 'next/server'
import { supabaseAdmin } from './supabase-admin'
import { SITE_URL } from './site-url'
import { approvePayment, kstStampToIso } from './payup'
import { sendPaidMail } from './payment-mail'
import { MISSING_TABLE_MSG, type PaymentLinkRow } from './payment-link-shape'

/* 결제 링크 조회·결제 확정(0031_payment_links.sql). RLS 로 막힌 표라 service_role 로만 닿는다. */

export function payUrl(token: string) {
  return `${SITE_URL}/pay/${token}`
}

/* 0031 전이면 표가 없다 — PostgREST 는 PGRST205, Postgres 는 42P01 */
export function isMissingTable(err: { code?: string; message?: string } | null | undefined) {
  if (!err) return false
  return err.code === 'PGRST205' || err.code === '42P01' || /payment_links/.test(err.message ?? '')
}

export async function listPaymentLinks(): Promise<{ rows: PaymentLinkRow[]; error: string | null }> {
  if (!supabaseAdmin) return { rows: [], error: null }
  await connection()
  const { data, error } = await supabaseAdmin
    .from('payment_links')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(300)
  if (error) {
    console.error('[payment] 목록 조회 실패:', error.message)
    return { rows: [], error: isMissingTable(error) ? MISSING_TABLE_MSG : '결제 링크 목록을 불러오지 못했습니다.' }
  }
  return { rows: (data ?? []) as PaymentLinkRow[], error: null }
}

export async function getPaymentLinkByToken(
  token: string,
): Promise<{ row: PaymentLinkRow | null; error: string | null }> {
  if (!supabaseAdmin) return { row: null, error: '서버 설정이 완료되지 않았습니다.' }
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) return { row: null, error: null }
  const { data, error } = await supabaseAdmin.from('payment_links').select('*').eq('token', token).maybeSingle()
  if (error) {
    console.error('[payment] 링크 조회 실패:', error.message)
    return { row: null, error: isMissingTable(error) ? MISSING_TABLE_MSG : '결제 정보를 불러오지 못했습니다.' }
  }
  return { row: (data as PaymentLinkRow | null) ?? null, error: null }
}

/* URL 에 넣어도 안전한 난수 */
export function randomToken(bytes = 18) {
  const b = new Uint8Array(bytes)
  crypto.getRandomValues(b)
  return Buffer.from(b).toString('base64url')
}

/* 주문번호 앞 토막 — SM + 날짜 + 난수. 페이업 주문번호는 128자까지 */
export function newOrderNo() {
  const d = new Date(Date.now() + 9 * 3600_000).toISOString().slice(2, 10).replace(/-/g, '')
  return `SM${d}${randomToken(5).replace(/[-_]/g, 'x').toUpperCase()}`
}

export type ConfirmResult = { ok: true; row: PaymentLinkRow } | { ok: false; error: string; row?: PaymentLinkRow }

/* 페이업이 넘긴 거래번호로 결제를 승인하고 기록한다.
   결제창에서 온 값(금액)은 믿지 않는다 — 금액은 DB 값으로, 주문번호는 이 링크의 것인지 확인한다. */
export async function confirmPayment(input: {
  token: string
  transactionId: string
  orderNumber: string
  amount: string | null
}): Promise<ConfirmResult> {
  const db = supabaseAdmin
  if (!db) return { ok: false, error: '서버 설정이 완료되지 않았습니다.' }

  const { row, error } = await getPaymentLinkByToken(input.token)
  if (error) return { ok: false, error }
  if (!row) return { ok: false, error: '결제 요청을 찾을 수 없습니다.' }

  /* 이미 끝난 건 — 새로고침·뒤로가기로 같은 폼이 두 번 올 수 있다 */
  if (row.status === 'paid') return { ok: true, row }
  if (row.status !== 'pending') return { ok: false, error: '결제할 수 없는 상태의 요청입니다.', row }

  const fail = async (msg: string) => {
    await db.from('payment_links').update({ last_error: msg.slice(0, 500) }).eq('id', row.id).eq('status', 'pending')
    return { ok: false as const, error: msg, row }
  }

  if (!input.transactionId) return fail('결제가 완료되지 않았습니다.')
  if (!input.orderNumber.startsWith(`${row.order_no}-`)) return fail('이 결제 요청의 주문번호가 아닙니다.')
  /* 결제창에 실린 금액이 다르면 누군가 고친 것 — 승인하지 않는다 */
  if (input.amount !== null && Number(input.amount) !== row.amount) return fail('결제 금액이 요청 금액과 다릅니다.')

  let approval
  try {
    approval = await approvePayment({
      transactionId: input.transactionId,
      orderNumber: input.orderNumber,
      amount: row.amount,
    })
  } catch (err) {
    /* 같은 거래가 동시에 두 번 승인을 시도했을 수 있다 — 다른 쪽이 먼저 끝냈는지 본다 */
    const again = await getPaymentLinkByToken(input.token)
    if (again.row?.status === 'paid') return { ok: true, row: again.row }
    const msg = err instanceof Error ? err.message : '결제 승인에 실패했습니다.'
    return fail(msg)
  }

  const paidAt = kstStampToIso(approval.authDatetime) ?? new Date().toISOString()
  const { data: updated, error: upErr } = await db
    .from('payment_links')
    .update({
      status: 'paid',
      order_number: approval.orderNumber,
      transaction_id: approval.transactionId,
      auth_number: approval.authNumber,
      card_name: approval.cardName,
      card_no: approval.cardNo,
      quota: approval.quota,
      paid_at: paidAt,
      last_error: null,
    })
    .eq('id', row.id)
    .eq('status', 'pending')
    .select('*')
    .maybeSingle()

  if (upErr || !updated) {
    /* 돈은 나갔는데 기록을 못 했다 — 고객에게는 완료로 보여 주고, 로그로 남긴다.
       어드민은 페이업 관리자 화면의 거래번호로 찾을 수 있다. */
    console.error('[payment] 승인 후 기록 실패 — 수동 확인 필요:', row.id, approval.transactionId, upErr?.message)
    const again = await getPaymentLinkByToken(input.token)
    if (again.row?.status === 'paid') return { ok: true, row: again.row }
    return { ok: true, row: { ...row, status: 'paid', transaction_id: approval.transactionId, paid_at: paidAt } }
  }

  const paid = updated as PaymentLinkRow
  /* 메일이 실패해도 결제는 끝났다 — 기록만 남긴다 */
  const sent = await sendPaidMail(paid, payUrl(paid.token))
  await db
    .from('payment_links')
    .update(sent.ok ? { paid_mailed_at: new Date().toISOString(), mail_error: null } : { mail_error: sent.error })
    .eq('id', paid.id)

  return { ok: true, row: paid }
}
