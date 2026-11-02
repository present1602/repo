'use client'

import { useState } from 'react'
import type { InquiryType } from '@/lib/inquiry-types'
import { INQUIRY_TYPE_SCOPE_KEY, type CategoryChoice } from '@/lib/inquiry-choices'
import { InquiryModal } from './inquiry/inquiry-modal'

/* 고른 유형의 한 단계 — 이름·금액·설명·작업 기간·포함 항목 */
export type PanelTier = {
  name: string
  priceLabel: string
  desc: string
  /* 노출 스위치가 꺼졌거나 비어 있으면 null */
  duration: string | null
  items: string[]
}

export type PanelEntry = {
  key: string
  /* 의뢰 폼에서 이 유형을 골라 둔 채 열기 위해 */
  type: InquiryType
  basic: PanelTier
  /* 유형 전체·디자이너별 프리미엄이 모두 켜졌을 때만 */
  premium?: PanelTier
}

/* 받침에 따라 '로'/'으로' — 받침이 없거나 ㄹ 이면 '로' */
function roEuro(word: string) {
  const c = word.charCodeAt(word.length - 1) - 0xac00
  if (c < 0 || c > 11171) return '로'
  const jong = c % 28
  return jong === 0 || jong === 8 ? '로' : '으로'
}

/* 디자이너 상세 오른쪽의 의뢰 패널.

   받는 유형을 라디오로 고르면 아래에 금액·작업 기간·포함 항목이 바뀌고,
   큰 버튼은 그 유형을 골라 둔 채 의뢰 폼을 연다. '먼저 문의하기'는 아무것도
   고르지 않은 채로 연다. 넓은 화면에서는 스크롤해도 따라온다. */
export function PlanPanel({
  designerId,
  designerName,
  choices,
  entries,
}: {
  designerId: string
  designerName: string
  /* 의뢰 폼의 분야·범위·금액(designerChoices) */
  choices: CategoryChoice[]
  entries: PanelEntry[]
}) {
  const [pickedKey, setPickedKey] = useState(entries[0]?.key ?? '')
  const [open, setOpen] = useState<{ type?: InquiryType } | null>(null)
  const picked = entries.find((e) => e.key === pickedKey) ?? entries[0]

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-neutral-200 lg:sticky lg:top-20">
      {entries.length > 0 && picked && (
        <>
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold">의뢰 유형</h2>
            <span className="text-xs text-neutral-500">{entries.length}개 중 선택</span>
          </div>

          <div role="radiogroup" aria-label="의뢰 유형" className="mt-3 space-y-2">
            {entries.map((e) => (
              <label
                key={e.key}
                className="flex cursor-pointer items-center gap-3 rounded-lg border border-neutral-300 px-3.5 py-3 transition hover:bg-neutral-50 has-[:checked]:border-violet-600 has-[:checked]:bg-violet-50"
              >
                <input
                  type="radio"
                  name="plan-panel"
                  checked={e.key === picked.key}
                  onChange={() => setPickedKey(e.key)}
                  className="shrink-0 accent-violet-600"
                />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{e.basic.name}</span>
                <span className="shrink-0 text-xs text-neutral-500">{e.basic.priceLabel}</span>
              </label>
            ))}
          </div>

          <TierBox tier={picked.basic} />
          {picked.premium && <TierBox tier={picked.premium} premium />}

          <button
            type="button"
            onClick={() => setOpen({ type: picked.type })}
            className="mt-4 w-full rounded-xl bg-violet-600 px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-violet-700"
          >
            {picked.basic.name}
            {roEuro(picked.basic.name)} 의뢰하기
          </button>
        </>
      )}

      <button
        type="button"
        onClick={() => setOpen({})}
        className={
          entries.length > 0
            ? 'mt-2 w-full rounded-xl px-4 py-3 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50'
            : 'w-full rounded-xl bg-violet-600 px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-violet-700'
        }
      >
        {entries.length > 0 ? '먼저 문의하기' : '문의하기'}
      </button>

      {open && (
        <InquiryModal
          designerId={designerId}
          designerName={designerName}
          choices={choices}
          initialScope={open.type ? INQUIRY_TYPE_SCOPE_KEY[open.type] : undefined}
          onClose={() => setOpen(null)}
        />
      )}
    </section>
  )
}

/* 고른 유형의 상세 — 기본은 회색 바탕, 프리미엄은 보라 테두리로 따로 묶는다 */
function TierBox({ tier, premium }: { tier: PanelTier; premium?: boolean }) {
  return (
    <div
      className={`mt-4 rounded-xl p-4 ${
        premium ? 'bg-white ring-1 ring-violet-200' : 'bg-neutral-50'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className={`min-w-0 truncate rounded-md px-2 py-0.5 text-xs font-semibold ${
            premium ? 'bg-violet-700 text-white' : 'bg-violet-100 text-violet-700'
          }`}
        >
          {premium ? `PREMIUM · ${tier.name}` : tier.name}
        </span>
        {tier.duration && (
          <span className="shrink-0 text-xs text-neutral-500">작업 기간 {tier.duration}</span>
        )}
      </div>

      <p className="mt-3 text-2xl font-bold tracking-tight">{tier.priceLabel}</p>

      {tier.desc && (
        <p className="mt-2 whitespace-pre-line text-xs leading-relaxed text-neutral-500">{tier.desc}</p>
      )}

      {tier.items.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {tier.items.map((it) => (
            <li key={it} className="flex items-start gap-2 text-sm text-neutral-700">
              <svg
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="mt-0.5 size-3.5 shrink-0 text-violet-600"
                aria-hidden
              >
                <path d="M3 8.5l3 3 7-7" />
              </svg>
              {it}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
