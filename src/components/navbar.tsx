'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

// 메뉴는 앞으로 더 붙는다 — 배열에 항목만 추가하면 된다
const menu = [
  { href: '/', label: '홈' },
  { href: '/explore', label: '탐색' },
]

export function Navbar() {
  return (
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

        <Link
          href="/studio"
          className="ml-auto rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium transition hover:border-neutral-900"
        >
          시안 목록
        </Link>
      </div>
    </header>
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
