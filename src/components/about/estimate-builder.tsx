'use client'

import { useState } from 'react'
import Image from 'next/image'
import worksShot from '@/assets/about/gyeol-works.jpg'
import { AboutInquiryButton } from '@/components/about-inquiry-button'
import {
  ABOUT_INQUIRY_CATEGORY,
  ADD_ONS,
  ADD_ON_GROUPS,
  ESTIMATE_EVENT_LABEL,
  ESTIMATE_PRESETS,
  LANDING_BASE_POINTS,
  LANDING_PRICE,
  SITE_KINDS,
  WEBSITE_PRICE,
  manwon,
  won,
  type AddOn,
  type SiteKind,
} from '@/lib/landing-package'

/* 기본형 + 추가 기능 견적표.

   왼쪽에서 기능을 켜고 끄면 오른쪽(모바일은 아래 고정 띠) 합계가 바로 바뀐다.
   위의 '견적 예시' 버튼은 대표 구성을 한 번에 고른다.

   금액은 안내용이다 — 서버에 보내거나 저장하지 않는다. 실제 견적은 상담에서
   정하므로 합계 아래에 그 점을 적어 둔다. */
const DEFAULT_PRESET = 1

export function EstimateBuilder() {
  /* 랜딩페이지만 기능을 골라 더한다. 웹사이트·프리미엄은 상담으로 견적을 정하므로 체크 없이 안내만 */
  const [kind, setKind] = useState<SiteKind>('landing')
  const [picked, setPicked] = useState<ReadonlySet<string>>(() => new Set(ESTIMATE_PRESETS[DEFAULT_PRESET].ids))

  function toggle(item: AddOn) {
    setPicked((prev) => {
      const next = new Set(prev)
      if (next.has(item.id)) {
        next.delete(item.id)
        /* 이 항목이 있어야 하는 다른 항목도 함께 뺀다(구독을 끄면 메일 발송도) */
        for (const other of ADD_ONS) if (other.requires === item.id) next.delete(other.id)
      } else {
        next.add(item.id)
        if (item.requires) next.add(item.requires)
      }
      return next
    })
  }

  const chosen = ADD_ONS.filter((a) => picked.has(a.id))
  const min = LANDING_PRICE.price + chosen.reduce((s, a) => s + a.price, 0)
  const max = LANDING_PRICE.price + chosen.reduce((s, a) => s + (a.maxPrice ?? a.price), 0)
  const open = chosen.some((a) => a.startingAt)
  const activePreset = ESTIMATE_PRESETS.findIndex(
    (p) => p.ids.length === picked.size && p.ids.every((id) => picked.has(id)),
  )

  const range = (lo: number, hi: number) =>
    lo === hi ? `${won(lo)}${open ? '~' : ''}` : `${lo.toLocaleString('ko-KR')} ~ ${won(hi)}${open ? '~' : ''}`
  const finalRange = range(min - LANDING_PRICE.caseDiscount, max - LANDING_PRICE.caseDiscount)

  /* 의뢰 폼에 넘길 상품 이름 — 고른 기능은 이름만 덧붙인다(금액은 상담에서 정한다) */
  const landingProduct =
    chosen.length > 0 ? `랜딩페이지 기본형 + ${chosen.map((a) => a.title).join(', ')}` : '랜딩페이지 기본형'

  const site = SITE_KINDS.find((k) => k.id === kind)!

  return (
    <div>
      {/* 유형 — 랜딩페이지만 아래에서 기능을 고른다 */}
      <div role="radiogroup" aria-label="사이트 유형" className="grid gap-2.5 sm:grid-cols-3">
        {SITE_KINDS.map((k) => (
          <label
            key={k.id}
            className="flex cursor-pointer flex-col rounded-2xl border border-neutral-200 bg-white px-4 py-3.5 transition hover:border-violet-300 has-checked:border-violet-600 has-checked:bg-violet-50 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-violet-500"
          >
            <input
              type="radio"
              name="site-kind"
              value={k.id}
              checked={kind === k.id}
              onChange={() => setKind(k.id)}
              className="sr-only"
            />
            <span className="text-[15px] font-bold leading-snug text-neutral-900">{k.label}</span>
            <span className="mt-1 text-xs leading-relaxed text-neutral-500">{k.tagline}</span>
            <span className="mt-2 text-sm font-bold tabular-nums text-violet-700">{won(k.price)}~</span>
          </label>
        ))}
      </div>

      {kind === 'landing' ? (
        <div className="mt-8">
      {/* 견적 예시 */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-xs font-semibold text-neutral-500">견적 예시</span>
        {ESTIMATE_PRESETS.map((p, i) => (
          <button
            key={p.label}
            type="button"
            aria-pressed={activePreset === i}
            onClick={() => setPicked(new Set(p.ids))}
            className="rounded-full border border-neutral-200 bg-white px-3.5 py-1.5 text-[13px] font-medium text-neutral-700 transition hover:border-violet-300 hover:text-violet-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500 aria-pressed:border-violet-600 aria-pressed:bg-violet-600 aria-pressed:text-white"
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start lg:gap-8">
        <div className="space-y-6 sm:space-y-8">
          {/* 기본형 — 항상 들어가는 줄 */}
          <div className="rounded-2xl border border-violet-200 bg-violet-50/60 px-5 py-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-violet-600 text-sm font-bold text-white">✓</span>
                <div>
                  <p className="text-[15px] font-bold text-neutral-900">랜딩페이지 기본형</p>
                </div>
              </div>
              <p className="shrink-0 text-[15px] font-bold tabular-nums text-neutral-900">{won(LANDING_PRICE.price)}~</p>
            </div>
            {/* 기본형에 들어 있는 것 — 제목 글자 줄에 맞춰 들여 쓴다 */}
            <ul className="mt-3 grid gap-x-4 gap-y-1.5 pl-10 sm:grid-cols-2">
              {LANDING_BASE_POINTS.map((t) => (
                <li key={t} className="flex items-center gap-1.5 text-[12.5px] text-neutral-600">
                  <span aria-hidden className="text-[11px] font-bold text-violet-600">✓</span>
                  {t}
                </li>
              ))}
            </ul>
          </div>

          {ADD_ON_GROUPS.map((group) => (
            <fieldset key={group.id}>
              <legend className="flex items-baseline gap-2">
                <span className="text-[15px] font-bold text-neutral-900">{group.label}</span>
                <span className="text-xs text-neutral-400">{group.hint}</span>
              </legend>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 sm:gap-3">
                {ADD_ONS.filter((a) => a.group === group.id).map((item) => (
                  <AddOnCard key={item.id} item={item} checked={picked.has(item.id)} onToggle={() => toggle(item)} />
                ))}
                {group.id === 'custom' && (
                  <div className="flex flex-col justify-center rounded-2xl border border-dashed border-neutral-300 px-5 py-4 text-sm leading-relaxed text-neutral-500">
                    <p className="font-semibold text-neutral-700">그 밖의 기능도 만들 수 있어요</p>
                    <p className="mt-1">복잡한 콘텐츠 관리시스템, 주문, 결제, 정산, AI 광고콘텐츠 생성 등 사장님의 목적에 특화된 기능들도 다 개발 가능합니다.</p>
                  </div>
                )}
              </div>
            </fieldset>
          ))}
        </div>

        {/* 견적서 — 넓은 화면에서는 따라 내려온다 */}
        <aside aria-label="예상 견적" className="lg:sticky lg:top-20">
          <div className="rounded-3xl bg-[#19172a] p-6 text-white shadow-[0_20px_50px_-25px_rgb(25_23_42/0.7)] md:p-7">
            <p className="text-[11px] font-semibold tracking-[0.18em] text-violet-300">ESTIMATE</p>
            <p className="mt-2 text-lg font-bold">예상 견적</p>

            <ul className="mt-5 space-y-2.5 border-t border-white/10 pt-5 text-sm">
              <li className="flex justify-between gap-3">
                <span className="text-white/80">랜딩페이지 기본형</span>
                <span className="shrink-0 tabular-nums">{won(LANDING_PRICE.price)}</span>
              </li>
              {chosen.map((a) => (
                <li key={a.id} className="flex justify-between gap-3">
                  <span className="text-white/80">+ {a.title}</span>
                  <span className="shrink-0 tabular-nums">{priceText(a)}</span>
                </li>
              ))}
              {chosen.length === 0 && <li className="text-xs text-white/40">추가 기능을 고르면 여기에 더해집니다</li>}
            </ul>

            {/* 합계가 주인공 — 이벤트 할인은 그 아래 작은 배지로 덧붙인다 */}
            <div className="mt-5 border-t border-white/10 pt-5">
              <p className="text-sm text-white/70">합계</p>
              <p aria-live="polite" className="mt-1 text-[1.9rem] font-extrabold leading-tight tracking-tight tabular-nums text-white">
                {range(min, max)}
                <sup className="ml-1 align-super text-[10.5px] font-medium tracking-normal text-white/50">VAT 별도</sup>
              </p>
            </div>

            <div className="mt-4 rounded-xl bg-violet-500/15 px-3.5 py-3 ring-1 ring-inset ring-violet-400/30">
              <p className="flex items-start gap-1.5 text-[11.5px] font-semibold leading-snug text-violet-200">
                <span aria-hidden className="text-orange-300">✦</span>
                {ESTIMATE_EVENT_LABEL}
              </p>
              <p className="mt-1.5 text-sm text-white/80">
                <b className="font-extrabold tabular-nums text-violet-300">{finalRange}</b>
              </p>
              <p className="mt-0.5 text-[11px] text-white/45">사례 게재 동의조건</p>
            </div>

            <AboutInquiryButton
              category={ABOUT_INQUIRY_CATEGORY}
              product={landingProduct}
              className="mt-5 w-full bg-violet-500 text-white hover:bg-violet-400"
            />
          </div>
        </aside>
      </div>

      {/* 모바일 — 고르는 동안 합계가 화면 밖으로 사라지지 않게 아래에 붙여 둔다 */}
      <div className="pointer-events-none sticky bottom-3 z-10 mt-6 lg:hidden">
        <div className="pointer-events-auto flex items-center justify-between gap-3 rounded-2xl bg-[#19172a]/95 px-4 py-3 text-white shadow-lg backdrop-blur">
          <span className="text-base font-extrabold tabular-nums">{range(min, max)}</span>
          <span className="text-right text-[11px] text-white/70">
            이벤트 적용 시 <b className="font-bold tabular-nums text-violet-300">{finalRange}</b>
          </span>
        </div>
      </div>
        </div>
      ) : (
        <ConsultEstimate site={site} />
      )}
    </div>
  )
}

/* 일반 웹사이트·프리미엄 — 고를 기능 없이 기본 제공 범위와 시작가만 보여 준다 */
function ConsultEstimate({ site }: { site: (typeof SITE_KINDS)[number] }) {
  /* 사례 게재 할인은 웹사이트에만 있다(홈 가격 카드와 같다) */
  const discount = site.id === 'website' ? WEBSITE_PRICE.caseDiscount : 0

  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start lg:gap-8">
      <div className="rounded-2xl border border-violet-200 bg-violet-50/60 p-6 md:p-7">
        <p className="text-[15px] font-bold text-neutral-900">{site.label}</p>
        <p className="mt-1 text-[13px] text-neutral-500">{site.tagline}</p>

        <p className="mt-6 text-xs font-semibold text-violet-700">기본 제공</p>
        <ul className="mt-2.5 space-y-2">
          {site.includes?.map((t) => {
            const { title, note } = typeof t === 'string' ? { title: t, note: null } : t
            return (
              <li key={title} className="flex items-start gap-2.5 text-[14px] leading-relaxed text-neutral-800">
                <span
                  aria-hidden
                  className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-violet-600 text-[11px] font-bold text-white"
                >
                  ✓
                </span>
                <span>
                  {title}
                  {note && <span className="mt-0.5 block text-[11.5px] text-neutral-400">{note}</span>}
                </span>
              </li>
            )
          })}
        </ul>

        {site.closing && (
          <p className="mt-6 border-t border-violet-200 pt-5 text-[13px] leading-relaxed text-neutral-600">{site.closing}</p>
        )}
      </div>

      <aside aria-label="예상 견적" className="lg:sticky lg:top-20">
        <div className="rounded-3xl bg-[#19172a] p-6 text-white shadow-[0_20px_50px_-25px_rgb(25_23_42/0.7)] md:p-7">
          <p className="text-[11px] font-semibold tracking-[0.18em] text-violet-300">ESTIMATE</p>
          <p className="mt-2 text-lg font-bold">예상 견적</p>

          <div className="mt-5 border-t border-white/10 pt-5">
            <p className="text-sm text-white/70">{site.label}</p>
            <p className="mt-1 text-[1.9rem] font-extrabold leading-tight tracking-tight tabular-nums text-white">
              {won(site.price)}~
              <sup className="ml-1 align-super text-[10.5px] font-medium tracking-normal text-white/50">VAT 별도</sup>
            </p>
          </div>

          {discount > 0 && (
            <div className="mt-4 rounded-xl bg-violet-500/15 px-3.5 py-3 ring-1 ring-inset ring-violet-400/30">
              <p className="flex items-start gap-1.5 text-[11.5px] font-semibold leading-snug text-violet-200">
                <span aria-hidden className="text-orange-300">✦</span>
                {ESTIMATE_EVENT_LABEL}
              </p>
              <p className="mt-1.5 text-sm text-white/80">
                <b className="font-extrabold tabular-nums text-violet-300">{won(site.price - discount)}~</b>
              </p>
              <p className="mt-0.5 text-[11px] text-white/45">사례 게재 동의조건</p>
            </div>
          )}

          <AboutInquiryButton
            category={ABOUT_INQUIRY_CATEGORY}
            product={site.inquiryLabel}
            className="mt-5 w-full bg-violet-500 text-white hover:bg-violet-400"
          />
        </div>
      </aside>
    </div>
  )
}

function priceText(a: AddOn) {
  if (a.maxPrice) return `${manwon(a.price)}~${manwon(a.maxPrice)}`
  return `${won(a.price)}${a.startingAt ? '~' : ''}`
}

/* 모바일에서는 한 줄(체크·이름·금액)만 보이고 설명·사진은 ⌄ 를 눌러야 펼쳐진다 —
   카드를 다 펼쳐 두면 일곱 개를 고르는 데 화면 두 장 넘게 내려야 했다.
   sm 이상은 예전처럼 모두 펼쳐 둔다. */
function AddOnCard({ item, checked, onToggle }: { item: AddOn; checked: boolean; onToggle: () => void }) {
  const wide = item.id === 'cms'
  const [open, setOpen] = useState(false)
  const fold = open ? '' : 'max-sm:hidden'
  return (
    <label
      className={`group relative flex cursor-pointer flex-col rounded-2xl border bg-white px-4 py-3 transition sm:p-5 hover:border-violet-300 has-checked:border-violet-500 has-checked:shadow-[0_0_0_3px_rgb(139_92_246/0.15)] has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-violet-500 ${
        wide ? 'sm:col-span-2' : ''
      } ${checked ? 'border-violet-500' : 'border-neutral-200'}`}
    >
      <input type="checkbox" checked={checked} onChange={onToggle} className="sr-only" />
      <div className={wide ? 'gap-5 sm:grid sm:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]' : ''}>
        <div>
          <div className="flex items-center justify-between gap-3 sm:items-start">
            <div className="flex min-w-0 items-center gap-2.5 sm:items-start">
              <span
                aria-hidden
                className={`flex size-5 shrink-0 items-center justify-center rounded-md border text-[11px] font-bold transition sm:mt-0.5 ${
                  checked ? 'border-violet-600 bg-violet-600 text-white' : 'border-neutral-300 bg-white text-transparent'
                }`}
              >
                ✓
              </span>
              <span className="text-[15px] font-bold leading-snug break-keep text-neutral-900">{item.title}</span>
            </div>
            <div className="flex shrink-0 items-center gap-0.5">
              <span className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-bold tabular-nums text-violet-700">
                +{item.maxPrice ? `${manwon(item.price)}~${manwon(item.maxPrice)}` : `${manwon(item.price)}${item.startingAt ? '~' : ''}`}
              </span>
              {/* 펼치기 — label 안의 버튼이라 체크가 함께 바뀌지 않게 막는다 */}
              <button
                type="button"
                aria-expanded={open}
                aria-label={`${item.title} 설명 ${open ? '접기' : '보기'}`}
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setOpen((o) => !o)
                }}
                className="-mr-2 flex size-9 items-center justify-center rounded-full text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700 sm:hidden"
              >
                <svg aria-hidden viewBox="0 0 20 20" className={`size-4 transition-transform ${open ? 'rotate-180' : ''}`}>
                  <path d="M5 7.5l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          </div>
          <div className={fold}>
            <p className="mt-2.5 pl-7.5 text-[13px] leading-relaxed text-neutral-600">{item.summary}</p>
            {item.points && (
              <ul className="mt-3 flex flex-wrap gap-1.5 pl-7.5">
                {item.points.map((p) => (
                  <li key={p} className="rounded-md bg-neutral-100 px-2 py-1 text-[11.5px] font-medium text-neutral-600">
                    {p}
                  </li>
                ))}
              </ul>
            )}
            {item.note && (
              <p className="mt-3 pl-7.5 text-[11.5px] leading-relaxed text-neutral-400">{item.note}</p>
            )}
          </div>
        </div>

        {/* 관리자페이지가 무엇을 바꾸는지 — 샘플 사이트의 실제 구간을 보여 준다 */}
        {wide && (
          <figure className={`mt-4 mb-1 sm:mt-0 sm:mb-0 ${fold}`}>
            <div className="relative overflow-hidden rounded-xl ring-1 ring-black/5">
              <Image src={worksShot} alt="샘플 사이트의 02 — SELECTED WORKS 구간" placeholder="blur" sizes="(min-width: 1024px) 320px, 90vw" className="block h-auto w-full" />
              <span className="absolute left-2 top-2 rounded-md bg-violet-600/90 px-2 py-1 text-[10.5px] font-bold text-white">관리자에서 수정 가능</span>
            </div>
            <figcaption className="mt-2 text-[11.5px] leading-relaxed text-neutral-500">
              예) 샘플 사이트의 <b className="font-semibold text-neutral-700">02 — SELECTED WORKS</b> 작업 사진·카테고리·소개 글을 직접 바꿉니다.
            </figcaption>
          </figure>
        )}
      </div>
    </label>
  )
}
