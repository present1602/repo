'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useActionTransition } from '@/lib/use-action-transition'
import { setDesignerSpecialtyPrice } from '@/app/admin/designers/actions'
import { formatPrice, MIN_CONTRACT_PRICE, MAX_CONTRACT_PRICE } from '@/lib/plans'
import { priceOf, type DesignerSpecialtyPrices, type PriceScope, type PriceTier } from '@/lib/specialty-shape'
import { menuCategories, scopesOf, SCOPE_PLAN, type CategoryMeta } from '@/lib/inquiry-choices'
import type { PlanCopies } from '@/lib/plans'

type Notice = { kind: 'ok' | 'warn' | 'error'; text: string } | null

/* 이 디자이너에게만 적용되는 분야별 시작가(0016_designer_specialty_prices.sql).

   시작가는 세 층이다 — 적힌 것이 위에서부터 이긴다:
     1. 여기(디자이너 × 분야)   이 디자이너의 그 분야만
     2. 설정 → 전문 분야         그 분야를 고른 모든 디자이너
     3. 위 가격 플랜             이 디자이너의 모든 분야

   비워 두면 그 칸은 아래 층으로 내려간다 — placeholder 에 지금 나가는 금액을 적어 둔다.
   저장 버튼이 없다. PlanSummary 와 같이 칸을 벗어나면 바로 저장한다. */
