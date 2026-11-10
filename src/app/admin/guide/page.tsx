import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getAdminUser } from '@/lib/admin-auth'
import { supabaseConfigured } from '@/lib/supabase-admin'
import { listAllGuideChapters } from '@/lib/guide-db'
import { GuideManager } from '@/components/admin/guide-manager'

export const metadata: Metadata = {
  title: '설정 가이드',
  robots: { index: false, follow: false },
}

export const instant = false

/* 설정 가이드(0024_setup_guide.sql).

   디자이너가 로그인한 뒤 읽는 안내다 — 기능과 엮이지 않고 글과 그림만 보여 준다.
   챕터를 나눠 두고 챕터마다 본문을 글·이미지로 쌓는다. 디자이너 화면은 뒤에 붙인다. */
export default async function AdminGuidePage() {
  const user = await getAdminUser()
  if (!user) redirect('/admin/login')

  const chapters = await listAllGuideChapters()
  const live = chapters.filter((c) => c.visible).length

  return (
    <main className="min-w-0 flex-1 px-5 py-6 md:px-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">설정 가이드</h1>
        <p className="mt-1 text-sm text-neutral-500">
          챕터 {chapters.length}개
          {live > 0 && <span className="ml-1.5 text-violet-600">· 노출 {live}개</span>}
          <span className="mt-1 block text-neutral-400">
            디자이너가 로그인한 뒤 읽는 안내입니다. 챕터마다 글과 이미지를 쌓아 두세요
          </span>
        </p>
      </header>

      {!supabaseConfigured && (
        <p className="mb-6 rounded-lg bg-amber-50 px-3.5 py-3 text-sm text-amber-800">
          SUPABASE_SERVICE_ROLE_KEY 가 설정되지 않아 저장이 동작하지 않습니다.
        </p>
      )}

      <div className="max-w-3xl">
        <GuideManager chapters={chapters} />
      </div>
    </main>
  )
}
