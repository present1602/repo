import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getDesignerUser } from '@/lib/designer-auth'
import { SetupGuide } from '@/components/designers/setup-guide'

export const metadata: Metadata = {
  title: '세팅 가이드',
  robots: { index: false, follow: false },
}

export const instant = false

/* 디자이너 세팅 가이드 — 글과 그림뿐인 안내 화면.

   관리 페이지(/studio)의 탭으로 넣지 않고 따로 뒀다. 저 화면은 프로필·
   포트폴리오·설정이 서로 값을 주고받는 곳이라, 기능과 상관없는 안내문이
   그 사이에 끼면 둘 다 읽기 어려워진다. 여기는 로그인 확인 말고는
   다른 기능과 닿는 곳이 없다 — 가이드를 고칠 때 관리 화면을 건드리지
   않고, 관리 화면을 고칠 때 가이드가 깨지지 않는다. */
export default async function DesignerGuidePage() {
  const designer = await getDesignerUser()
  if (!designer) redirect('/studio/login')

  return (
    <main className="min-w-0 flex-1 bg-white">
      <div className="mx-auto max-w-5xl px-4 py-8 md:px-5 md:py-10">
        {/* 돌아갈 길 — 이 화면은 탭 밖이라 좌측 메뉴가 없다 */}
        <Link
          href="/studio"
          className="inline-flex items-center gap-1 text-sm text-neutral-500 transition hover:text-violet-600"
        >
          ← 내 관리 페이지로
        </Link>

        <div className="mt-6">
          <SetupGuide />
        </div>
      </div>
    </main>
  )
}
