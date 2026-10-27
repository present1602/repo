import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getAdminUser } from '@/lib/admin-auth'
import { listWorksPage } from '@/lib/designers-db'
import { WorksGrid } from '@/components/admin/works-grid'

export const metadata: Metadata = {
  title: '포트폴리오 · SOOM',
  robots: { index: false, follow: false },
}

export const instant = false

/* 한 쪽에 30개 — 3열이면 10줄 */
const PAGE_SIZE = 30

/* 모든 디자이너의 작업을 올라온 순서대로 훑어보는 화면.
   카드를 누르면 상세 모달이, 디자이너 이름을 누르면 그 디자이너의
   관리 화면이 열린다 — 고치는 일은 거기서 한다. */
export default async function AdminWorksPage(props: PageProps<'/admin/works'>) {
  const user = await getAdminUser()
  if (!user) redirect('/admin/login')

  const sp = await props.searchParams
  const page = Math.max(1, Math.floor(Number(sp.page)) || 1)
  const { works, total } = await listWorksPage(page, PAGE_SIZE)
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <main className="min-w-0 flex-1 px-5 py-6 md:px-8">
      <div className="mb-6 flex items-baseline justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">포트폴리오</h1>
        <span className="text-sm text-neutral-500">최신순 · 전체 {total}개</span>
      </div>

      {works.length === 0 ? (
        <p className="rounded-xl border border-dashed border-neutral-300 py-16 text-center text-sm text-neutral-500">
          {total === 0 ? '아직 올라온 작업이 없습니다.' : '이 쪽에는 작업이 없습니다.'}
        </p>
      ) : (
        <WorksGrid works={works} />
      )}

      {pages > 1 && <Pager page={page} pages={pages} />}
    </main>
  )
}

/* 쪽 이동 — 처음·끝과 지금 쪽 앞뒤 두 쪽만 번호로, 나머지는 … 로 접는다 */
function Pager({ page, pages }: { page: number; pages: number }) {
  const nums = Array.from({ length: pages }, (_, i) => i + 1).filter(
    (n) => n === 1 || n === pages || Math.abs(n - page) <= 2,
  )

  const item = 'grid h-8 min-w-8 place-items-center rounded-md px-2 text-sm transition'

  return (
    <nav className="mt-8 flex flex-wrap items-center justify-center gap-1" aria-label="쪽 이동">
      {page > 1 ? (
        <Link href={`?page=${page - 1}`} className={`${item} text-neutral-600 hover:bg-neutral-100`}>
          ←
        </Link>
      ) : (
        <span className={`${item} text-neutral-300`}>←</span>
      )}

      {nums.map((n, i) => (
        <span key={n} className="flex items-center gap-1">
          {i > 0 && n - nums[i - 1] > 1 && <span className="px-1 text-neutral-400">…</span>}
          <Link
            href={`?page=${n}`}
            aria-current={n === page ? 'page' : undefined}
            className={`${item} ${
              n === page ? 'bg-violet-50 font-semibold text-violet-700' : 'text-neutral-600 hover:bg-neutral-100'
            }`}
          >
            {n}
          </Link>
        </span>
      ))}

      {page < pages ? (
        <Link href={`?page=${page + 1}`} className={`${item} text-neutral-600 hover:bg-neutral-100`}>
          →
        </Link>
      ) : (
        <span className={`${item} text-neutral-300`}>→</span>
      )}
    </nav>
  )
}
