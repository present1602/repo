import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getAdminUser } from '@/lib/admin-auth'
import { supabaseConfigured } from '@/lib/supabase-admin'
import { listWorksForFeature } from '@/lib/designers-db'
import { FeaturedManager } from '@/components/admin/featured-manager'

export const metadata: Metadata = {
  title: '메인 노출 · folio',
  robots: { index: false, follow: false },
}

export const instant = false

export default async function AdminFeaturedPage() {
  const user = await getAdminUser()
  if (!user) redirect('/admin/login')

  const works = await listWorksForFeature()

  return (
    <main className="min-w-0 flex-1 px-5 py-6 md:px-8">
      {!supabaseConfigured && (
        <p className="mb-6 rounded-lg bg-amber-50 px-3.5 py-3 text-sm text-amber-800">
          SUPABASE_SERVICE_ROLE_KEY 가 설정되지 않아 저장이 동작하지 않습니다.
        </p>
      )}

      <FeaturedManager works={works} />
    </main>
  )
}
