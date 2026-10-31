'use client'

import { useEffect, useRef } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

/* 화면 맨 위 로딩바 — 링크를 누른 뒤 다음 화면이 올 때까지.

   어드민은 요청마다 서버가 화면을 새로 그리므로(로그인·데이터 확인) 누르고 나서
   잠깐 아무 반응이 없다. 내부 링크 클릭을 잡아 바를 90% 까지 천천히 채우고,
   주소가 바뀌면 끝까지 채운 뒤 사라진다. 상태 대신 DOM 을 직접 만져 다시 그리지 않는다. */
export function NavProgress() {
  const bar = useRef<HTMLDivElement>(null)
  const running = useRef(false)
  const pathname = usePathname()
  const search = useSearchParams().toString()

  useEffect(() => {
    const el = bar.current
    if (!el) return
    let safety: ReturnType<typeof setTimeout> | undefined

    const start = () => {
      running.current = true
      el.style.transition = 'none'
      el.style.width = '0%'
      el.style.opacity = '1'
      void el.offsetWidth // 0% 에서 다시 출발하도록 한 번 그리게 한다
      el.style.transition = 'width 8s cubic-bezier(0.1, 0.7, 0.2, 1)'
      el.style.width = '90%'
      // 주소가 끝내 안 바뀌어도(같은 화면으로 되돌림 등) 바가 남지 않게
      clearTimeout(safety)
      safety = setTimeout(() => finish(el, running), 15000)
    }

    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0) return
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const a = (e.target as Element | null)?.closest?.('a')
      if (!a || !a.href || a.target === '_blank' || a.hasAttribute('download')) return
      const to = new URL(a.href, location.href)
      if (to.origin !== location.origin) return
      if (to.pathname === location.pathname && to.search === location.search) return
      start()
    }

    document.addEventListener('click', onClick)
    window.addEventListener('popstate', start)
    return () => {
      clearTimeout(safety)
      document.removeEventListener('click', onClick)
      window.removeEventListener('popstate', start)
    }
  }, [])

  /* 주소가 바뀌었다 = 다음 화면이 그려졌다 */
  useEffect(() => {
    if (bar.current) finish(bar.current, running)
  }, [pathname, search])

  return (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-0.5">
      <div ref={bar} className="h-full w-0 bg-violet-600 opacity-0 shadow-[0_0_6px_rgba(124,58,237,0.6)]" />
    </div>
  )
}

function finish(el: HTMLDivElement, running: { current: boolean }) {
  if (!running.current) return
  running.current = false
  el.style.transition = 'width 200ms ease-out, opacity 300ms ease 200ms'
  el.style.width = '100%'
  el.style.opacity = '0'
}
