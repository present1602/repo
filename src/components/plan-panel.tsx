'use client'

import { Fragment, useState } from 'react'
import { defaultScope, dividerBefore, type CategoryChoice, type InquiryScope } from '@/lib/inquiry-choices'
import type { PlanTier } from '@/lib/plans'
import { InquiryModal, PremiumBadge } from './inquiry/inquiry-modal'

/* 고른 유형의 한 단계 — 이름·금액·설명·작업 기간·포함 항목 */
export type PanelTier = {
  name: string
  priceLabel: string
  desc: string
  /* 노출 스위치가 꺼졌거나 비어 있으면 null */
  duration: string | null
  items: string[]
  /* 다른 단계에는 있고 이 단계에는 없는 항목 — 흐리게 '—' 로 견준다(0017, panel-entries.ts) */
  missing: string[]
}

/* 의뢰 유형 한 줄 — 분야 하나의 범위 하나(의뢰 폼의 선택지와 같은 단위) */
export type PanelEntry = {
  key: string
  /* 의뢰 폼에서 이 분야·범위를 골라 둔 채 열기 위해 */
  category: string
  scope: InquiryScope
  /* 이 줄에 메인화면 먼저 의뢰 옵션을 붙일 수 있는지(분야의 범위별 스위치, 0013) */
  sampleOk: boolean
  basic: PanelTier
  /* 유형 전체·디자이너별 프리미엄이 모두 켜졌을 때만 */
  premium?: PanelTier
}

/* 디자이너 상세 오른쪽의 의뢰 패널.

   받는 유형을 라디오로 고르면 아래에 금액·작업 기간·포함 항목이 바뀌고,
   큰 버튼은 그 유형을 골라 둔 채 의뢰 폼을 연다. '먼저 문의하기'는 아무것도
   고르지 않은 채로 연다. 넓은 화면에서는 스크롤해도 따라온다.
   프리미엄이 있는 유형은 STANDARD·PREMIUM 탭으로 한 단계씩 보여주고,
   버튼은 보고 있는 단계를 골라 둔 채 폼을 연다. */
/* 바깥에서 고를 줄 — 스튜디오 포함 항목에서 고치는 칸의 유형을 미리보기에 띄운다.
   seq 가 바뀔 때마다 다시 고른다(같은 칸을 다시 건드려도 옮겨 가게).
   tier — PREMIUM 열을 고치면 미리보기도 PREMIUM 탭으로 */
export type PanelFocus = {
  category: string
  scope: InquiryScope
  tier?: PlanTier
  seq: number
}

