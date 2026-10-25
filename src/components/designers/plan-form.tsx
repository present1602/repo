'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { AdminDesigner } from '@/lib/designer-shape'
import {
  PREMIUM_PRICES,
  designPriceOptions,
  formatPrice,
  formatPriceRange,
  type PlanCopy,
} from '@/lib/plans'
import { updatePlans } from '@/app/studio/actions'

/* 디자이너가 플랜 금액을 고르는 화면.

   금액은 정해진 보기 중에서만 고른다 — 자유 입력이 아니다.
   이름·설명은 전역 설정이라 여기서 바꿀 수 없고, 보여주기만 한다. */
export function PlanForm({ designer: d, copy }: { designer: AdminDesigner; copy: PlanCopy }) {
  const [designPrice, setDesignPrice] = useState(d.design_price)
  const [premiumPrice, setPremiumPrice] = useState(d.premium_price)
  const [premiumEnabled, setPremiumEnabled] = useState(d.premium_enabled)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [pending, start] = useTransition()
  const router = useRouter()

  /* 상한보다 높은 시작가는 고를 수 없다 — 범위가 뒤집힌다.
     어드민이 상한을 99,000 이상으로 올려 두면 99,000원도 보기에 들어온다. */
  const startOptions = designPriceOptions(d.price_max)

  const dirty =
    designPrice !== d.design_price ||
    premiumPrice !== d.premium_price ||
    premiumEnabled !== d.premium_enabled

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setMsg(null)
    start(async () => {
      const r = await updatePlans({ designPrice, premiumPrice, premiumEnabled })
      if (!r.ok) {
        setMsg({ ok: false, text: r.error })
        return
      }
      setMsg({ ok: true, text: '저장했습니다.' })
      router.refresh()
    })
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      {msg && (
        <p
          className={`rounded-lg px-3 py-2.5 text-sm ${
            msg.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'
          }`}
        >
          {msg.text}
        </p>
      )}

      <div>
        <h2 className="text-sm font-semibold">가격 플랜</h2>
        <p className="mt-1 text-xs text-neutral-500">
          공개 프로필에 보이는 금액입니다. 플랜 이름과 설명은 모든 디자이너가 함께 쓰므로
          변경할 수 없습니다.
        </p>
      </div>

      {/* 디자인 플랜 — 필수라 끄는 스위치가 없다.

          공개 화면에는 "시작가 ~ 상한" 범위로 나간다. 시작가만 고르고
          상한은 어드민이 정한다(016_price_range.sql). */}
      <section>
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">{copy.design_plan_name}</h3>
          <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[11px] text-neutral-500">
            항상 노출
          </span>
        </div>
        <p className="mt-1 text-xs leading-relaxed text-neutral-500">{copy.design_plan_desc}</p>

        <div className="mt-3.5 flex flex-wrap items-end gap-3">
          <label className="min-w-0">
            <span className="mb-1.5 block text-xs font-medium text-neutral-600">시작가</span>
            <select
              value={designPrice}
              onChange={(e) => setDesignPrice(Number(e.target.value))}
              className="h-10 rounded-lg border border-neutral-300 bg-white px-3 text-sm outline-none ring-violet-500 focus:ring-2"
            >
              {startOptions.map((p) => (
                <option key={p} value={p}>
                  {formatPrice(p)}
                </option>
              ))}
            </select>
          </label>

          <span className="pb-2.5 text-neutral-400">~</span>

          <div className="min-w-0">
            <span className="mb-1.5 block text-xs font-medium text-neutral-600">
              상한 <span className="font-normal text-neutral-400">(관리자 설정)</span>
            </span>
            {/* 고칠 수 없는 값이라 입력칸처럼 보이되 눌리지 않게 둔다 */}
            <p className="flex h-10 items-center rounded-lg bg-neutral-100 px-3 text-sm font-medium text-neutral-500">
              {formatPrice(d.price_max)}
            </p>
          </div>
        </div>

        <p className="mt-2.5 text-xs leading-relaxed text-neutral-400">
          공개 프로필에는 <b className="font-medium text-neutral-600">
            {formatPriceRange(designPrice, d.price_max)}
          </b>{' '}
          으로 보입니다. 상한을 올리려면 관리자에게 문의해 주세요.
        </p>
      </section>

      <hr className="border-neutral-200" />

      {/* 프리미엄 — 본인이 끌 수 있다 */}
      <PlanSection
        name={copy.premium_plan_name}
        desc={copy.premium_plan_desc}
        prices={PREMIUM_PRICES}
        value={premiumPrice}
        onChange={setPremiumPrice}
        enabled={premiumEnabled}
        onToggle={setPremiumEnabled}
      />

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={pending || !dirty}
          className="rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-600 disabled:opacity-40"
        >
          {pending ? '저장 중…' : '저장'}
        </button>
        {dirty && !pending && (
          <span className="text-xs text-neutral-400">저장하지 않은 변경이 있습니다</span>
        )}
      </div>
    </form>
  )
}

/* 플랜 한 구획. onToggle 이 있으면 켜고 끌 수 있는 플랜이다.
   구획 사이는 테두리 대신 divider 로 가른다. */
function PlanSection({
  name,
  desc,
  prices,
  value,
  onChange,
  enabled,
  onToggle,
}: {
  name: string
  desc: string
  prices: readonly number[]
  value: number
  onChange: (n: number) => void
  enabled?: boolean
  onToggle?: (b: boolean) => void
}) {
  const optional = onToggle !== undefined
  /* 끈 플랜은 금액을 고를 이유가 없다 — 흐리게 하고 입력을 막는다 */
  const off = optional && !enabled

  return (
    <section>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold">{name}</h3>
            {optional ? (
              <span
                className={`rounded px-1.5 py-0.5 text-[11px] ${
                  enabled ? 'bg-emerald-100 text-emerald-800' : 'bg-neutral-200 text-neutral-600'
                }`}
              >
                {enabled ? '노출' : '숨김'}
              </span>
            ) : (
              <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[11px] text-neutral-500">
                항상 노출
              </span>
            )}
          </div>
          <p className="mt-1 text-xs leading-relaxed text-neutral-500">{desc}</p>
        </div>

        {optional && (
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            aria-label={`${name} 노출`}
            onClick={() => onToggle(!enabled)}
            className={`relative h-6 w-11 shrink-0 rounded-full transition ${
              enabled ? 'bg-emerald-500' : 'bg-neutral-300'
            }`}
          >
            <span
              className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-all ${
                enabled ? 'left-[22px]' : 'left-0.5'
              }`}
            />
          </button>
        )}
      </div>

      <div className={`mt-3.5 ${off ? 'pointer-events-none opacity-40' : ''}`}>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {prices.map((p) => {
            const on = p === value
            return (
              <button
                key={p}
                type="button"
                aria-pressed={on}
                disabled={off}
                onClick={() => onChange(p)}
                className={`rounded-lg border px-2 py-2.5 text-sm font-medium transition ${
                  on
                    ? 'border-neutral-900 bg-neutral-900 text-white'
                    : 'border-neutral-300 text-neutral-700 hover:bg-neutral-100'
                }`}
              >
                {formatPrice(p)}
              </button>
            )
          })}
        </div>
      </div>
    </section>
  )
}
