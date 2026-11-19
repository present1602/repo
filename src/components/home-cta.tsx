'use client'

import { useState } from 'react'
import { InquiryModal } from './inquiry/inquiry-modal'

/* 홈 맨 아래 띠 배너 — 작업을 쭉 본 뒤 바로 의뢰로 넘어가는 자리.

   연회색 바탕 위에 흰 카드를 띄워 가격과 버튼으로 눈이 모이게 한다.

   어두운 띠로 "끝났다"를 알리던 예전 방식은 쓰지 않는다 — 대신 위에
   얇은 경계선을 긋고 여백을 크게 줘서 구간이 바뀐 것을 알린다.

   색은 보라 하나만 쓰고, 강조도 줄마다 한 번만 한다. 배지·색 상자를
   겹쳐 쌓으면 할인 전단지처럼 보여서, 카드 안은 줄과 글자 크기만으로
   위계를 만든다. 히어로·플랜 카드의 PriceStack 은 그대로 두고 이 띠만
   간결한 가격 줄(PriceRow)을 쓴다. */
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

const won = (n: number) => n.toLocaleString('ko-KR')

export function HomeCta({ prices }: { prices: HomePrice[] }) {
  const [open, setOpen] = useState(false)
  const discount = prices.find((p) => p.caseDiscount != null)?.caseDiscount

  return (
    <section aria-labelledby="home-inquiry-title" className="relative overflow-hidden border-t border-neutral-200/80 bg-neutral-50">
      {/* 오른쪽 카드 뒤에서 아주 옅게 번지는 보라 — 흰 바탕이 납작해 보이지 않게.
          장식이므로 클릭을 먹지 않는다 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_80%_50%,rgb(124_58_237/0.07),transparent_65%)]"
      />

      <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-5 py-16 md:px-8 md:py-24 lg:grid-cols-[minmax(0,1fr)_24rem] lg:gap-20">
        <div className="min-w-0">
          <p className="text-[11px] font-bold tracking-[0.18em] text-violet-600">DESIGN &amp; DEV</p>

          {/* 강조는 둘째 줄 하나만 — 문장이 한 덩어리로 읽힌다 */}
          <h2 id="home-inquiry-title" className="mt-4 text-[1.75rem] font-bold leading-[1.3] tracking-[-0.035em] text-neutral-900 md:text-[2.75rem] md:leading-[1.22]">
            전문 디자이너가 디자인하고,
            <br />
            <span className="text-violet-600">전문 개발자가 보증합니다</span>
          </h2>

          <p className="mt-5 max-w-md text-sm leading-[1.8] text-neutral-500 md:text-base">
            고객을 끌어들이는 홈페이지,
            <br className="hidden sm:block" /> SOOM의 전문 디자이너에게 의뢰하세요.
          </p>

          {/* 가격 인상 안내 — 큰 글씨 대신 작은 알림 한 줄로 */}
          <p className="mt-8 inline-flex items-center gap-2.5 rounded-full border border-neutral-200 bg-white px-4 py-2 text-[13px] font-medium text-neutral-700">
            <span aria-hidden="true" className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-violet-400 opacity-60 motion-reduce:hidden" />
              <span className="relative inline-flex size-2 rounded-full bg-violet-500" />
            </span>
            오픈 특가 진행 중 · 곧 의뢰가격이 인상됩니다
          </p>
        </div>

        <div className="mx-auto w-full max-w-md lg:mx-0 lg:max-w-none">
          <div className="rounded-3xl border border-neutral-200/80 bg-white p-6 shadow-[0_24px_48px_-28px_rgb(76_29_149/0.25)] md:p-8">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-sm font-bold text-neutral-900">오픈 이벤트 특가</p>
              <p className="shrink-0 text-[11px] text-neutral-400">VAT 별도</p>
            </div>

            <dl className="mt-5 divide-y divide-neutral-100 border-y border-neutral-100">
              {prices.map((p) => (
                <PriceRow key={p.label} {...p} />
              ))}
            </dl>

            <button
              type="button"
              onClick={() => setOpen(true)}
              className="mt-6 w-full rounded-xl bg-neutral-900 px-7 py-4 text-sm font-semibold text-white transition hover:bg-violet-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600 md:text-base"
            >
              의뢰하기
            </button>

            <div className="mt-4 space-y-0.5 text-center text-xs leading-relaxed text-neutral-400">
              {discount != null && <p>10만원 추가 할인은 오픈 이벤트 사례 게재 조건부로 적용되는 한시적인 이벤트 할인입니다.</p>}
              <p>개발 범위에 따라 가격이 달라집니다</p>
            </div>
          </div>
        </div>
      </div>

      {open && <InquiryModal onClose={() => setOpen(false)} />}
    </section>
  )
}

/* 한 상품의 가격 한 줄.
   왼쪽에 상품명과 정상가(할인 전 금액은 줄을 긋는다), 오른쪽에 사례 게재
   할인까지 적용한 최종가를 가장 크게 둔다. */
function PriceRow({ label, price, was, caseDiscount, startingAt }: HomePrice) {
  const tilde = startingAt ? '~' : ''
  const hasCase = caseDiscount != null
  const final = hasCase ? price - caseDiscount : price

  return (
    <div className="flex items-end justify-between gap-4 py-5">
      <div className="min-w-0">
        <dt className="text-[15px] font-semibold text-neutral-900">{label}</dt>
        <dd className="mt-1.5 flex flex-wrap items-baseline gap-x-1.5 text-xs tabular-nums text-neutral-400">
          {was != null && (
            <s className="decoration-neutral-300">
              <span className="sr-only">할인 전 </span>
              {won(was)}
            </s>
          )}
          {hasCase && (
            <span className="text-neutral-500">
              <span className="sr-only">정상가 </span>
              {won(price)}원{tilde}
            </span>
          )}
        </dd>
      </div>
      <dd className="shrink-0 text-right">
        {hasCase && (
          <span className="block text-[11px] font-semibold text-violet-600">
            −{caseDiscount / 10_000}만원 추가 할인
          </span>
        )}
        <span className="mt-0.5 block text-2xl font-bold leading-tight tracking-[-0.03em] tabular-nums text-neutral-900">
          {won(final)}
          <span className="ml-0.5 text-sm font-semibold text-neutral-500">원{tilde}</span>
        </span>
      </dd>
    </div>
  )
}
