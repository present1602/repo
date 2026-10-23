import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getAdminUser } from '@/lib/admin-auth'
import { DesignerCreateForm } from '@/components/admin/designer-create-form'

export const metadata: Metadata = {
  title: '디자이너 추가 · folio',
  robots: { index: false, follow: false },
}

export const instant = false

export default async function NewDesignerPage() {
  const user = await getAdminUser()
  if (!user) redirect('/admin/login')

  return (
    <main className="min-w-0 flex-1 px-5 py-6 md:px-8">
      <nav className="mb-5 text-sm">
        <Link href="/admin/designers" className="text-neutral-500 transition hover:text-neutral-900">
          ← 디자이너 목록
        </Link>
      </nav>

      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">디자이너 추가</h1>
        <p className="mt-1 text-sm text-neutral-500">
          이메일만 있으면 등록됩니다. 나머지는 디자이너가 직접 채울 수 있습니다.
        </p>
      </header>

      <div className="max-w-2xl">
        <DesignerCreateForm />
      </div>
    </main>
  )
}
