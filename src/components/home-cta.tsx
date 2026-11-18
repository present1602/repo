'use client'

import { useState } from 'react'
import { InquiryModal } from './inquiry/inquiry-modal'
import { PriceStack } from './price-stack'

/* 홈 맨 아래 띠 배너 — 작업을 쭉 본 뒤 바로 의뢰로 넘어가는 자리.

   연회색 바탕 위에 흰 카드를 띄워 가격과 버튼으로 눈이 모이게 한다.

   어두운 띠로 "끝났다"를 알리던 예전 방식은 쓰지 않는다 — 대신 위에
   얇은 경계선을 긋고 여백을 크게 줘서 구간이 바뀐 것을 알린다. */
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

  return (
    <section aria-labelledby="home-inquiry-title" className="relative overflow-hidden border-t border-neutral-200/80 bg-neutral-50">
      {/* 오른쪽 카드 뒤에서 아주 옅게 번지는 보라 — 흰 바탕이 납작해 보이지 않게.
          장식이므로 클릭을 먹지 않는다 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_80%_50%,rgb(124_58_237/0.07),transparent_65%)]"
      />

      <div className="relative mx-auto grid max-w-7xl gap-10 px-5 py-14 md:px-8 md:py-20 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-16">
        <div className="min-w-0 lg:pt-6">
          {/* 알약 배지 대신 글자만 — 흰 바탕에서는 배지가 무거워 보인다.
              자간을 넓혀 작은 글씨를 표제처럼 읽히게 한다 */}
          <p className="text-[11px] font-bold tracking-[0.18em] text-violet-600">DESIGN &amp; DEV</p>

          <h2 id="home-inquiry-title" className="mt-4 text-2xl font-bold leading-snug tracking-tight text-neutral-900 md:text-[2.5rem] md:leading-[1.25]">
            {/* 누가(전문 디자이너·전문 개발자) 무엇을(디자인·보증) 하는지만
                강조색으로 — 조사와 어미는 기본색으로 둬서 핵심어가 튀게 한다 */}
            <span className="text-violet-600">전문 디자이너</span>가{' '}
            <span className="text-violet-600">디자인</span>하고,
            <br />
            <span className="text-violet-600">전문 개발자</span>가{' '}
            <span className="text-violet-600">보증</span>합니다
          </h2>

          <p className="mt-4 text-sm leading-relaxed text-neutral-500 md:text-base">
            고객을 끌어들이는 홈페이지, SOOM의 전문 디자이너에게 의뢰하세요.
          </p>

          <p className="mt-5 text-base font-medium leading-relaxed text-neutral-600 md:text-lg">
            곧 의뢰가격이 인상됩니다.
            <br />
            지금 바로 문의하세요.
          </p>
        </div>

        <div className="mx-auto w-full max-w-lg lg:mx-0 lg:max-w-none">
          <div className="rounded-3xl border border-neutral-200/80 bg-white p-6 shadow-[0_8px_24px_-12px_rgb(23_23_23/0.12)] md:p-7">
            <div className="flex items-start justify-between gap-3">
              <p className="inline-flex items-center gap-1.5 rounded-md bg-[#fff1d6] px-2.5 py-1 text-xs font-bold text-[#a7472d]">
                <span aria-hidden="true" className="text-[#e78439]">✦</span>
                오픈 이벤트 특가
              </p>
              <p className="shrink-0 pt-1 text-[11px] text-neutral-400">VAT 별도</p>
            </div>
            <dl className="mt-2 divide-y divide-neutral-100">
              {prices.map((p) => (
                <div key={p.label} className="py-4">
                  <dt className="px-1 text-sm font-semibold text-neutral-800 md:text-[15px]">{p.label}</dt>
                  <dd className="mt-2.5">
                    <PriceStack {...p} />
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mt-2 text-xs leading-relaxed text-neutral-500">**개발 범위에 따라 가격이 달라집니다.</p>

            <button
              type="button"
              onClick={() => setOpen(true)}
              className="mt-4 w-full rounded-xl bg-violet-600 px-7 py-4 text-sm font-semibold text-white transition hover:bg-violet-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600 md:text-base"
            >
              의뢰하기
            </button>

            <p className="mt-3 text-center text-xs leading-relaxed text-balance text-neutral-500">
              **추가 할인은 사례 게재에 동의하시면 적용됩니다.
            </p>
          </div>
        </div>
      </div>

      {open && <InquiryModal onClose={() => setOpen(false)} />}
    </section>
  )
}
