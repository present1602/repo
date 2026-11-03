'use client'

import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

export type FlashMsg = { ok: boolean; text: string } | null

/* 저장 결과 알림 — 성공은 화면 위 가운데 토스트로 잠깐 띄우고 스스로 사라진다.
   폼 위에 끼워 넣으면 화면이 밀리고, 스크롤해 내려와 저장하면 보이지도 않는다.

   실패는 그 자리에 남긴다 — 무엇을 고쳐야 하는지 읽어야 하고, 사라지면 놓친다.
   토스트는 body 에 붙인다 — sticky 상자 안에서 띄우면 z-index 가 갇혀 바 아래로 깔린다. */
export function Flash({
  msg,
  onDone,
  className = '',
}: {
  msg: FlashMsg
  /* 토스트가 사라질 때 — 보통 setMsg(null) */
  onDone: () => void
  /* 실패 줄의 바깥 여백 */
  className?: string
}) {
  /* 부모가 그릴 때마다 새 함수가 와도 타이머를 다시 걸지 않게 */
  const done = useRef(onDone)
  useEffect(() => {
    done.current = onDone
  })

  useEffect(() => {
    if (!msg?.ok) return
    const t = setTimeout(() => done.current(), 2500)
    return () => clearTimeout(t)
  }, [msg])

  if (!msg) return null

  if (msg.ok) {
    return createPortal(
      <div role="status" className="pointer-events-none fixed inset-x-0 top-6 z-[60] flex justify-center px-4">
        <p className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg">{msg.text}</p>
      </div>,
      document.body,
    )
  }

  return <p className={`rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700 ${className}`}>{msg.text}</p>
}
