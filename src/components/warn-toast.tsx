'use client'

import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

/* 다이얼로그 안에서 고른 파일을 거절할 때 띄우는 경고 토스트.

   Flash(flash.tsx)의 실패 줄은 그 자리에 그려져, 다이얼로그(fixed z-50) 안의
   고르기 단추 옆에서 부르면 스크롤 위치에 따라 안 보일 수 있다. 이것은 body 에
   붙여(z-[60]) 다이얼로그 위 가운데에 띄운다 — 성공 토스트와 같은 자리.

   읽을 시간을 주려고 성공 토스트(2.5초)보다 오래 둔다. 같은 문구를 다시
   띄워도 타이머가 다시 걸리도록 부르는 쪽은 매번 새 객체를 넘긴다. */
export function WarnToast({
  msg,
  onDone,
  duration = 4000,
}: {
  msg: { text: string } | null
  onDone: () => void
  duration?: number
}) {
  const done = useRef(onDone)
  useEffect(() => {
    done.current = onDone
  })

  useEffect(() => {
    if (!msg) return
    const t = setTimeout(() => done.current(), duration)
    return () => clearTimeout(t)
  }, [msg, duration])

  if (!msg) return null
  return createPortal(
    <div role="alert" className="pointer-events-none fixed inset-x-0 top-6 z-[60] flex justify-center px-4">
      <p className="rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg">{msg.text}</p>
    </div>,
    document.body,
  )
}
