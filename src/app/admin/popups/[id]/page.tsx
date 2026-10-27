import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getAdminUser } from '@/lib/admin-auth'
import { getPopup } from '@/lib/popups-db'
import { PopupForm } from '@/components/admin/popup-form'

export const metadata: Metadata = {
  title: '팝업 수정 · SOOM',
  robots: { index: false, follow: false },
}

export const instant = false

export default async function EditPopupPage(props: PageProps<'/admin/popups/[id]'>) {
  const user = await getAdminUser()
  if (!user) redirect('/admin/login')

  const { id } = await props.params
  const popup = await getPopup(id)
  if (!popup) notFound()

  return (
    <main className="min-w-0 flex-1 px-5 py-6 md:px-8">
      <nav className="mb-5 text-sm">
        <Link href="/admin/popups" className="text-neutral-500 transition hover:text-neutral-900">
          ← 팝업 목록
        </Link>
      </nav>

      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">팝업 수정</h1>
      </header>

      {/* 저장 뒤 새 값으로 다시 그리도록 — 폼은 처음 받은 값으로 상태를 잡는다 */}
      <PopupForm key={popup.updated_at} popup={popup} />
    </main>
  )
}
