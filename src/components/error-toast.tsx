'use client'

import { useEffect, useState } from 'react'
import { describeError, type DescribedError } from '@/lib/describe-error'

/* 전역 에러 토스트 — 서버 액션이 예외를 던지거나 요청이 서버에 닿지 못했을 때.

   그대로 두면 예외가 에러 경계까지 올라가 화면 전체가 "This page couldn't load" 로
   바뀐다. useActionTransition 이 잡아 reportError 로 넘기고, 아무도 잡지 않은
   Promise 거절(unhandledrejection)도 여기서 받는다 — 화면은 그대로 두고 위에 알린다.

   액션이 { ok: false, error } 로 돌려준 실패는 여기로 오지 않는다 — 그건 각 화면이
   자기 자리(Flash)에 보여준다. 여기는 예상하지 못한 실패만. */

const EVENT = 'soom:error'
/* 읽고 행동할 시간 — 성공 토스트(2.5초)보다 길게 */
const DURATION = 7000

type Detail = { error: unknown; what?: string }

export function reportError(error: unknown, what?: string) {
  console.error(what ? `[${what}]` : '[error]', error)
  window.dispatchEvent(new CustomEvent<Detail>(EVENT, { detail: { error, what } }))
}

/* 사용자가 한 일과 상관없는 거절 — 띄우면 이유 없이 빨간 상자가 뜬다 */
function ignorable(reason: unknown): boolean {
  if (reason instanceof DOMException && reason.name === 'AbortError') return true
  /* Next 가 화면 이동(redirect·notFound)에 쓰는 내부 신호 */
  const digest = reason && typeof reason === 'object' && 'digest' in reason ? String(reason.digest) : ''
  return /^NEXT_(REDIRECT|HTTP_ERROR_FALLBACK|NOT_FOUND)/.test(digest)
}

export function ErrorToaster() {
  const [shown, setShown] = useState<(DescribedError & { at: number }) | null>(null)

  useEffect(() => {
    const onReport = (e: Event) => {
      const { error, what } = (e as CustomEvent<Detail>).detail
      setShown({ ...describeError(error, what), at: Date.now() })
    }
    const onRejection = (e: PromiseRejectionEvent) => {
      if (ignorable(e.reason)) return
      console.error('[unhandled]', e.reason)
      setShown({ ...describeError(e.reason), at: Date.now() })
    }
    window.addEventListener(EVENT, onReport)
    window.addEventListener('unhandledrejection', onRejection)
    return () => {
      window.removeEventListener(EVENT, onReport)
      window.removeEventListener('unhandledrejection', onRejection)
    }
  }, [])

  /* 새로고침이 필요한 안내는 눌러야 풀리므로 스스로 닫지 않는다 */
  useEffect(() => {
    if (!shown || shown.reload) return
    const t = setTimeout(() => setShown(null), DURATION)
    return () => clearTimeout(t)
  }, [shown])

  if (!shown) return null

  return (
    <div role="alert" className="fixed inset-x-0 top-6 z-[70] flex justify-center px-4">
      <div className="flex w-full max-w-md items-start gap-3 rounded-xl bg-white p-4 shadow-xl ring-1 ring-red-200">
        <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-red-50 text-xs font-bold text-red-600">
          !
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-neutral-900">{shown.title}</p>
          <p className="mt-1 text-sm leading-relaxed text-neutral-600">{shown.message}</p>
          {shown.code && <p className="mt-1.5 text-xs text-neutral-400">오류 코드 {shown.code}</p>}
          {shown.reload && (
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-3 rounded-lg bg-neutral-900 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-violet-600"
            >
              새로고침
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => setShown(null)}
          aria-label="닫기"
          className="-m-1 shrink-0 rounded p-1 text-neutral-400 transition hover:text-neutral-700"
        >
          ✕
        </button>
      </div>
    </div>
  )
}