export function DesignerCategoryPrices({
  designerId,
  tags,
  metas,
  copies,
  ownPrices,
  fallback,
  onNotice,
}: {
  designerId: string
  /* 이 디자이너가 고른 분야 — 고른 분야를 앞에 세운다 */
  tags: string[]
  metas: CategoryMeta[]
  copies: PlanCopies
  ownPrices: DesignerSpecialtyPrices
  /* 분야에도 적혀 있지 않을 때 나가는 금액 — 가격 플랜의 디자인 전체·프로젝트 최소가 */
  fallback: Record<PriceScope, number>
  onNotice: (n: Notice) => void
}) {
  /* 고른 분야를 먼저, 그다음 나머지 — 고르지 않은 분야도 미리 적어 둘 수 있다
     (OptionSetup 이 분야별 포함 항목에 쓰는 방침과 같다) */
  const menu = menuCategories(metas)
  const mine = menu.filter((m) => tags.includes(m.name))
  const rest = menu.filter((m) => !tags.includes(m.name))
  const list = [...mine, ...rest]

  return (
    <section className="rounded-xl bg-white p-5 ring-1 ring-neutral-200">
      <h2 className="text-sm font-semibold">분야별 시작가</h2>
      <p className="mt-1 text-xs leading-relaxed text-neutral-500">
        이 디자이너에게만 적용됩니다. 비워 두면 분야 전체 금액이, 그것도 없으면 위 가격 플랜의
        금액이 나갑니다 — 칸 안의 흐린 숫자가 지금 나가는 금액입니다.
      </p>

      {list.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-neutral-300 py-8 text-center text-xs text-neutral-500">
          탐색 메뉴에 나오는 분야가 없습니다.
        </p>
      ) : (
        <div className="mt-4 space-y-4">
          {list.map((m) => {
            const on = tags.includes(m.name)
            /* 메인 시안은 늘 디자이너 가격이라 칸이 없다(categoryPrice) */
            const scopes = scopesOf(m).filter((s): s is PriceScope => s !== 'sample')
            return (
              <div key={m.id} className={on ? '' : 'opacity-60'}>
                <p className="text-xs font-medium text-neutral-700">
                  {m.name}
                  {!on && <span className="ml-1.5 text-[11px] text-neutral-400">· 고르지 않음</span>}
                </p>
                <div className="mt-1.5 space-y-1.5">
                  {scopes.map((scope) => (
                    <Row
                      key={scope}
                      designerId={designerId}
                      meta={m}
                      scope={scope}
                      label={copies[SCOPE_PLAN[scope]].basic.name.trim() || SCOPE_LABEL[scope]}
                      ownPrices={ownPrices}
                      fallback={fallback[scope]}
                      onNotice={onNotice}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

/* 플랜 이름이 비어 있을 때만 쓰는 기본 문구 */
const SCOPE_LABEL: Record<PriceScope, string> = {
  design: '디자인만',
  design_dev: '디자인 + 개발',
}

/* 한 분야 × 한 범위 — 기본과 프리미엄 두 칸 */
function Row({
  designerId,
  meta,
  scope,
  label,
  ownPrices,
  fallback,
  onNotice,
}: {
  designerId: string
  meta: CategoryMeta
  scope: PriceScope
  label: string
  ownPrices: DesignerSpecialtyPrices
  fallback: number
  onNotice: (n: Notice) => void
}) {
  /* 분야에서 프리미엄을 끄면 어느 금액을 적어도 나가지 않는다(categoryPremium) — 칸도 닫는다 */
  const premiumOn = priceOf(meta.prices, scope, 'premium').enabled

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-neutral-500">
      <span className="w-20 shrink-0 font-medium text-neutral-600">{label}</span>
      <Field
        designerId={designerId}
        meta={meta}
        scope={scope}
        tier="basic"
        label={`${meta.name} ${label} 시작가`}
        saved={ownPrices[meta.id]?.[scope]?.basic ?? null}
        /* 비웠을 때 실제로 나가는 금액 — 분야 금액, 없으면 가격 플랜 */
        placeholder={priceOf(meta.prices, scope, 'basic').price ?? fallback}
        onNotice={onNotice}
      />
      <span className="flex shrink-0 items-center gap-x-2">
        <span className={premiumOn ? '' : 'text-neutral-300'}>프리미엄</span>
        <Field
          designerId={designerId}
          meta={meta}
          scope={scope}
          tier="premium"
          label={`${meta.name} ${label} 프리미엄 시작가`}
          saved={ownPrices[meta.id]?.[scope]?.premium ?? null}
          placeholder={priceOf(meta.prices, scope, 'premium').price}
          disabled={!premiumOn}
          onNotice={onNotice}
        />
      </span>
    </div>
  )
}

/* 금액 한 칸 — 벗어나거나 Enter 로 저장하고, 비우면 덮기를 푼다(줄을 지운다).
   specialty-manager.tsx 의 PriceField 와 같은 방식 */
function Field({
  designerId,
  meta,
  scope,
  tier,
  label,
  saved,
  placeholder,
  disabled,
  onNotice,
}: {
  designerId: string
  meta: CategoryMeta
  scope: PriceScope
  tier: PriceTier
  label: string
  saved: number | null
  /* 비웠을 때 나가는 금액 — null 이면 디자이너별 프리미엄으로 넘어간다 */
  placeholder: number | null
  disabled?: boolean
  onNotice: (n: Notice) => void
}) {
  const [text, setText] = useState(saved == null ? '' : String(saved))
  const [pending, start] = useActionTransition()
  const router = useRouter()

  const reset = () => setText(saved == null ? '' : String(saved))

  const save = () => {
    const digits = text.replace(/\D/g, '')
    const next = digits ? Number(digits) : null
    if (next === saved) return

    if (next != null && (next < MIN_CONTRACT_PRICE || next > MAX_CONTRACT_PRICE)) {
      reset()
      onNotice({
        kind: 'error',
        text: `${label}는 ${formatPrice(MIN_CONTRACT_PRICE)} 이상 ${formatPrice(MAX_CONTRACT_PRICE)} 이하로 적어 주세요.`,
      })
      return
    }

    const ask =
      next == null
        ? `${label} 덮어쓰기를 풀까요?\n분야 전체 금액이 다시 나갑니다.`
        : `${label}를 ${formatPrice(next)}으로 바꿀까요?`
    if (!window.confirm(ask)) {
      reset()
      return
    }

    start(async () => {
      onNotice(null)
      const r = await setDesignerSpecialtyPrice(designerId, meta.id, scope, tier, next)
      if (!r.ok) {
        reset()
        onNotice({ kind: 'error', text: r.error })
        return
      }
      router.refresh()
      onNotice({
        kind: 'ok',
        text: next == null ? `${label} 덮어쓰기를 풀었습니다.` : `${label}를 ${formatPrice(next)}으로 바꿨습니다.`,
      })
    })
  }

  return (
    <input
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur()
        if (e.key === 'Escape') reset()
      }}
      disabled={disabled || pending}
      inputMode="numeric"
      aria-label={label}
      placeholder={placeholder == null ? '디자이너 금액' : String(placeholder)}
      className="h-8 w-28 shrink-0 rounded-md border border-neutral-200 bg-white px-2.5 text-xs text-neutral-700 outline-none ring-violet-500 placeholder:text-neutral-400 focus:ring-2 disabled:bg-neutral-50 disabled:opacity-60"
    />
  )
}