export function PlanPanel({
  designerId,
  designerName,
  choices,
  entries,
  preview,
  focus,
}: {
  designerId: string
  designerName: string
  /* 의뢰 폼의 분야·범위·금액(designerChoices) */
  choices: CategoryChoice[]
  entries: PanelEntry[]
  /* 스튜디오 미리보기 — 따라오지 않고, 버튼을 눌러도 폼을 열지 않는다 */
  preview?: boolean
  focus?: PanelFocus | null
}) {
  /* 라디오는 본계약 줄만 — 메인화면 먼저 의뢰는 고른 줄 안의 옵션이다(의뢰 폼과 같다, splitSample).
     본계약 줄이 없는 분야(플랜을 숨긴 경우)만 메인 시안 줄을 그대로 둔다 */
  const hasMain = (category: string) => entries.some((e) => e.category === category && e.scope !== 'sample')
  const sampleOf = (category: string) =>
    hasMain(category) ? (entries.find((e) => e.category === category && e.scope === 'sample') ?? null) : null
  const list = entries.filter((e) => e.scope !== 'sample' || !hasMain(e.category))

  /* 처음에는 첫 분야의 기본 범위 — 디자인만·디자인 + 개발이 둘 다 있으면 프로젝트 의뢰(defaultScope) */
  const [pickedKey, setPickedKey] = useState(() => {
    const first = list.filter((e) => e.category === list[0]?.category)
    const scope = defaultScope(first.map((e) => e.scope))
    return (first.find((e) => e.scope === scope) ?? list[0])?.key ?? ''
  })
  const [withSample, setWithSample] = useState(false)
  /* 보고 있는 단계 탭 — 처음에는 PREMIUM(프리미엄이 있는 유형이면 그것부터 보인다).
     프리미엄이 없는 유형으로 옮기면 탭이 없어 STANDARD 로 보인다 */
  const [tier, setTier] = useState<PlanTier>('premium')
  const [open, setOpen] = useState<{
    category?: string
    scope?: InquiryScope
    sample?: boolean
    premium?: boolean
  } | null>(null)

  /* 바깥에서 고른 줄로 옮긴다 — 그리는 중에 바로 고친다(effect 로 미루면 한 번 깜빡인다).
     메인 시안은 라디오 줄이 아니라 고른 줄의 옵션이라, 그 분야에서 옵션을 받는 기본 줄을 고르고 켠다 */
  const [seenSeq, setSeenSeq] = useState(0)
  if (focus && focus.seq !== seenSeq) {
    setSeenSeq(focus.seq)
    const own = list.filter((e) => e.category === focus.category)
    if (focus.scope === 'sample') {
      const mains = own.filter((e) => e.scope !== 'sample' && e.sampleOk)
      const scope = defaultScope(mains.map((e) => e.scope))
      const target = mains.find((e) => e.scope === scope) ?? mains[0] ?? own.find((e) => e.scope === 'sample')
      if (target) {
        setPickedKey(target.key)
        setWithSample(target.scope !== 'sample')
      }
    } else {
      const target = own.find((e) => e.scope === focus.scope)
      if (target) {
        setPickedKey(target.key)
        setWithSample(false)
        if (focus.tier) setTier(focus.tier)
      }
    }
  }

  const picked = list.find((e) => e.key === pickedKey) ?? list[0]
  /* 고른 줄이 메인 시안 옵션을 받을 때만(디자인만 의뢰에서는 뺄 수 있다) */
  const sample = picked?.sampleOk ? sampleOf(picked.category) : null
  const sampleOn = withSample && sample != null
  /* 탭은 본계약에 프리미엄이 있을 때만 — 메인 시안을 덧붙이면 그 의뢰만 보인다 */
  const tabs = !sampleOn && picked?.premium != null
  const onPremium = tabs && tier === 'premium'
  const single = list.length === 1
  const cats = list.map((e) => e.category)

  const pick = (e: PanelEntry) => {
    /* 다른 분야로 넘어가면 메인 시안 옵션은 끈다 — 같은 분야 안에서는 그대로 */
    if (e.category !== picked?.category) setWithSample(false)
    setPickedKey(e.key)
  }

  /* 메인화면 먼저 의뢰 덧붙이기 — 고른 줄 안(또는 줄이 하나뿐이면 상자 위)에 */
  const sampleToggle = sample && (
    <label
      className={`flex cursor-pointer items-center gap-2.5 rounded-md border border-violet-200 bg-white px-3 ${
        preview ? 'mt-1.5 py-1.5' : 'mt-2.5 py-2.5'
      }`}
    >
      <input
        type="checkbox"
        checked={withSample}
        onChange={(ev) => setWithSample(ev.target.checked)}
        className="size-4 shrink-0 accent-violet-600"
      />
      {/* 패널이 좁아 이름과 금액을 두 줄로 — 한 줄이면 이름이 중간에서 꺾인다 */}
      <span className="min-w-0 flex-1">
        <span className={`block font-medium ${preview ? 'text-xs' : 'text-sm'}`}>메인화면 먼저 의뢰</span>
        <span className="block text-xs font-semibold text-violet-700">{sample.basic.priceLabel}</span>
      </span>
    </label>
  )

  return (
    <section
      className={`rounded-2xl bg-white p-5 shadow-sm ring-1 ring-neutral-200 ${preview ? '' : 'lg:sticky lg:top-20'}`}
    >
      {list.length > 0 && picked && (
        <>
          {/* 유형이 하나뿐이어도 라디오 줄을 골라 둔 채 보여준다 — 무엇을 의뢰하는지 이름이 늘 위에 있고,
              아래 STANDARD·PREMIUM 탭이 패널 맨 위에 붙지 않는다. 라디오는 다른 줄이 없어 풀 수 없다 */}
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold">의뢰 유형</h2>
            {!single && <span className="text-xs text-neutral-500">{list.length}개 중 선택</span>}
          </div>

          <div role="radiogroup" aria-label="의뢰 유형" className={`mt-3 ${preview ? 'space-y-1.5' : 'space-y-2'}`}>
            {list.map((e, i) => {
              const on = e.key === picked.key
              const hasSample = e.sampleOk && sampleOf(e.category) != null
              return (
                <Fragment key={e.key}>
                  {/* web/app 묶음 아래에 한 줄 — 같은 분야의 유형끼리 묶여 보이게 */}
                  {dividerBefore(cats, i) && <hr className="!my-3 border-neutral-200" />}
                  {/* 테두리는 라디오 상태로 칠한다 — 안의 옵션 체크박스가 has-[:checked] 에 걸리지 않게 */}
                  <div
                    className={`rounded-lg border transition ${preview ? 'px-3 py-2' : 'px-3.5 py-3'} ${
                      on ? 'border-violet-600 bg-violet-50' : 'border-neutral-300 hover:bg-neutral-50'
                    }`}
                  >
                    <label className="flex cursor-pointer items-start gap-3">
                      <input
                        type="radio"
                        name="plan-panel"
                        checked={on}
                        onChange={() => pick(e)}
                        className="mt-0.5 shrink-0 accent-violet-600"
                      />
                      {/* 이름은 자르지 않는다 — 길어 가격과 한 줄에 들어가지 않으면
                            가격이 아랫줄 오른쪽으로 내려간다(flex-wrap + ml-auto) */}
                      <span
                        className={`flex min-w-0 flex-1 flex-wrap items-baseline justify-between gap-x-3 ${
                          preview ? 'gap-y-0.5' : 'gap-y-1'
                        }`}
                      >
                        {/* 스튜디오 미리보기는 칸이 좁아 이름을 한 단계 작게 */}
                        <span className={`font-medium ${preview ? 'text-xs' : 'text-sm'}`}>{e.basic.name}</span>
                        <span className="ml-auto shrink-0 text-right text-xs text-neutral-500">
                          {e.basic.priceLabel}
                          {/* 미리보기는 카드를 낮게 — VAT 줄을 뺀다(아래 금액 상자에 있다) */}
                          {!preview && <span className="block text-[10px] text-neutral-400">VAT 별도</span>}
                        </span>
                        {/* 프리미엄이 있는 유형 — 의뢰 폼과 같은 뱃지·금액 */}
                        {e.premium && (
                          <span
                            className={`flex basis-full items-center gap-1.5 text-violet-700 ${preview ? 'text-[11px]' : 'text-xs'}`}
                          >
                            <PremiumBadge />
                            {e.premium.priceLabel}
                          </span>
                        )}
                        {/* 메인 시안을 받는 분야 — 고르면 아래에서 덧붙일 수 있다 */}
                        {hasSample && !on && (
                          <span
                            className={`basis-full font-medium text-violet-600 ${preview ? 'text-[11px]' : 'text-xs'}`}
                          >
                            메인화면 먼저 의뢰 가능
                          </span>
                        )}
                      </span>
                    </label>
                    {on && <div className="pl-7">{sampleToggle}</div>}
                  </div>
                </Fragment>
              )
            })}
          </div>

          {/* 메인 시안을 덧붙였으면 그 의뢰의 금액·내용을, 아니면 고른 본계약을.
              key — 다른 유형으로 옮기면 새로 그린다(옮긴 것만으로 포함 항목이 깜빡이지 않게) */}
          {sampleOn ? (
            <TierBox key={`${sample.key}:basic`} tier={sample.basic} flash={preview} />
          ) : tabs && picked.premium ? (
            /* STANDARD·PREMIUM 탭 — 패널 양옆 끝까지 줄을 긋고, 아래에 고른 단계 하나 */
            <div className="mt-4">
              <div role="tablist" aria-label="패키지" className="-mx-5 grid grid-cols-2 border-y border-neutral-200">
                {(['basic', 'premium'] as const).map((t) => {
                  const on = (t === 'premium') === onPremium
                  return (
                    <button
                      key={t}
                      type="button"
                      role="tab"
                      aria-selected={on}
                      onClick={() => setTier(t)}
                      className={`text-[13px] tracking-wide transition ${preview ? 'py-2.5' : 'py-3.5'} ${
                        on
                          ? 'font-bold text-neutral-900 shadow-[inset_0_-2px_0_var(--color-neutral-900)]'
                          : 'font-medium text-neutral-500 hover:text-neutral-800'
                      }`}
                    >
                      {t === 'premium' ? 'PREMIUM' : 'STANDARD'}
                    </button>
                  )
                })}
              </div>
              <TierBox
                key={`${picked.key}:${onPremium ? 'premium' : 'basic'}`}
                tier={onPremium ? picked.premium : picked.basic}
                plain
                flash={preview}
              />
            </div>
          ) : (
            <TierBox key={`${picked.key}:basic`} tier={picked.basic} flash={preview} />
          )}
        </>
      )}

      {/* 버튼은 하나 — 고른 유형(과 메인 시안 옵션)을 골라 둔 채 폼을 연다 */}
      <button
        type="button"
        onClick={() =>
          !preview &&
          setOpen(
            picked
              ? {
                  category: picked.category,
                  scope: picked.scope,
                  sample: sampleOn,
                  premium: onPremium,
                }
              : {},
          )
        }
        className={`w-full rounded-xl bg-violet-600 px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-violet-700 ${
          list.length > 0 ? 'mt-4' : ''
        }`}
      >
        {/* 탭이 있으면 보고 있는 단계로 묻는다 */}
        {tabs ? (onPremium ? 'Premium으로 문의하기' : 'Standard로 문의하기') : '문의하기'}
      </button>

      {/* 다른 단계는 어떤지 한 줄로 — 탭을 눌러 보지 않아도 견줄 수 있게 */}
      {tabs && picked.premium && (
        <p className={`text-center text-xs text-neutral-500 ${preview ? 'mt-2' : 'mt-2.5'}`}>
          {onPremium
            ? `Standard는 ${picked.basic.priceLabel}${picked.basic.duration ? ` · ${picked.basic.duration}` : ''}`
            : `Premium은 ${picked.premium.priceLabel}${picked.premium.duration ? ` · ${picked.premium.duration}` : ''}`}
        </p>
      )}

      {open && (
        <InquiryModal
          designerId={designerId}
          designerName={designerName}
          choices={choices}
          initialCategory={open.category}
          initialScope={open.scope}
          initialSample={open.sample}
          initialPremium={open.premium}
          onClose={() => setOpen(null)}
        />
      )}
    </section>
  )
}

