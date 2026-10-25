'use client'

import { SCOPES, SCOPE_HINTS, SCOPE_LABELS, type Scope } from '@/lib/scopes'

/* 탐색 화면에 처음 들어올 때 뜨는 물음.

   목록을 먼저 깔고 그 위에 덮는다 — 빈 화면에 물음만 띄우면 무엇을
   고르는 자리인지 알 수 없다. 뒤가 비쳐야 "여기서 디자이너를 고르는구나"가
   먼저 읽힌다.

   고르지 않고 닫을 수도 있다. 강제로 막으면 둘러보러 온 사람이 되돌아간다. */
export function ScopePrompt({
  onPick,
  onSkip,
}: {
  onPick: (s: Scope) => void
  onSkip: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-neutral-950/50 p-4 md:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="scope-prompt-title"
        className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl md:p-8"
      >
        <h2 id="scope-prompt-title" className="text-xl font-bold tracking-tight md:text-2xl">
          어떤 의뢰를 원하시나요?
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-neutral-600">
          의뢰 유형에 따라 선별적으로 디자이너를 추천해드려요.
        </p>

        <div className="mt-6 space-y-2.5">
          {SCOPES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onPick(s)}
              className="block w-full rounded-xl border border-neutral-300 px-4 py-3.5 text-left transition hover:border-violet-600 hover:bg-violet-50 md:px-5"
            >
              <span className="block text-sm font-semibold">{SCOPE_LABELS[s]}</span>
              <span className="mt-0.5 block text-xs leading-relaxed text-neutral-500">
                {SCOPE_HINTS[s]}
              </span>
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={onSkip}
          className="mt-5 w-full text-center text-xs text-neutral-500 transition hover:text-neutral-900"
        >
          아직 정하지 않았어요 · 전체 보기
        </button>
      </div>
    </div>
  )
}
