import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getAdminUser } from '@/lib/admin-auth'
import { getDesignerById, listWorks } from '@/lib/designers-db'
import { displayName } from '@/lib/display-name'
import { DesignerDetail } from '@/components/admin/designer-detail'
import { AdminPortfolio } from '@/components/admin/admin-portfolio'

export const instant = false

export async function generateMetadata(
  props: PageProps<'/admin/designers/[id]'>,
): Promise<Metadata> {
  const { id } = await props.params
  const d = await getDesignerById(id)
  return {
    title: d ? `${displayName(d)} · 디자이너 관리` : '디자이너를 찾을 수 없습니다',
    robots: { index: false, follow: false },
  }
}

export default async function DesignerDetailPage(props: PageProps<'/admin/designers/[id]'>) {
  const user = await getAdminUser()
  if (!user) redirect('/admin/login')

  const { id } = await props.params
  const designer = await getDesignerById(id)
  if (!designer) notFound()

  const works = await listWorks(id)

  /* 비밀번호 해시는 화면으로 내려보내지 않는다 */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password_hash, ...safe } = designer

  return (
    <main className="min-w-0 flex-1 px-5 py-6 md:px-8">
      <nav className="mb-5 text-sm">
        <Link href="/admin/designers" className="text-neutral-500 transition hover:text-neutral-900">
          ← 디자이너 목록
        </Link>
      </nav>

      {/* 좌측 디자이너 정보 · 우측 포트폴리오.
          정보 칸은 폭을 고정해 입력칸이 늘어지지 않게 한다. */}
      <div className="grid gap-8 xl:grid-cols-[22rem_minmax(0,1fr)]">
        <DesignerDetail designer={safe} />
        <AdminPortfolio designerId={id} works={works} />
      </div>
    </main>
  )
}
