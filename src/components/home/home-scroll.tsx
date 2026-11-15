'use client'

import { useEffect } from 'react'

/* 홈의 스크롤 값을 CSS 변수로 내려준다 — 움직임 자체는 globals.css 가 그린다.

   React 상태로 두지 않는다. 스크롤마다 화면 전체가 다시 그려지면 버벅이고,
   필요한 것은 transform 에 곱할 숫자 몇 개뿐이다. 프레임당 한 번만 잰다(rAF).

   장면([data-scene])은 sticky 라 getBoundingClientRect 가 "붙은 자리"를 준다 —
   다음 장면이 얼마나 올라왔는지는 그 장면의 top 으로 잰다. */

const clamp = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)

export function HomeScroll() {
  useEffect(() => {
    const root = document.documentElement
    root.classList.add('js-reveal')

    let raf = 0
    const tick = () => {
      raf = 0
      const vh = window.innerHeight
      const y = window.scrollY
      root.style.setProperty('--sy', y.toFixed(1))
      root.style.setProperty('--hero', clamp(y / vh).toFixed(4))

      /* 섹션이 늦게 붙을 수 있어(Suspense) 매번 다시 찾는다 — 몇 개뿐이라 싸다 */
      const scenes = document.querySelectorAll<HTMLElement>('[data-scene]')
      const tops = Array.from(scenes, (el) => el.getBoundingClientRect().top)
      scenes.forEach((el, i) => {
        el.style.setProperty('--e', clamp(1 - tops[i] / vh).toFixed(4))
        el.style.setProperty('--c', (i + 1 < tops.length ? clamp(1 - tops[i + 1] / vh) : 0).toFixed(4))
      })

      document.querySelectorAll<HTMLElement>('[data-progress]').forEach((el) => {
        const r = el.getBoundingClientRect()
        el.style.setProperty('--p', clamp((vh - r.top) / (vh + r.height)).toFixed(4))
      })

      /* 밝은 섹션이 지나가는 높이 — 좌측 메뉴가 이 구간에서 어두운 글자로 바뀐다 */
      const light = document.querySelector<HTMLElement>('[data-light]')
      if (light) {
        const r = light.getBoundingClientRect()
        root.style.setProperty('--lt', `${Math.max(0, Math.min(vh, r.top)).toFixed(1)}px`)
        root.style.setProperty('--lb', `${Math.max(0, Math.min(vh, r.bottom)).toFixed(1)}px`)
      }
    }
    const request = () => {
      if (!raf) raf = requestAnimationFrame(tick)
    }

    /* 화면에 들어온 것을 떠오르게 — 한 번 뜨면 그대로 둔다 */
    const io = new IntersectionObserver(
      (entries) => {
        for (const en of entries) {
          if (!en.isIntersecting) continue
          en.target.setAttribute('data-in', '')
          io.unobserve(en.target)
        }
      },
      { rootMargin: '0px 0px -12% 0px' },
    )
    const watch = () =>
      document.querySelectorAll('[data-reveal]:not([data-in])').forEach((el) => io.observe(el))
    watch()
    /* 뒤늦게 붙는 섹션(Suspense)도 챙긴다 */
    const mo = new MutationObserver(() => {
      watch()
      request()
    })
    mo.observe(document.body, { childList: true, subtree: true })

    window.addEventListener('scroll', request, { passive: true })
    window.addEventListener('resize', request)
    tick()

    return () => {
      cancelAnimationFrame(raf)
      io.disconnect()
      mo.disconnect()
      window.removeEventListener('scroll', request)
      window.removeEventListener('resize', request)
      root.classList.remove('js-reveal')
      for (const k of ['--sy', '--hero', '--lt', '--lb']) root.style.removeProperty(k)
    }
  }, [])

  return null
}
