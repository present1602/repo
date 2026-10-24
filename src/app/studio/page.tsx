import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getDesignerUser } from '@/lib/designer-auth'
import { listWorks } from '@/lib/designers-db'
import { getPlanCopy } from '@/lib/site-settings'
import { displayName } from '@/lib/display-name'
import { logout } from './actions'
import { DesignerConsole } from '@/components/designers/console'

export const metadata: Metadata = {
  title: '내 관리 페이지 · folio',
  robots: { index: false, follow: false },
}

export const instant = false

export default async function DesignerHomePage() {
  const d = await getDesignerUser()
  if (!d) redirect('/studio/login')

  const [works, planCopy] = await Promise.all([listWorks(d.id), getPlanCopy()])

  /* 비밀번호 해시는 화면으로 내려보내지 않는다 */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password_hash, ...safe } = d

  return (
    <main className="min-h-full flex-1 bg-white">
      <div className="mx-auto max-w-3xl px-5 py-10 md:px-8">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight">{displayName(d)}</h1>
            <p className="mt-1 text-sm text-neutral-500">{d.email}</p>
          </div>
          <form action={logout}>
            <button className="rounded-md border border-neutral-300 px-2.5 py-1.5 text-xs font-medium text-neutral-700 transition hover:bg-neutral-100">
              로그아웃
            </button>
          </form>
        </header>

        <div className="mt-8">
          <DesignerConsole designer={safe} works={works} planCopy={planCopy} />
        </div>
      </div>
    </main>
  )
}
