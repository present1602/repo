'use client'

import { useEffect, useState } from 'react'

/* 홈 좌측에 떠 있는 메뉴 — 스크롤로 지나가는 섹션에 맞춰 켜진 항목이 바뀌고,
   누르면 그 섹션으로 내려간다.

   어느 섹션인지는 [data-spy="id"] 표식의 위치로 잰다. 장면은 sticky 라 제 위치를
   알려주지 않으므로, 장면 앞에 높이 0 인 표식을 따로 둔다(home-scenes.tsx).
   id 가 빈 표식([data-spy=""])은 "여기서부터는 아무것도 켜지 않는다"는 끝 표시다.

   같은 메뉴를 두 벌 그린다 — 어두운 바탕용과 밝은 바탕용. 밝은 섹션이 지나가는
   높이만큼 서로 잘라 보여준다(globals.css 의 .home-rail-*). 둘째 벌은 보조 기기에
   같은 메뉴가 두 번 읽히지 않게 감춘다. */

export type RailItem = { id: string; label: string }

export function HomeRail({ items }: { items: RailItem[] }) {
  const [active, setActive] = useState<string | null>(null)
  /* 맨 아래 의뢰 띠·푸터에서는 메뉴를 거둔다 — 큰 글자와 겹친다 */
  const [ended, setEnded] = useState(false)

  useEffect(() => {
    let raf = 0
    const tick = () => {
      raf = 0
      const line = window.innerHeight * 0.5
      let cur: string | null = null
      document.querySelectorAll<HTMLElement>('[data-spy]').forEach((el) => {
        if (el.getBoundingClientRect().top <= line) cur = el.dataset.spy || null
      })
      setActive(cur)
      const end = document.querySelector<HTMLElement>('[data-spy=""]')
      setEnded(!!end && end.getBoundingClientRect().top <= window.innerHeight * 0.75)
    }
    const request = () => {
      if (!raf) raf = requestAnimationFrame(tick)
    }
    window.addEventListener('scroll', request, { passive: true })
    window.addEventListener('resize', request)
    tick()
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', request)
      window.removeEventListener('resize', request)
    }
  }, [])

  const go = (id: string) => {
    const el = document.querySelector<HTMLElement>(`[data-spy="${CSS.escape(id)}"]`)
    if (!el) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    window.scrollTo({
      top: el.getBoundingClientRect().top + window.scrollY + 1,
      behavior: reduce ? 'auto' : 'smooth',
    })
  }

  if (items.length === 0) return null

  const list = (tone: 'dark' | 'light', hidden: boolean) => (
    <ul className="flex flex-col items-start gap-1.5">
      {items.map((it, i) => {
        const on = active === it.id
        return (
          <li
            key={it.id}
            className="home-fade"
            style={{ '--d': `${0.9 + i * 0.06}s` } as React.CSSProperties}
          >
            <button
              type="button"
              tabIndex={hidden ? -1 : undefined}
              aria-current={on ? 'true' : undefined}
              onClick={() => go(it.id)}
              className={`group flex h-8 items-center rounded-full pl-4 text-[15px] backdrop-blur-xl transition-[background-color,color,padding] duration-300 ${
                on ? 'pr-3' : 'pr-4'
              } ${
                tone === 'dark'
                  ? on
                    ? 'bg-white text-black'
                    : 'bg-neutral-400/20 text-white hover:bg-neutral-400/35'
                  : on
                    ? 'bg-neutral-950 text-white'
                    : 'bg-neutral-950/[0.07] text-neutral-900 hover:bg-neutral-950/15'
              }`}
            >
              {it.label}
              {/* 켜진 항목 뒤에 점 하나 — 폭이 늘어나며 나타난다 */}
              <span
                aria-hidden
                className={`inline-block rounded-full bg-violet-500 transition-all duration-300 ${
                  on ? 'ml-2.5 size-1.5 opacity-100' : 'ml-0 size-0 opacity-0'
                }`}
              />
            </button>
          </li>
        )
      })}
    </ul>
  )

  return (
    <>
      {/* 넓은 화면 — 왼쪽 가운데에 세로로 */}
      <nav
        aria-label="홈 섹션"
        className={`fixed inset-y-0 left-6 z-20 hidden w-56 transition-opacity duration-500 lg:block ${
          ended ? 'pointer-events-none opacity-0' : 'pointer-events-none opacity-100'
        }`}
      >
        <div className={`home-rail-dark absolute inset-0 flex items-center ${ended ? '' : '[&_button]:pointer-events-auto'}`}>
          {list('dark', false)}
        </div>
        <div
          aria-hidden
          className={`home-rail-light absolute inset-0 flex items-center ${ended ? '' : '[&_button]:pointer-events-auto'}`}
        >
          {list('light', true)}
        </div>
      </nav>

      {/* 좁은 화면 — 어느 섹션에 들어와 있을 때만 아래에 가로 띠로. 오른쪽은 챗봇 단추 자리라 비운다 */}
      <nav
        aria-label="홈 섹션"
        className={`fixed bottom-5 left-3 right-24 z-20 transition duration-500 lg:hidden ${
          active && !ended ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-4 opacity-0'
        }`}
      >
        <ul className="flex w-max max-w-full gap-1 overflow-x-auto rounded-full bg-neutral-900/70 p-1 ring-1 ring-white/10 backdrop-blur-xl [scrollbar-width:none]">
          {items.map((it) => (
            <li key={it.id} className="shrink-0">
              <button
                type="button"
                onClick={() => go(it.id)}
                aria-current={active === it.id ? 'true' : undefined}
                className={`h-8 rounded-full px-3 text-[13px] transition-colors duration-300 ${
                  active === it.id ? 'bg-white text-black' : 'text-white/80'
                }`}
              >
                {it.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </>
  )
}
