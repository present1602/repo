'use client'

import { useEffect, useRef } from 'react'
import { ChangePasswordForm } from './change-password-form'

/* 비밀번호 변경 다이얼로그.

   폼 자체는 ChangePasswordForm 을 그대로 쓴다 — 검증과 서버 호출을
   여기에 다시 적으면 두 벌이 갈린다. 이 파일은 띄우고 닫는 일만 한다. */
export function ChangePasswordDialog({ onClose }: { onClose: () => void }) {
  /* 성공 메시지를 잠깐 보여주고 닫는다 — 바로 닫으면 바뀐 건지 알 수 없다 */
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  /* Esc 로 닫고, 열려 있는 동안 뒤쪽 화면이 스크롤되지 않게 한다 */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
      /* 메시지를 보는 중에 Esc 로 닫으면 타이머가 남는다 */
      if (timer.current) clearTimeout(timer.current)
    }
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      /* 바깥을 눌러 닫는다 — 안쪽 클릭은 아래에서 멈춘다 */
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="비밀번호 변경"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-xl bg-white p-5 shadow-xl"
      >
        <div className="mb-4 flex items-start justify-between gap-2">
          <h2 className="text-sm font-semibold">비밀번호 변경</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="-mr-1 -mt-1 shrink-0 rounded p-1 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-900"
          >
            ✕
          </button>
        </div>

        <ChangePasswordForm
          onChanged={() => {
            timer.current = setTimeout(onClose, 1200)
          }}
        />
      </div>
    </div>
  )
}
