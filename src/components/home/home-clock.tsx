'use client'

import { useEffect, useState } from 'react'

/* 히어로 아래 줄의 서울 시각 — 사무실이 있는 곳의 지금 시각을 보여준다.

   시각은 렌더 중에 읽지 않는다 — 서버가 미리 그린 값과 브라우저의 값이 달라
   하이드레이션이 어긋나고, cacheComponents 아래에서는 사전 렌더도 막힌다.
   붙은 뒤에 채운다. 그 전에는 자리만 지킨다. */
export function HomeClock() {
  const [time, setTime] = useState('')

  useEffect(() => {
    const fmt = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Seoul',
      hour: '2-digit',
      minute: '2-digit',
    })
    const update = () => setTime(fmt.format(new Date()))
    update()
    const id = window.setInterval(update, 20_000)
    return () => window.clearInterval(id)
  }, [])

  return (
    <span className="tabular-nums">
      SEOUL <span className={time ? '' : 'opacity-0'}>{time || '00:00'}</span>
    </span>
  )
}
