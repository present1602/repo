'use client'

import { useEffect } from 'react'

/* 이 화면이 열려 있는 동안에만 <html> 에 클래스를 붙인다.

   스크롤은 문서 전체가 맡으므로 그와 관련된 설정(scroll-behavior,
   scroll-snap-type)은 html 에 걸어야 하는데, 전역 CSS 로 바로 걸면
   사이트의 모든 화면이 함께 영향을 받는다.

   예: scroll-behavior:smooth 를 html 에 늘 걸어 두면 페이지를 옮길 때
   맨 위로 올리는 동작까지 흐르듯 움직여, 푸터의 링크를 누르면 새 화면이
   아래에서 스르륵 올라오는 것처럼 보인다. */
export function HtmlClass({ names }: { names: string[] }) {
  /* 배열을 그대로 의존성에 넣으면 렌더마다 새 배열이라 매번 다시 돈다 */
  const key = names.join(' ')

  useEffect(() => {
    const el = document.documentElement
    const list = key.split(' ').filter(Boolean)
    el.classList.add(...list)
    return () => el.classList.remove(...list)
  }, [key])

  return null
}
