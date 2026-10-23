import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getAdminUser } from '@/lib/admin-auth'
import { supabaseConfigured } from '@/lib/supabase-admin'
import { listAllDesignersWithActivity } from '@/lib/designers-db'
import { DesignerTable } from '@/components/admin/designer-table'

export const metadata: Metadata = {
  title: '디자이너 관리 · folio',
  robots: { index: false, follow: false },
}

export const instant = false

export default async function DesignersAdminPage() {
  const user = await getAdminUser()
  if (!user) redirect('/admin/login')

  /* 비밀번호 해시는 이 안에서 떼어내고 활동 집계를 붙여 돌려준다 */
  const designers = await listAllDesignersWithActivity()

  return (
    <main className="min-w-0 flex-1 px-5 py-6 md:px-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">디자이너</h1>
          <p className="mt-1 text-sm text-neutral-500">
            {designers.length}명 · 등록하면 임시 비밀번호가 메일로 발송됩니다
          </p>
        </div>
        <Link
          href="/admin/designers/new"
          className="rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-600"
        >
          디자이너 추가
        </Link>
      </header>

      {!supabaseConfigured && (
        <p className="mb-6 rounded-lg bg-amber-50 px-3.5 py-3 text-sm text-amber-800">
          SUPABASE_SERVICE_ROLE_KEY 가 설정되지 않아 등록·조회가 동작하지 않습니다.
        </p>
      )}

      <DesignerTable designers={designers} />
    </main>
  )
}
