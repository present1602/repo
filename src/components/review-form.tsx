'use client'

import { useState } from 'react'
import { useActionTransition } from '@/lib/use-action-transition'
import Link from 'next/link'
import { MIN_REVIEW_BODY, MAX_REVIEW_BODY } from '@/lib/review-shape'
import { saveReview } from '@/app/review/[token]/actions'

/* 후기 작성 폼 — 별점 없이 글만 받는다.

   별점을 함께 받으면 글을 안 쓰고 별만 누르고 나간다. 초기에는 후기 수가
   적어 숫자보다 문장이 쓸모 있으므로 글만 받는다(DB 에는 rating 자리를
   비워 두었다 — 나중에 켤 수 있다). */
export function ReviewForm({ token }: { token: string }) {
  const [body, setBody] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [pending, start] = useActionTransition()

  const len = body.trim().length
  const tooShort = len > 0 && len < MIN_REVIEW_BODY
  const canSend = len >= MIN_REVIEW_BODY && len <= MAX_REVIEW_BODY && !pending

  if (done) {
    return (
      <div className="mt-8 rounded-2xl border border-neutral-200 bg-white p-8 text-center">
        <p className="text-3xl">🙏</p>
        <h2 className="mt-4 text-xl font-bold tracking-tight">후기를 남겨 주셔서 감사합니다</h2>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-neutral-600">
          확인 후 공개됩니다. 보통 하루 안에 올라갑니다.
        </p>
        <Link
          href="/"
          className="mt-7 inline-block rounded-xl bg-neutral-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-violet-600"
        >
          SOOM 둘러보기
        </Link>
      </div>
    )
  }

  return (
    <form
      className="mt-8"
      onSubmit={(e) => {
        e.preventDefault()
        if (!canSend) return
        setError(null)
        start(async () => {
          const r = await saveReview(token, body)
          if (r.ok) setDone(true)
          else setError(r.error)
        }, '후기 저장')
      }}
    >
      <label className="block">
        <span className="text-sm font-medium">어떤 점이 좋았나요?</span>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={8}
          maxLength={MAX_REVIEW_BODY}
          autoFocus
          placeholder={
            '작업 과정이나 결과물에서 좋았던 점, 아쉬웠던 점을 자유롭게 적어 주세요.\n' +
            '구체적으로 적어 주실수록 다른 분들께 도움이 됩니다.'
          }
          className="mt-2 w-full resize-y rounded-xl border border-neutral-300 bg-white px-4 py-3.5 text-[15px] leading-relaxed outline-none transition placeholder:text-neutral-400 focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
        />
      </label>

      {/* 글자 수는 늘 띄워 둔다 — 보내고 나서 "짧습니다" 를 듣지 않게 */}
      <div className="mt-2 flex items-center justify-between text-xs">
        <span className={tooShort ? 'text-amber-600' : 'text-neutral-400'}>
          {tooShort
            ? `${MIN_REVIEW_BODY}자 이상 적어 주세요`
            : `최소 ${MIN_REVIEW_BODY}자`}
        </span>
        <span className="tabular-nums text-neutral-400">
          {len} / {MAX_REVIEW_BODY}
        </span>
      </div>

      {error && (
        <p className="mt-4 rounded-lg bg-red-50 px-3.5 py-3 text-sm text-red-700">{error}</p>
      )}

      <button
        type="submit"
        disabled={!canSend}
        className="mt-6 w-full rounded-xl bg-neutral-900 px-6 py-4 text-sm font-semibold text-white transition hover:bg-violet-600 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {pending ? '보내는 중…' : '후기 남기기'}
      </button>

      <p className="mt-4 text-center text-xs leading-relaxed text-neutral-500">
        작성하신 이름은 <b className="font-semibold">김*연</b> 처럼 일부만 공개됩니다.
        <br />
        이메일은 공개되지 않습니다.
      </p>
    </form>
  )
}
