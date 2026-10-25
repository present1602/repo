import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getAdminUser } from '@/lib/admin-auth'
import { supabaseConfigured } from '@/lib/supabase-admin'
import { listWorksForFeature } from '@/lib/designers-db'
import { FeaturedPicker } from '@/components/admin/featured-picker'

export const metadata: Metadata = {
  title: '메인 노출 작업 고르기 · folio',
  robots: { index: false, follow: false },
}

export const instant = false

/* 메인에 걸 작업을 고르는 화면.

   첫 화면(/admin/featured)은 걸어 둔 구성만 보여주고, 후보 전체는
   여기서만 받는다 — 한 화면에서 둘을 겸하면 수백 장 사이에서
   "지금 뭐가 걸려 있지"를 매번 찾아야 한다. */
export default async function AdminFeaturedAddPage() {
  const user = await getAdminUser()
  if (!user) redirect('/admin/login')

  const works = await listWorksForFeature()

  return (
    <main className="min-w-0 flex-1 px-5 py-6 md:px-8">
      <nav className="mb-5 text-sm">
        <Link href="/admin/featured" className="text-neutral-500 transition hover:text-neutral-900">
          ← 메인 노출
        </Link>
      </nav>

      {!supabaseConfigured && (
        <p className="mb-6 rounded-lg bg-amber-50 px-3.5 py-3 text-sm text-amber-800">
          SUPABASE_SERVICE_ROLE_KEY 가 설정되지 않아 저장이 동작하지 않습니다.
        </p>
      )}

      <FeaturedPicker works={works} />
    </main>
  )
}
