'use server'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { SITE_URL } from '@/lib/site-url'
import { confirmPayment, getPaymentLinkByToken, randomToken } from '@/lib/payment-links-db'
import { merchantId, missingPayupEnv } from '@/lib/payup'
import { checkBuyer, isExpired, type BuyerInput } from '@/lib/payment-link-shape'

/* PC 결제창이 끝나면 — 페이지를 떠나지 않고 여기서 승인한다.
   실패해도 고객이 적은 값과 화면이 그대로 남아 에러를 읽고 다시 시도할 수 있다.
   (모바일은 결제창으로 페이지가 넘어가므로 /api/payup/return 이 받는다) */
export async function confirmFromWindow(
  token: string,
  form: { transactionId: string; orderNumber: string; amount: string | null },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const r = await confirmPayment({ token, ...form })
  return r.ok ? { ok: true } : { ok: false, error: r.error }
}

export type PayData = {
  merchantId: string
  itemName: string
  amount: string
  userName: string
  orderNumber: string
  returnUrl: string
  mobileNumber?: string
}

/* 결제하기를 누르면 — 상태를 다시 확인하고, 결제자 정보를 남기고,
   이번 시도의 주문번호를 만들어 결제창에 실을 값을 돌려준다.
   금액은 여기서 DB 값으로 정한다. 그래도 브라우저에서 고칠 수 있으므로
   승인(/api/payup/return)에서 한 번 더 DB 값으로 맞춘다. */
export async function startPayment(
  token: string,
  buyer: BuyerInput,
): Promise<{ ok: true; data: PayData } | { ok: false; error: string }> {
  const db = supabaseAdmin
  if (!db) return { ok: false, error: '서버 설정이 완료되지 않았습니다. 잠시 후 다시 시도해 주세요.' }

  const missing = missingPayupEnv()
  if (missing.length > 0) {
    console.error('[pay] 페이업 환경변수 누락:', missing.join(', '))
    return { ok: false, error: '결제 설정이 아직 끝나지 않았습니다. 담당자에게 알려 주세요.' }
  }

  const bad = Object.values(checkBuyer(buyer))
  if (bad.length > 0) return { ok: false, error: bad[0]! }

  const { row, error } = await getPaymentLinkByToken(token)
  /* 고객 화면이다 — 마이그레이션 안내 같은 내부 문구는 로그로만 남긴다 */
  if (error) return { ok: false, error: '결제 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.' }
  if (!row) return { ok: false, error: '결제 요청을 찾을 수 없습니다.' }
  if (row.status === 'paid') return { ok: false, error: '이미 결제가 완료되었습니다. 새로고침해 주세요.' }
  if (row.status !== 'pending') return { ok: false, error: '취소된 결제 요청입니다.' }
  if (isExpired(row)) return { ok: false, error: '결제 기한이 지났습니다. 담당자에게 새 링크를 요청해 주세요.' }

  const orderNumber = `${row.order_no}-${randomToken(4).replace(/[-_]/g, 'x').toUpperCase()}`
  const tel = buyer.tel.replace(/[\s-]/g, '')

  const { error: upErr } = await db
    .from('payment_links')
    .update({
      buyer_name: buyer.name.trim(),
      buyer_email: buyer.email.trim(),
      buyer_tel: tel || null,
      order_number: orderNumber,
      last_error: null,
    })
    .eq('id', row.id)
    .eq('status', 'pending')
  if (upErr) {
    console.error('[pay] 결제자 정보 저장 실패:', upErr.message)
    return { ok: false, error: '결제를 준비하지 못했습니다. 잠시 후 다시 시도해 주세요.' }
  }

  return {
    ok: true,
    data: {
      merchantId: merchantId(),
      itemName: row.title,
      amount: String(row.amount),
      userName: buyer.name.trim(),
      orderNumber,
      /* 모바일 결제창은 이 주소로 돌아온다 */
      returnUrl: `${SITE_URL}/api/payup/return?t=${encodeURIComponent(row.token)}`,
      ...(tel ? { mobileNumber: tel } : {}),
    },
  }
}
