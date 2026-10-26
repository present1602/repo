import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getAdminUser } from '@/lib/admin-auth'
import { supabaseConfigured } from '@/lib/supabase-admin'
import { listApplications } from '@/lib/applications-db'
import { ApplicationList } from '@/components/admin/application-list'

export const metadata: Metadata = {
  title: '지원서 · folio',
  robots: { index: false, follow: false },
}

export const instant = false

/* 제안서(v1-3)에서 들어온 디자이너 지원서 */
export default async function AdminApplicationsPage() {
  const user = await getAdminUser()
  if (!user) redirect('/admin/login')

  const applications = await listApplications()
  const unread = applications.filter((a) => a.status === 'unread').length

  return (
    <main className="min-w-0 flex-1 px-5 py-6 md:px-8">
      <header className="mb-5">
        <h1 className="text-2xl font-bold tracking-tight">지원서</h1>
        <p className="mt-1 text-sm text-neutral-500">
          제안서로 들어온 디자이너 지원 {applications.length}건
          {unread > 0 && <span className="ml-1.5 text-violet-600">· 미확인 {unread}건</span>}
        </p>
      </header>

      {!supabaseConfigured && (
        <p className="mb-6 rounded-lg bg-amber-50 px-3.5 py-3 text-sm text-amber-800">
          SUPABASE_SERVICE_ROLE_KEY 가 설정되지 않아 조회가 동작하지 않습니다.
        </p>
      )}

      <ApplicationList applications={applications} />
    </main>
  )
}
