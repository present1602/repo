import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getAdminUser } from '@/lib/admin-auth'
import { supabaseConfigured } from '@/lib/supabase-admin'
import { listInquiries } from '@/lib/inquiries-db'
import { InquiryList } from '@/components/admin/inquiry-list'

export const metadata: Metadata = {
  title: '문의 · folio',
  robots: { index: false, follow: false },
}

export const instant = false

export default async function AdminInquiriesPage() {
  const user = await getAdminUser()
  if (!user) redirect('/admin/login')

  const inquiries = await listInquiries()
  const unread = inquiries.filter((q) => q.status === 'unread').length

  return (
    <main className="min-w-0 flex-1 px-5 py-6 md:px-8">
      <header className="mb-5">
        <h1 className="text-2xl font-bold tracking-tight">문의</h1>
        <p className="mt-1 text-sm text-neutral-500">
          들어온 의뢰 문의 {inquiries.length}건
          {unread > 0 && <span className="ml-1.5 text-violet-600">· 미확인 {unread}건</span>}
        </p>
      </header>

      {!supabaseConfigured && (
        <p className="mb-6 rounded-lg bg-amber-50 px-3.5 py-3 text-sm text-amber-800">
          SUPABASE_SERVICE_ROLE_KEY 가 설정되지 않아 조회가 동작하지 않습니다.
        </p>
      )}

      <InquiryList inquiries={inquiries} />
    </main>
  )
}
