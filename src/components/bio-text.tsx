'use client'

import { useState } from 'react'

/* 디자이너 소개글 — 처음엔 세 줄까지만, '더보기'로 펼친다.
   긴 소개글이 그대로 다 나오면 작업과 의뢰 패널이 화면 밖으로 밀려난다. */
export function BioText({ text }: { text: string }) {
  const [open, setOpen] = useState(false)
  /* 짧은 글에는 버튼을 달지 않는다 — 줄 수를 재지 않고 글자 수·줄바꿈으로 가늠한다 */
  const long = text.length > 160 || text.split('\n').length > 3

  return (
    <div className="mb-8">
      <p
        className={`whitespace-pre-line text-sm leading-relaxed text-neutral-600 md:text-base ${
          open || !long ? '' : 'line-clamp-3'
        }`}
      >
        {text}
      </p>
      {long && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="mt-1.5 text-xs font-medium text-neutral-500 transition hover:text-neutral-900"
        >
          {open ? '접기' : '더보기'}
        </button>
      )}
    </div>
  )
}
