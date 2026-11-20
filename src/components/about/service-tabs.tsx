'use client'

import { useEffect, useState } from 'react'
import { SERVICES } from '@/lib/landing-package'

/* 소개의 의뢰 유형 탭 — 웹사이트 개발 · 앱 디자인 · 상세페이지 디자인.

   네비바 바로 아래에 붙어 따라 내려오고, 지금 화면에 걸린 구역의 탭이 켜진다.
   누르면 그 구역으로 부드럽게 내려간다. 구역 위치는 스크롤마다 다시 잰다 —
   견적표를 펼치고 접으면 아래 구역의 높이가 바뀌기 때문이다. */

/* 화면 높이의 이 비율 선 — 아래 update 참고 */
const LINE = 0.4

export function ServiceTabs() {
  const [active, setActive] = useState<string>(SERVICES[0].id)

  useEffect(() => {
    let frame = 0
    const update = () => {
      frame = 0
      /* 구역 위쪽이 화면 위에서 40% 선을 넘어 올라온 마지막 구역이 지금 구역이다.
         아래 구역이 화면 아래 60% 를 덮으면 넘어간다 — 반반에서 바뀌는 것보다 조금 늦게,
         맨 위 선(네비바 아래)까지 기다리는 것보다는 훨씬 일찍 */
      const line = window.innerHeight * LINE
      let current: string = SERVICES[0].id
      for (const s of SERVICES) {
        const el = document.getElementById(s.id)
        if (el && el.getBoundingClientRect().top <= line) current = s.id
      }
      setActive(current)
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      cancelAnimationFrame(frame)
    }
  }, [])

  return (
    <nav
      aria-label="의뢰 유형"
      className="follow-nav sticky top-14 z-10 border-b border-line bg-paper/90 backdrop-blur"
    >
      <div className="mx-auto flex max-w-[1200px] items-center gap-4 px-5 py-2.5 md:px-10">
        <span className="hidden shrink-0 text-xs font-semibold text-neutral-500 md:block">SOOM 의뢰 유형</span>
        <ul className="grid flex-1 grid-cols-3 gap-1 rounded-full bg-paper-2 p-1 ring-1 ring-line md:max-w-xl">
          {SERVICES.map((s) => {
            const on = s.id === active
            return (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  aria-current={on ? 'true' : undefined}
                  onClick={(e) => {
                    const el = document.getElementById(s.id)
                    if (!el) return
                    e.preventDefault()
                    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
                    el.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'start' })
                    /* 켜는 것은 스크롤이 한다 — 내려가는 동안 지나는 구역의 탭이 차례로 켜진다 */
                    history.replaceState(null, '', `#${s.id}`)
                  }}
                  className={`flex min-h-10 items-center justify-center rounded-full px-2 text-center text-[13px] font-semibold break-keep transition md:text-sm ${
                    on ? 'bg-ink text-paper shadow-sm' : 'text-neutral-500 hover:text-neutral-900'
                  }`}
                >
                  {s.label}
                </a>
              </li>
            )
          })}
        </ul>
      </div>
    </nav>
  )
}