/* 고른 유형의 상세 — 프리미엄이 없으면 회색 바탕 상자 하나 */
/* plain — STANDARD·PREMIUM 탭 아래. 탭이 단계를 알리므로 상자 없이 이름을 굵은 제목으로,
   포함 항목 아래에 다른 단계에만 있는 항목을 흐리게 '—' 로 둔다 */
/* flash — 스튜디오 미리보기. 포함 항목이 새로 생기거나 바뀌면(시안 2종 → 3종) 그 줄을 두 번 깜빡여
   어디가 바뀌었는지 눈에 띄게 한다 */
function TierBox({ tier, plain, flash }: { tier: PanelTier; plain?: boolean; flash?: boolean }) {
  /* 직전에 그린 항목과 비교해 새 줄을 고른다 — 그리는 중에 바로(effect 로 미루면 한 번 늦게 깜빡인다).
     seq 를 key 에 붙여 같은 글자가 다시 들어와도 애니메이션이 처음부터 돈다 */
  const [known, setKnown] = useState(tier.items)
  const [fresh, setFresh] = useState<{ items: string[]; seq: number }>({
    items: [],
    seq: 0,
  })
  if (flash && tier.items.join('\n') !== known.join('\n')) {
    setKnown(tier.items)
    const added = tier.items.filter((it) => !known.includes(it))
    if (added.length > 0) setFresh((f) => ({ items: added, seq: f.seq + 1 }))
  }

  return (
    <div className={plain ? 'pt-4' : 'mt-4 rounded-xl bg-neutral-50 p-4'}>
      <div className="flex items-center justify-between gap-2">
        {plain ? (
          <span className="min-w-0 truncate text-[15px] font-bold">{tier.name}</span>
        ) : (
          <span className="min-w-0 truncate rounded-md bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-700">
            {tier.name}
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

      {(tier.items.length > 0 || tier.missing.length > 0) && (
        <ul className={`space-y-1.5 ${plain ? 'mt-4 border-t border-dashed border-neutral-200 pt-3.5' : 'mt-3'}`}>
          {tier.items.map((it) => {
            const isFresh = fresh.items.includes(it)
            return (
              <li
                key={isFresh ? `${it}:${fresh.seq}` : it}
                className={`flex items-start gap-2 text-sm text-neutral-700 ${isFresh ? 'item-flash' : ''}`}
              >
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
            )
          })}
          {/* 다른 단계에만 있는 항목 — 이 단계에는 빠져 있다 */}
          {tier.missing.map((it) => (
            <li key={`missing:${it}`} className="flex items-start gap-2 text-sm text-neutral-400">
              <span aria-hidden className="grid size-3.5 shrink-0 place-items-center leading-5">
                —
              </span>
              <span className="min-w-0">
                <span className="sr-only">미포함: </span>
                {it}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
