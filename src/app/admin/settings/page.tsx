import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getAdminUser } from '@/lib/admin-auth'
import { supabaseConfigured } from '@/lib/supabase-admin'
import { getPlanCopy } from '@/lib/site-settings'
import { PlanCopyForm } from '@/components/admin/plan-copy-form'

export const metadata: Metadata = {
  title: '설정 · folio',
  robots: { index: false, follow: false },
}

export const instant = false

export default async function AdminSettingsPage() {
  const user = await getAdminUser()
  if (!user) redirect('/admin/login')

  const copy = await getPlanCopy()

  return (
    <main className="min-w-0 flex-1 px-5 py-6 md:px-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">설정</h1>
        <p className="mt-1 text-sm text-neutral-500">
          모든 디자이너에게 공통으로 적용되는 값입니다
        </p>
      </header>

      {!supabaseConfigured && (
        <p className="mb-6 rounded-lg bg-amber-50 px-3.5 py-3 text-sm text-amber-800">
          SUPABASE_SERVICE_ROLE_KEY 가 설정되지 않아 저장이 동작하지 않습니다.
        </p>
      )}

      <div className="max-w-2xl">
        <PlanCopyForm copy={copy} />
      </div>
    </main>
  )
}
