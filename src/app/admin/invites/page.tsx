import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getAdminUser } from '@/lib/admin-auth'
import { supabaseConfigured } from '@/lib/supabase-admin'
import { listInvites } from '@/lib/invites-db'
import { InviteManager } from '@/components/admin/invite-manager'

export const metadata: Metadata = {
  title: '초대코드 · SOOM',
  robots: { index: false, follow: false },
}

export const instant = false

export default async function AdminInvitesPage() {
  const user = await getAdminUser()
  if (!user) redirect('/admin/login')

  const invites = await listInvites()
  const active = invites.filter((i) => i.status === 'active').length

  return (
    <main className="min-w-0 flex-1 px-5 py-6 md:px-8">
      <header className="mb-5">
        <h1 className="text-2xl font-bold tracking-tight">초대코드</h1>
        <p className="mt-1 text-sm text-neutral-500">
          디자이너가 <span className="font-medium text-neutral-700">/studio/signup</span> 에서 이 코드로 직접
          가입합니다. 코드 하나로 한 명만 가입할 수 있습니다.
          {active > 0 && <span className="ml-1.5 text-violet-600">· 사용 가능 {active}개</span>}
        </p>
      </header>

      {!supabaseConfigured && (
        <p className="mb-6 rounded-lg bg-amber-50 px-3.5 py-3 text-sm text-amber-800">
          SUPABASE_SERVICE_ROLE_KEY 가 설정되지 않아 조회가 동작하지 않습니다.
        </p>
      )}

      <InviteManager invites={invites} />
    </main>
  )
}
