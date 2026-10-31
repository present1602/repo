import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getAdminUser } from '@/lib/admin-auth'
import { supabaseConfigured } from '@/lib/supabase-admin'
import { listInquiries } from '@/lib/inquiries-db'
import { listAllDesigners } from '@/lib/designers-db'
import { InquiryList } from '@/components/admin/inquiry-list'

export const metadata: Metadata = {
  title: '문의 · SOOM',
  robots: { index: false, follow: false },
}

export const instant = false

export default async function AdminInquiriesPage() {
  const user = await getAdminUser()
  if (!user) redirect('/admin/login')

  /* 후기 링크를 보낼 때 디자이너를 고를 수 있어야 한다 —
     의뢰에 담당이 비어 있는 경우(네비바에서 들어온 일반 문의)가 있다. */
  const [inquiries, designers] = await Promise.all([listInquiries(), listAllDesigners()])
  const unread = inquiries.filter((q) => q.status === 'unread').length

  /* 고르는 데 필요한 것만 넘긴다 — 이름이 비어 있으면 이메일 앞부분을 쓴다 */
  const options = designers.map((d) => ({
    id: d.id,
    name: d.name,
    label: d.name?.trim() || d.email.split('@')[0],
  }))

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

      <InquiryList inquiries={inquiries} designers={options} />
    </main>
  )
}
