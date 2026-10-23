'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

// 메뉴는 앞으로 더 붙는다 — 배열에 항목만 추가하면 된다
const menu = [{ href: '/admin/designers', label: '디자이너' }]

export function AdminSidebar({ email }: { email: string }) {
  const pathname = usePathname() ?? ''

  return (
    <aside className="hidden w-56 shrink-0 flex-col border-r border-neutral-200 bg-white p-5 md:flex">
      <Link href="/admin" className="flex items-center gap-2 text-sm font-bold tracking-tight">
        <span className="grid size-6 place-items-center rounded-md bg-indigo-600 text-[11px] text-white">
          F
        </span>
        folio
        <span className="text-[11px] font-medium text-neutral-400">admin</span>
      </Link>

      <nav className="mt-7 flex flex-col gap-0.5 text-sm">
        {menu.map((m) => {
          const on = pathname === m.href || pathname.startsWith(`${m.href}/`)
          return (
            <Link
              key={m.href}
              href={m.href}
              aria-current={on ? 'page' : undefined}
              className={`rounded-md px-2.5 py-2 font-medium transition ${
                on ? 'bg-indigo-50 text-indigo-700' : 'text-neutral-600 hover:bg-neutral-100'
              }`}
            >
              {m.label}
            </Link>
          )
        })}
      </nav>

      <p className="mt-auto truncate pt-6 text-xs text-neutral-400" title={email}>
        {email}
      </p>
    </aside>
  )
}
