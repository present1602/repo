'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { PRE_LAUNCH } from '@/lib/pre-launch'

/* 공개 전(베타) 동안 탐색으로 가는 길을 막는다 — 누르면 탐색 대신 지원 안내를 띄운다.
   언제 막는지는 pre-launch.ts */

export function ExploreLink({ className, children }: { className: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)

  if (!PRE_LAUNCH) {
    return (
      <Link href="/explore" className={className}>
        {children}
      </Link>
    )
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        {children}
      </button>
      {open && <BetaNotice onClose={() => setOpen(false)} />}
    </>
  )
}

/* 작은 안내 창 — 의뢰 폼(Dialog)처럼 크게 띄울 내용이 아니다.
   body 에 붙인다 — 사이트 바(sticky) 안에서 열면 z-index 가 갇힌다 */
function BetaNotice({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  return createPortal(
    <div className="fixed inset-0 z-50 grid place-items-center bg-neutral-950/70 px-5" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="beta-notice-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl bg-white px-6 pb-6 pt-8 text-center shadow-xl"
      >
        <span className="inline-flex rounded-full bg-violet-600 px-2.5 py-0.5 text-[11px] font-semibold tracking-wide text-white">
          BETA
        </span>
        <h2 id="beta-notice-title" className="mt-4 text-xl font-bold tracking-tight">
          아직 공개 전이에요
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-neutral-600">
          베타 기간 동안 소수의 디자이너분만 활동할 수 있고, 곧 모집이 종료돼요.
          <br />
          <b className="font-semibold text-violet-600">고민하지 말고 지원하세요!</b>
        </p>
        <div className="mt-7 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-neutral-300 px-4 py-3 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50"
          >
            닫기
          </button>
          <Link
            href="/designers/apply"
            onClick={onClose}
            className="flex-1 rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-violet-700"
          >
            지원하기
          </Link>
        </div>
      </div>
    </div>,
    document.body,
  )
}
