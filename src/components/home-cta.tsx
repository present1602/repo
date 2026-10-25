'use client'

import { useState } from 'react'
import { InquiryModal } from './inquiry/inquiry-modal'

/* 홈 맨 아래 띠 배너 — 작업을 쭉 본 뒤 바로 의뢰로 넘어가는 자리.

   화면 폭을 가득 쓰는 어두운 띠다. 앞의 작업 피드가 흰 바탕이라
   여기서 색이 바뀌며 "끝났고, 이제 행동할 차례"로 읽힌다.

   뒤에 깔리는 큰 LOW RISK 글자는 장식이다 — 읽으라고 둔 것이 아니라
   빈 오른쪽을 채우는 질감이므로 aria-hidden 으로 감춘다. */
export function HomeCta({ price }: { price: number }) {
  const [open, setOpen] = useState(false)

  return (
    <section className="relative overflow-hidden bg-neutral-950">
      {/* 오른쪽에서 번지는 보라 — 단색 검정보다 덜 납작하다 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_75%_50%,rgb(124_58_237/0.55),transparent_70%)]"
      />

      {/* 장식 글자. 좁은 화면에서는 글과 겹쳐 읽기를 방해하므로 띄우지 않는다 */}
      <span
        aria-hidden
        className="pointer-events-none absolute right-[-2%] top-1/2 hidden -translate-y-1/2 select-none text-[7rem] font-black leading-none tracking-tight text-white/[0.055] lg:block xl:text-[9rem]"
      >
        LOW RISK
      </span>

      <div className="relative mx-auto flex max-w-7xl flex-col gap-7 px-5 py-10 md:flex-row md:items-center md:justify-between md:gap-10 md:px-8 md:py-12">
        <div className="min-w-0">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold tracking-[0.12em] text-white/90">
            <span className="size-1.5 rounded-full bg-violet-400" /> LOW RISK
          </span>

          <h2 className="mt-4 text-2xl font-bold leading-snug tracking-tight text-white md:text-4xl">
            저렴하게 시안 먼저 받아보고,
            <br />
            <span className="text-violet-300">본 계약을 결정하세요</span>
          </h2>
        </div>

        {/* 가격과 버튼 — 좁은 화면에서는 아래로 내려가 가로로 나란히 선다 */}
        <div className="flex shrink-0 items-center justify-between gap-5 md:flex-col md:items-end md:gap-4">
          <p className="text-2xl font-bold tracking-tight text-white md:text-3xl">
            {price.toLocaleString('ko-KR')}
            <span className="ml-0.5 text-sm font-medium text-white/70">원~</span>
          </p>

          <button
            type="button"
            onClick={() => setOpen(true)}
            className="shrink-0 rounded-full bg-white px-6 py-3 text-sm font-semibold text-neutral-900 transition hover:bg-violet-100 md:px-7"
          >
            의뢰하기
          </button>
        </div>
      </div>

      {open && <InquiryModal onClose={() => setOpen(false)} />}
    </section>
  )
}
