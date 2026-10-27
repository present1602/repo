import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getAdminUser } from '@/lib/admin-auth'
import { PopupForm } from '@/components/admin/popup-form'

export const metadata: Metadata = {
  title: '팝업 추가 · SOOM',
  robots: { index: false, follow: false },
}

export const instant = false

export default async function NewPopupPage() {
  const user = await getAdminUser()
  if (!user) redirect('/admin/login')

  return (
    <main className="min-w-0 flex-1 px-5 py-6 md:px-8">
      <nav className="mb-5 text-sm">
        <Link href="/admin/popups" className="text-neutral-500 transition hover:text-neutral-900">
          ← 팝업 목록
        </Link>
      </nav>

      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">팝업 추가</h1>
        <p className="mt-1 text-sm text-neutral-500">
          본문만 채우면 등록됩니다. 이미지 한 장만 넣어도 됩니다.
        </p>
      </header>

      <PopupForm />
    </main>
  )
}
