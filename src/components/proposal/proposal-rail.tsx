'use client'

import { useEffect, useState } from 'react'

/* 제안서 좌측에 붙는 쪽 표시.

   지금 보는 쪽을 따라 점이 내려오고, 점을 누르면 그 쪽으로 간다.
   좁은 화면에서는 띄우지 않는다 — 본문 폭을 빼앗고, 상단 바에
   같은 번호가 이미 있다(proposal-nav.tsx).

   스크롤 위치를 직접 계산하지 않고 IntersectionObserver 에 맡긴다 —
   scroll 이벤트마다 좌표를 재면 긴 문서에서 버벅인다. */
export function ProposalRail({ total }: { total: number }) {
  const [active, setActive] = useState(1)

  useEffect(() => {
    const spreads = Array.from({ length: total }, (_, i) =>
      document.getElementById(`p${i + 1}`),
    ).filter((el): el is HTMLElement => el != null)

    if (spreads.length === 0) return

    /* 화면 한가운데에 걸친 쪽을 지금 쪽으로 본다.
       rootMargin 으로 위아래를 깎아 가운데 띠만 남긴다 — 그래야
       두 쪽이 동시에 보일 때 하나로 정해진다. */
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue
          const n = Number(e.target.id.slice(1))
          if (Number.isFinite(n)) setActive(n)
        }
      },
      { rootMargin: '-45% 0px -45% 0px', threshold: 0 },
    )

    for (const el of spreads) io.observe(el)
    return () => io.disconnect()
  }, [total])

  return (
    /* 넓은 화면에서만 — 본문은 이 폭을 비워 두고 깔린다(page.tsx 의 패딩) */
    <nav
      aria-label="쪽 이동"
      className="pointer-events-none fixed right-0 top-14 z-20 hidden h-[calc(100vh-3.5rem)] w-20 xl:block"
    >
      <ul className="pointer-events-auto flex h-full flex-col items-center justify-center gap-1">
        {Array.from({ length: total }, (_, i) => {
          const n = i + 1
          const on = active === n
          return (
            <li key={n} className="flex flex-col items-center">
              <a
                href={`#p${n}`}
                aria-label={`${n}쪽으로`}
                aria-current={on ? 'true' : undefined}
                className="group flex items-center gap-2 py-1.5"
              >
                {/* 막대가 화면 가장자리 쪽에 서도록 번호를 왼쪽에 둔다 —
                    오른쪽 레일이므로 순서가 반대였다면 번호가 바깥으로 밀린다 */}
                <span
                  className={`text-[10px] tabular-nums transition ${
                    on ? 'font-semibold text-violet-600' : 'text-neutral-400 group-hover:text-neutral-600'
                  }`}
                >
                  {String(n).padStart(2, '0')}
                </span>
                {/* 지금 쪽은 길고 진한 막대, 나머지는 짧은 점 */}
                <span
                  className={`block rounded-full transition-all duration-300 ${
                    on ? 'h-6 w-0.5 bg-violet-600' : 'h-1.5 w-0.5 bg-neutral-300 group-hover:bg-neutral-500'
                  }`}
                />
              </a>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
