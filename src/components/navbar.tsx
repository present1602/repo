'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

// 메뉴는 앞으로 더 붙는다 — 배열에 항목만 추가하면 된다
const menu = [{ href: '/explore', label: '탐색' }]

export function Navbar() {
  return (
    <header className="sticky top-0 z-20 border-b border-neutral-200 bg-white/90 backdrop-blur">
      <div className="flex h-14 items-center gap-4 px-4 md:px-6">
        <Link href="/" className="flex items-center gap-2 text-sm font-bold tracking-tight">
          <span className="grid size-6 place-items-center rounded-md bg-indigo-600 text-[11px] text-white">F</span>
          folio
        </Link>

        {/* 현재 경로는 런타임에만 알 수 있어 프리렌더를 막는다.
            강조 표시만 Suspense 뒤로 넘기고, 링크 자체는 셸에 함께 나간다 —
            그래야 메뉴가 늦게 떠서 깜빡이지 않는다. */}
        <Suspense fallback={<MenuLinks />}>
          <MenuWithCurrent />
        </Suspense>
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
    <nav className="ml-auto flex items-center gap-1">
      {menu.map((m) => {
        const on = pathname ? pathname === m.href || pathname.startsWith(`${m.href}/`) : false
        return (
          <Link
            key={m.href}
            href={m.href}
            className={`px-2 py-1.5 text-sm transition ${
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
