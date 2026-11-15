'use client'

import { useState } from 'react'
import { InquiryModal } from './inquiry/inquiry-modal'

/* 홈 맨 아래 띠 배너 — 작업을 쭉 본 뒤 바로 의뢰로 넘어가는 자리.

   흰 바탕이다. 앞의 작업 피드와 같은 색을 이어받아 화면이 끊기지 않고,
   가격과 버튼만 연보라 카드로 띄워 눈이 거기로 모이게 한다.

   어두운 띠로 "끝났다"를 알리던 예전 방식은 쓰지 않는다 — 대신 위에
   얇은 경계선을 긋고 여백을 크게 줘서 구간이 바뀐 것을 알린다. */
export function HomeCta({ price }: { price: number }) {
  const [open, setOpen] = useState(false)

  return (
    <section className="relative overflow-hidden border-t border-neutral-200/80 bg-neutral-50">
      {/* 오른쪽 카드 뒤에서 아주 옅게 번지는 보라 — 흰 바탕이 납작해 보이지 않게.
          장식이므로 클릭을 먹지 않는다 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_80%_50%,rgb(124_58_237/0.07),transparent_65%)]"
      />

      <div className="relative mx-auto flex max-w-7xl flex-col gap-8 px-5 py-14 md:flex-row md:items-center md:justify-between md:gap-12 md:px-8 md:py-20">
        <div className="min-w-0">
          {/* 알약 배지 대신 글자만 — 흰 바탕에서는 배지가 무거워 보인다.
              자간을 넓혀 작은 글씨를 표제처럼 읽히게 한다 */}
          <p className="text-[11px] font-bold tracking-[0.18em] text-violet-600">LOW RISK</p>

          <h2 className="mt-4 text-2xl font-bold leading-snug tracking-tight text-neutral-900 md:text-[2.5rem] md:leading-[1.25]">
            저렴하게 시안 먼저 받아보고,
            <br />
            <span className="text-violet-600">본 계약을 결정하세요</span>
          </h2>

          <p className="mt-4 text-sm leading-relaxed text-neutral-500 md:text-base">
            메인 시안 먼저 의뢰 후, 본 계약을 진행할 수 있어요.
          </p>

          {/* 개발만 맡기려는 손님은 이 띠 아래 자리(agency-banner.tsx)에서 받는다 —
              여기 작은 글씨로 끼워 두면 가격·의뢰 버튼에 묻혀 아무도 읽지 않는다 */}
        </div>

        {/* 가격과 버튼을 한 장의 카드로 묶는다 — 그냥 놓으면 둘이 흩어져 보인다.
            바탕이 연회색이므로 카드는 흰색으로 둔다 — 반투명 보라를 회색 위에
            얹으면 탁해지고, 흰색이어야 카드가 바탕에서 한 겹 떠 보인다.
            좁은 화면에서는 폭을 가득 채워 버튼을 누르기 쉽게 한다. */}
        <div className="w-full shrink-0 rounded-3xl border border-neutral-200/70 bg-white p-6 shadow-[0_1px_3px_rgb(0_0_0/0.04)] md:w-[22rem] md:p-8">
          <p className="text-center text-4xl font-black tracking-tight text-neutral-900 md:text-5xl">
            {price.toLocaleString('ko-KR')}
            <span className="ml-1 align-baseline text-base font-bold text-neutral-400 md:text-lg">
              원~
            </span>
          </p>

          <button
            type="button"
            onClick={() => setOpen(true)}
            className="mt-6 w-full rounded-xl bg-violet-600 px-7 py-4 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600 md:text-base"
          >
            의뢰하기
          </button>
        </div>
      </div>

      {open && <InquiryModal onClose={() => setOpen(false)} />}
    </section>
  )
}
