import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getAdminUser } from '@/lib/admin-auth'
import { supabaseConfigured } from '@/lib/supabase-admin'
import { listAllDesigners } from '@/lib/designers-db'
import { listRosterDesigners, listRosterFiles, listRosterLinks, listRosterOpens, rosterUrl } from '@/lib/roster-db'
import { displayName } from '@/lib/display-name'
import { RosterManager } from '@/components/admin/roster-manager'

export const metadata: Metadata = {
  title: '경력 페이지',
  robots: { index: false, follow: false },
}

export const instant = false

export default async function AdminRosterPage() {
  const user = await getAdminUser()
  if (!user) redirect('/admin/login')

  const [designers, links, accounts] = await Promise.all([
    listRosterDesigners(),
    listRosterLinks(),
    listAllDesigners(),
  ])
  const [opens, files] = await Promise.all([
    listRosterOpens(links.rows.map((r) => r.id)),
    listRosterFiles(designers.rows.map((d) => d.id)),
  ])
  const error = designers.error ?? links.error

  /* '포트폴리오 보기' 로 연결할 공개 프로필 후보 — 비공개면 상세가 404 라 표시해 둔다 */
  const options = accounts
    .map((d) => ({
      id: d.id,
      label: displayName(d),
      isPublic: d.visible && d.profile_public,
    }))
    .sort((a, b) => a.label.localeCompare(b.label, 'ko'))

  return (
    <main className="min-w-0 flex-1 px-5 py-6 md:px-8">
      <header className="mb-5">
        <h1 className="text-2xl font-bold tracking-tight">경력 페이지</h1>
        <p className="mt-1 text-sm text-neutral-500">
          디자이너 실명·경력을 한 페이지에 모아 둡니다. 공개되지 않는 페이지라, 아래에서 기한 있는 링크를 만들어
          건넨 사람만 볼 수 있습니다.
        </p>
      </header>

      {!supabaseConfigured && (
        <p className="mb-4 rounded-lg bg-amber-50 px-3.5 py-3 text-sm text-amber-800">
          SUPABASE_SERVICE_ROLE_KEY 가 설정되지 않아 조회가 동작하지 않습니다.
        </p>
      )}
      {error && <p className="mb-4 rounded-lg bg-red-50 px-3.5 py-3 text-sm text-red-700">{error}</p>}
      {/* 링크 표는 있는데 열람 기록 표만 없을 때 — 링크 관리는 되고 IP·브라우저만 안 남는다 */}
      {!error &&
        [opens.error, files.error].filter(Boolean).map((msg) => (
          <p key={msg} className="mb-4 rounded-lg bg-amber-50 px-3.5 py-3 text-sm text-amber-800">
            {msg}
          </p>
        ))}

      <RosterManager
        designers={designers.rows}
        links={links.rows.map((r) => ({ ...r, url: rosterUrl(r.token), opens: opens.byLink.get(r.id) ?? [] }))}
        options={options}
        files={Object.fromEntries(files.byDesigner)}
        filesReady={!files.error}
      />
    </main>
  )
}
