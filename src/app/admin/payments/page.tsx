import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getAdminUser } from '@/lib/admin-auth'
import { supabaseConfigured } from '@/lib/supabase-admin'
import { listPaymentLinks, payUrl } from '@/lib/payment-links-db'
import { missingPayupEnv, payupMode } from '@/lib/payup'
import { PaymentLinkManager } from '@/components/admin/payment-link-manager'

export const metadata: Metadata = {
  title: '결제 링크',
  robots: { index: false, follow: false },
}

export const instant = false

export default async function AdminPaymentsPage() {
  const user = await getAdminUser()
  if (!user) redirect('/admin/login')

  const { rows, error } = await listPaymentLinks()
  const missing = missingPayupEnv()
  const mailReady = Boolean(process.env.RESEND_API_KEY)

  return (
    <main className="min-w-0 flex-1 px-5 py-6 md:px-8">
      <header className="mb-5">
        <h1 className="text-2xl font-bold tracking-tight">결제 링크</h1>
        <p className="mt-1 text-sm text-neutral-500">
          상담으로 정한 금액의 결제 링크를 만들어 메일·문자·카톡으로 보냅니다. 고객이 결제하면 관리자 메일
          (ADMIN_EMAILS)과 고객 메일로 결제 내역이 갑니다.
          {payupMode() === 'test' && <span className="ml-1.5 font-medium text-amber-600">· 페이업 테스트 모드</span>}
        </p>
      </header>

      {!supabaseConfigured && (
        <p className="mb-4 rounded-lg bg-amber-50 px-3.5 py-3 text-sm text-amber-800">
          SUPABASE_SERVICE_ROLE_KEY 가 설정되지 않아 조회가 동작하지 않습니다.
        </p>
      )}
      {error && <p className="mb-4 rounded-lg bg-red-50 px-3.5 py-3 text-sm text-red-700">{error}</p>}
      {missing.length > 0 && (
        <p className="mb-4 rounded-lg bg-amber-50 px-3.5 py-3 text-sm text-amber-800">
          페이업 설정({missing.join(', ')})이 비어 있어 링크는 만들 수 있지만 고객이 결제할 수 없습니다.
        </p>
      )}
      {!mailReady && (
        <p className="mb-4 rounded-lg bg-amber-50 px-3.5 py-3 text-sm text-amber-800">
          RESEND_API_KEY 가 없어 메일을 보낼 수 없습니다. 링크는 복사해 직접 보내 주세요.
        </p>
      )}

      <PaymentLinkManager rows={rows.map((r) => ({ ...r, url: payUrl(r.token) }))} mailReady={mailReady} />
    </main>
  )
}
