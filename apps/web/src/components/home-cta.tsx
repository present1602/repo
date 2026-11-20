'use client'

import { useState } from 'react'
import { InquiryModal } from './inquiry/inquiry-modal'

/* 홈 맨 아래 의뢰 띠 — 작업과 플랜을 다 본 뒤 바로 의뢰로 넘어가는 자리.

   가격은 바로 위 플랜 카드에 이미 있어 여기서 다시 늘어놓지 않는다.
   가운데 정렬로 한 문장 · 한 버튼만 두고, 아래에서 번지는 장밋빛으로
   마지막 구간임을 알린다. */
/* was 는 할인 전 금액 — 줄을 그어 지금 금액 위에 작게 둔다 */
export type HomePrice = {
  label: string
  price: number
  was?: number
  /* 사례 게재 조건으로 더 깎아 주는 금액 — 있으면 할인 문구를 띄운다 */
  caseDiscount?: number
  startingAt?: boolean
  description?: string
  items: string[]
}

export function HomeCta({ prices }: { prices: HomePrice[] }) {
  const [open, setOpen] = useState(false)
  const discount = prices.find((p) => p.caseDiscount != null)?.caseDiscount

  return (
    <section aria-labelledby="home-inquiry-title" className="relative overflow-hidden py-24 text-center md:py-28">
      {/* 아래에서 번지는 장밋빛 — 장식이므로 클릭을 먹지 않는다 */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[45%] size-[900px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,var(--color-blush),transparent_70%)] opacity-70"
      />

      <div className="relative mx-auto grid max-w-[1240px] justify-items-center gap-6 px-5 md:px-8">
        {/* 가격 인상 안내 — 큰 글씨 대신 작은 알림 한 줄로 */}
        <p className="inline-flex items-center gap-2 rounded-full border border-line bg-card px-4 py-2 text-[13px] text-ink">
          <span aria-hidden="true" className="relative flex size-1.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-plum opacity-60 motion-reduce:hidden" />
            <span className="relative inline-flex size-1.5 rounded-full bg-plum" />
          </span>
          오픈 특가 진행 중 · 곧 의뢰가격이 인상됩니다
        </p>

        <h2 id="home-inquiry-title" className="text-[clamp(1.7rem,3.6vw,2.8rem)] leading-[1.3] font-medium tracking-[-0.045em] text-balance">
          고객을 끌어들이는 홈페이지
          <span className="serif-i block text-[1.25em] leading-[1.15]">Let&apos;s begin.</span>
        </h2>

        <p className="max-w-[28em] text-[15px] leading-[1.8] text-ink-soft">
          SOOM의 전문 디자이너에게 의뢰하세요. 문의를 남기시면 영업일 기준으로 빠르게 연락드려요.
        </p>

        <button
          type="button"
          onClick={() => setOpen(true)}
          className="group inline-flex min-h-12 items-center gap-4 border border-ink bg-ink px-7 text-sm font-semibold text-paper transition hover:border-plum hover:bg-plum focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-plum"
        >
          의뢰하기
          <span aria-hidden="true" className="transition-transform group-hover:translate-x-1 motion-reduce:transform-none">→</span>
        </button>

        <div className="space-y-0.5 text-xs leading-relaxed text-ink-faint">
          {discount != null && <p>{discount / 10_000}만원 추가 할인은 오픈 이벤트 사례 게재 조건부로 적용되는 한시적인 이벤트 할인입니다.</p>}
          <p>VAT 별도 · 개발 범위에 따라 가격이 달라집니다</p>
        </div>
      </div>

      {open && <InquiryModal onClose={() => setOpen(false)} />}
    </section>
  )
}
