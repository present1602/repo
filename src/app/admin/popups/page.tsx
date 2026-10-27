import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getAdminUser } from '@/lib/admin-auth'
import { supabaseConfigured } from '@/lib/supabase-admin'
import { listPopups } from '@/lib/popups-db'
import { PopupList } from '@/components/admin/popup-list'

export const metadata: Metadata = {
  title: '팝업 · SOOM',
  robots: { index: false, follow: false },
}

export const instant = false

export default async function AdminPopupsPage() {
  const user = await getAdminUser()
  if (!user) redirect('/admin/login')

  const popups = await listPopups()
  const live = popups.filter((p) => p.status === 'visible').length

  return (
    <main className="min-w-0 flex-1 px-5 py-6 md:px-8">
      <header className="mb-5 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">팝업</h1>
          <p className="mt-1 text-sm text-neutral-500">
            홈 화면에 뜨는 팝업 {popups.length}개
            {live > 0 && <span className="ml-1.5 text-violet-600">· 노출 {live}개</span>}
          </p>
        </div>
        <Link
          href="/admin/popups/new"
          className="rounded-lg bg-neutral-900 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-violet-600"
        >
          팝업 추가
        </Link>
      </header>

      {!supabaseConfigured && (
        <p className="mb-6 rounded-lg bg-amber-50 px-3.5 py-3 text-sm text-amber-800">
          SUPABASE_SERVICE_ROLE_KEY 가 설정되지 않아 조회가 동작하지 않습니다.
        </p>
      )}

      <PopupList popups={popups} />
    </main>
  )
}
