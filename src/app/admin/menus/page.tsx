import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getAdminUser } from '@/lib/admin-auth'
import { getSiteMenus } from '@/lib/site-menus'
import { MenuManager } from '@/components/admin/menu-manager'

export const metadata: Metadata = { title: '메뉴관리', robots: { index: false, follow: false } }
export const instant = false

export default async function AdminMenusPage() {
  if (!(await getAdminUser())) redirect('/admin/login')
  const { menus, error } = await getSiteMenus()

  return (
    <main className="min-w-0 flex-1 px-5 py-6 md:px-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">메뉴관리</h1>
        <p className="mt-1 text-sm text-neutral-500">상단 메뉴의 이름과 노출 여부를 설정합니다.</p>
      </header>
      <div className="max-w-2xl">
        <MenuManager menus={menus} loadError={error} />
      </div>
    </main>
  )
}
