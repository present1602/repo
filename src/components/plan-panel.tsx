'use client'

import { Fragment, useState } from 'react'
import { dividerBefore, type CategoryChoice, type InquiryScope } from '@/lib/inquiry-choices'
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

/* 의뢰 유형 한 줄 — 분야 하나의 범위 하나(의뢰 폼의 선택지와 같은 단위) */
export type PanelEntry = {
  key: string
  /* 의뢰 폼에서 이 분야·범위를 골라 둔 채 열기 위해 */
  category: string
  scope: InquiryScope
  basic: PanelTier
  /* 유형 전체·디자이너별 프리미엄이 모두 켜졌을 때만 */
  premium?: PanelTier
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
  preview,
}: {
  designerId: string
  designerName: string
  /* 의뢰 폼의 분야·범위·금액(designerChoices) */
  choices: CategoryChoice[]
  entries: PanelEntry[]
  /* 스튜디오 미리보기 — 따라오지 않고, 버튼을 눌러도 폼을 열지 않는다 */
  preview?: boolean
}) {
  const [pickedKey, setPickedKey] = useState(entries[0]?.key ?? '')
  const [open, setOpen] = useState<{ category?: string; scope?: InquiryScope } | null>(null)
  const picked = entries.find((e) => e.key === pickedKey) ?? entries[0]
  const single = entries.length === 1
  const cats = entries.map((e) => e.category)

  return (
    <section
      className={`rounded-2xl bg-white p-5 shadow-sm ring-1 ring-neutral-200 ${preview ? '' : 'lg:sticky lg:top-20'}`}
    >
      {entries.length > 0 && picked && (
        <>
          {/* 유형이 하나뿐이면 고를 게 없다 — 라디오 목록 없이 아래 상자 하나로 보여준다(single) */}
          {!single && (
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="text-sm font-semibold">의뢰 유형</h2>
              <span className="text-xs text-neutral-500">{entries.length}개 중 선택</span>
            </div>
          )}

          {!single && (
            <div role="radiogroup" aria-label="의뢰 유형" className="mt-3 space-y-2">
              {entries.map((e, i) => (
                <Fragment key={e.key}>
                  {/* web/app 묶음 아래에 한 줄 — 같은 분야의 유형끼리 묶여 보이게 */}
                  {dividerBefore(cats, i) && <hr className="!my-3 border-neutral-200" />}
                  <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-neutral-300 px-3.5 py-3 transition hover:bg-neutral-50 has-[:checked]:border-violet-600 has-[:checked]:bg-violet-50">
                    <input
                      type="radio"
                      name="plan-panel"
                      checked={e.key === picked.key}
                      onChange={() => setPickedKey(e.key)}
                      className="shrink-0 accent-violet-600"
                    />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{e.basic.name}</span>
                    <span className="shrink-0 text-right text-xs text-neutral-500">
                      {e.basic.priceLabel}
                      <span className="block text-[10px] text-neutral-400">VAT 별도</span>
                    </span>
                  </label>
                </Fragment>
              ))}
            </div>
          )}

          <TierBox tier={picked.basic} single={single} />
          {picked.premium && <TierBox tier={picked.premium} premium />}
        </>
      )}

      {/* 버튼은 하나 — 고른 유형이 있으면 그 유형을 골라 둔 채 폼을 연다 */}
      <button
        type="button"
        onClick={() => !preview && setOpen(picked ? { category: picked.category, scope: picked.scope } : {})}
        className={`w-full rounded-xl bg-violet-600 px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-violet-700 ${
          entries.length > 0 ? 'mt-4' : ''
        }`}
      >
        문의하기
      </button>

      {open && (
        <InquiryModal
          designerId={designerId}
          designerName={designerName}
          choices={choices}
          initialCategory={open.category}
          initialScope={open.scope}
          onClose={() => setOpen(null)}
        />
      )}
    </section>
  )
}

/* 고른 유형의 상세 — 기본은 회색 바탕, 프리미엄은 보라 테두리로 따로 묶는다 */
/* single — 유형이 하나뿐일 때. 라디오의 골라 둔 모양(보라 테두리·연보라 바탕)을 이 상자가 이어받고,
   이름은 칩 대신 보라 글씨 제목으로 */
function TierBox({ tier, premium, single }: { tier: PanelTier; premium?: boolean; single?: boolean }) {
  return (
    <div
      className={`rounded-xl p-4 ${single ? 'border border-violet-600 bg-violet-50' : 'mt-4'} ${
        single ? '' : premium ? 'bg-white ring-1 ring-violet-200' : 'bg-neutral-50'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        {single ? (
          <span className="min-w-0 truncate text-base font-semibold text-violet-700">{tier.name}</span>
        ) : (
          <span
            className={`min-w-0 truncate rounded-md px-2 py-0.5 text-xs font-semibold ${
              premium ? 'bg-violet-700 text-white' : 'bg-violet-100 text-violet-700'
            }`}
          >
            {premium ? `PREMIUM · ${tier.name}` : tier.name}
          </span>
        )}
        {tier.duration && <span className="shrink-0 text-xs text-neutral-500">작업 기간 {tier.duration}</span>}
      </div>

      {/* 의뢰 폼과 같이 — 공개 화면의 금액은 모두 부가세 별도다 */}
      <p className="mt-3 text-2xl font-bold tracking-tight">
        {tier.priceLabel}
        <span className="ml-1.5 text-xs font-normal tracking-normal text-neutral-500">VAT 별도</span>
      </p>

      {tier.desc && <p className="mt-2 whitespace-pre-line text-xs leading-relaxed text-neutral-500">{tier.desc}</p>}

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
