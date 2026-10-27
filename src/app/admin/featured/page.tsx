import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getAdminUser } from '@/lib/admin-auth'
import { supabaseConfigured } from '@/lib/supabase-admin'
import { listFeaturedWorks } from '@/lib/designers-db'
import { FeaturedList } from '@/components/admin/featured-list'

export const metadata: Metadata = {
  title: '메인 노출 · SOOM',
  robots: { index: false, follow: false },
}

export const instant = false

/* 첫 화면은 지금 걸어 둔 구성만 보여준다 — 고르는 일은 /add 에서 한다.
   한 화면에서 둘을 겸하면 후보 수백 장 사이에서 "지금 뭐가 걸려 있지"를
   매번 찾아야 한다. */
export default async function AdminFeaturedPage() {
  const user = await getAdminUser()
  if (!user) redirect('/admin/login')

  const works = await listFeaturedWorks()

  return (
    <main className="min-w-0 flex-1 px-5 py-6 md:px-8">
      <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">메인 노출</h1>
          <p className="mt-1 text-sm text-neutral-500">
            메인 화면에 걸려 있는 작업 {works.length}개
          </p>
        </div>

        <Link
          href="/admin/featured/add"
          className="rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-600"
        >
          작업 추가
        </Link>
      </header>

      {!supabaseConfigured && (
        <p className="mb-6 rounded-lg bg-amber-50 px-3.5 py-3 text-sm text-amber-800">
          SUPABASE_SERVICE_ROLE_KEY 가 설정되지 않아 저장이 동작하지 않습니다.
        </p>
      )}

      <FeaturedList works={works} />
    </main>
  )
}
