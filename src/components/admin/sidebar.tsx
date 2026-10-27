'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

// 메뉴는 앞으로 더 붙는다 — 배열에 항목만 추가하면 된다
const menu = [
  { href: '/admin/designers', label: '디자이너' },
  { href: '/admin/works', label: '포트폴리오' },
  { href: '/admin/inquiries', label: '문의' },
  { href: '/admin/applications', label: '지원서' },
  { href: '/admin/featured', label: '메인 노출' },
  { href: '/admin/settings', label: '설정' },
]

export function AdminSidebar({
  email,
  unreadInquiries = 0,
  unreadApplications = 0,
}: {
  email: string
  unreadInquiries?: number
  unreadApplications?: number
}) {
  /* 메뉴별 미확인 배지 */
  const badges: Record<string, number> = {
    '/admin/inquiries': unreadInquiries,
    '/admin/applications': unreadApplications,
  }

  const pathname = usePathname() ?? ''

  return (
    <aside className="hidden w-56 shrink-0 flex-col border-r border-neutral-200 bg-white p-5 md:flex">
      <Link href="/admin" className="flex items-center gap-2 text-sm font-bold tracking-tight">
        <span className="grid size-6 place-items-center rounded-md bg-violet-600 text-[11px] text-white">
          S
        </span>
        SOOM
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
              className={`flex items-center justify-between gap-2 rounded-md px-2.5 py-2 font-medium transition ${
                on ? 'bg-violet-50 text-violet-700' : 'text-neutral-600 hover:bg-neutral-100'
              }`}
            >
              {m.label}
              {/* 미확인 건수 — 다른 화면에 있어도 눈에 띄게 */}
              {(badges[m.href] ?? 0) > 0 && (
                <span className="rounded-full bg-violet-600 px-1.5 py-0.5 text-[11px] font-semibold text-white">
                  {badges[m.href]}
                </span>
              )}
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
