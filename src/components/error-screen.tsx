'use client'

import { useEffect } from 'react'
import { describeError } from '@/lib/describe-error'

/* 화면을 그리다 실패했을 때 Next 기본 화면("This page couldn't load") 대신 나가는 안내.
   app/error.tsx(사이트 안)와 app/global-error.tsx(레이아웃까지 실패)가 같이 쓴다.

   무엇이 문제인지에 따라 버튼이 다르다 — 배포 직후 옛 화면이면 새로고침,
   그 밖에는 다시 시도(retry: 그 구역만 다시 받아 그린다). */
export function ErrorScreen({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error('[error-boundary]', error)
  }, [error])

  const e = describeError(error)
  const title = e.kind === 'stale' ? e.title : e.kind === 'network' ? '연결이 끊겼습니다' : '화면을 불러오지 못했습니다'

  return (
    <main className="flex flex-1 items-center justify-center bg-white px-5 py-20">
      <div className="w-full max-w-md text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-violet-50 text-lg font-bold text-violet-600">
          !
        </span>
        <h1 className="mt-6 text-2xl font-bold tracking-tight text-balance">{title}</h1>
        <p className="mt-3 text-sm leading-relaxed text-neutral-600">{e.message}</p>
        {e.code && <p className="mt-2 text-xs text-neutral-400">오류 코드 {e.code}</p>}

        <div className="mt-8 flex flex-col justify-center gap-2.5 sm:flex-row">
          {e.reload ? (
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-xl bg-neutral-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-violet-600"
            >
              새로고침
            </button>
          ) : (
            <button
              type="button"
              onClick={() => retry()}
              className="rounded-xl bg-neutral-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-violet-600"
            >
              다시 시도
            </button>
          )}
          {/* 전역 에러 화면에서는 라우터가 무너졌을 수 있다 — 평범한 링크로 문서를 새로 받는다 */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a
            href="/"
            className="rounded-xl border border-neutral-300 px-6 py-3 text-sm font-semibold transition hover:border-neutral-900"
          >
            홈으로
          </a>
        </div>
      </div>
    </main>
  )
}
