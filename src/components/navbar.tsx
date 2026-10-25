'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { InquiryModal } from '@/components/inquiry/inquiry-modal'

/* 메뉴는 앞으로 더 붙는다 — 배열에 항목만 추가하면 된다.
   탐색은 우상단 버튼으로 따로 두므로 여기 넣지 않는다 — 한 화면에
   같은 곳으로 가는 링크가 둘이면 어느 쪽을 눌러야 할지 묻게 된다. */
const menu = [{ href: '/', label: '홈' }]

export function Navbar() {
  const [inquiry, setInquiry] = useState(false)

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-neutral-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-4 md:px-8">
          <Link href="/" className="text-lg font-black tracking-tight">
            SOOM
          </Link>

          {/* 현재 경로는 런타임에만 알 수 있어 프리렌더를 막는다.
              강조 표시만 Suspense 뒤로 넘기고, 링크 자체는 셸에 함께 나간다 —
              그래야 메뉴가 늦게 떠서 깜빡이지 않는다. */}
          <Suspense fallback={<MenuLinks />}>
            <MenuWithCurrent />
          </Suspense>

          <div className="ml-auto flex items-center gap-5">
            <Link
              href="/explore"
              className="text-sm font-medium text-neutral-600 transition hover:text-neutral-900"
            >
              탐색
            </Link>

            {/* 가장 하고 싶은 일 — 유일하게 색을 채운 버튼으로 둔다.
                페이지를 옮기지 않고 그 자리에서 폼을 띄운다. */}
            <button
              type="button"
              onClick={() => setInquiry(true)}
              className="rounded-lg bg-violet-600 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-violet-700"
            >
              의뢰하기
            </button>
          </div>
        </div>
      </header>

      {/* 모달은 헤더 밖에 둔다 — 헤더가 sticky 라 그 안의 fixed 는
          뷰포트가 아니라 헤더를 기준으로 자리잡는다(56px 안에 갇힌다).
          position 이 static 이 아닌 조상은 fixed 의 기준이 된다. */}
      {inquiry && <InquiryModal onClose={() => setInquiry(false)} />}
    </>
  )
}

function MenuWithCurrent() {
  const pathname = usePathname()
  return <MenuLinks pathname={pathname} />
}

/* pathname 을 모르면 아무것도 강조하지 않는다 — 링크 위치와 글자는 같다 */
function MenuLinks({ pathname }: { pathname?: string }) {
  return (
    <nav className="flex gap-5 text-sm">
      {menu.map((m) => {
        /* 홈('/')은 접두사로 비교하면 모든 경로에 걸린다 — 정확히 같을 때만 */
        const on = !pathname
          ? false
          : m.href === '/'
            ? pathname === '/'
            : pathname === m.href || pathname.startsWith(`${m.href}/`)

        return (
          <Link
            key={m.href}
            href={m.href}
            className={`transition ${
              on ? 'font-semibold text-neutral-900' : 'text-neutral-500 hover:text-neutral-900'
            }`}
          >
            {m.label}
          </Link>
        )
      })}
    </nav>
  )
}
