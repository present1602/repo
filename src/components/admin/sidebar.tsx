'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

// 메뉴는 앞으로 더 붙는다 — 배열에 항목만 추가하면 된다
const menu = [
  { href: '/admin/designers', label: '디자이너' },
  { href: '/admin/works', label: '포트폴리오' },
  { href: '/admin/inquiries', label: '문의' },
  { href: '/admin/applications', label: '지원서' },
  { href: '/admin/invites', label: '초대코드' },
  { href: '/admin/featured', label: '메인 노출' },
  { href: '/admin/popups', label: '팝업' },
  { href: '/admin/settings', label: '설정' },
]

type MenuProps = {
  email: string
  unreadInquiries?: number
  unreadApplications?: number
}

/* 데스크톱 — 왼쪽에 늘 펼쳐 둔다 */
export function AdminSidebar(props: MenuProps) {
  return (
    <aside className="hidden w-56 shrink-0 flex-col border-r border-neutral-200 bg-white p-5 md:flex">
      <MenuBody {...props} />
    </aside>
  )
}

/* 모바일 — 사이드바를 둘 폭이 없다. 상단 바의 버튼으로 같은 메뉴를 서랍처럼 연다. */
export function AdminMobileMenu(props: MenuProps) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  /* 메뉴를 눌러 화면이 바뀌면 닫는다 */
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 경로가 바뀐 뒤에야 닫을 수 있다
    setOpen(false)
  }, [pathname])

  /* 열려 있는 동안 뒤 화면이 스크롤되지 않게 */
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  const unread = (props.unreadInquiries ?? 0) + (props.unreadApplications ?? 0)

  return (
    <div className="md:hidden">
      <button
        onClick={() => setOpen(true)}
        aria-label="메뉴 열기"
        aria-expanded={open}
        className="relative -ml-2 grid size-9 place-items-center rounded-md text-neutral-700 transition hover:bg-neutral-100"
      >
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
        {/* 메뉴를 닫아 둬도 미확인이 있으면 보이게 */}
        {unread > 0 && <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-violet-600" />}
      </button>

      {open && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="어드민 메뉴">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-64 max-w-[80vw] flex-col bg-white p-5 shadow-xl">
            <button
              onClick={() => setOpen(false)}
              aria-label="메뉴 닫기"
              className="absolute right-3 top-3 grid size-9 place-items-center rounded-md text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700"
            >
              <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
            <MenuBody {...props} />
          </aside>
        </div>
      )}
    </div>
  )
}

function MenuBody({ email, unreadInquiries = 0, unreadApplications = 0 }: MenuProps) {
  /* 메뉴별 미확인 배지 */
  const badges: Record<string, number> = {
    '/admin/inquiries': unreadInquiries,
    '/admin/applications': unreadApplications,
  }

  const pathname = usePathname() ?? ''

  return (
    <>
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
    </>
  )
}
