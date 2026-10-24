'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { MAX_PLAN_DESC, DESIGN_PRICES, PREMIUM_PRICES, formatPrice, type PlanCopy } from '@/lib/plans'
import { updatePlanCopy } from '@/app/admin/settings/actions'

/* 플랜 이름·설명은 모든 디자이너가 함께 쓴다 — 여기서 한 번 고치면 전체에 반영된다.
   금액은 디자이너가 각자 고르므로 여기서는 보기만 보여준다. */
export function PlanCopyForm({ copy }: { copy: PlanCopy }) {
  const [designName, setDesignName] = useState(copy.design_plan_name)
  const [designDesc, setDesignDesc] = useState(copy.design_plan_desc)
  const [premiumName, setPremiumName] = useState(copy.premium_plan_name)
  const [premiumDesc, setPremiumDesc] = useState(copy.premium_plan_desc)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [pending, start] = useTransition()
  const router = useRouter()

  const dirty =
    designName !== copy.design_plan_name ||
    designDesc !== copy.design_plan_desc ||
    premiumName !== copy.premium_plan_name ||
    premiumDesc !== copy.premium_plan_desc

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setMsg(null)
    start(async () => {
      const r = await updatePlanCopy({ designName, designDesc, premiumName, premiumDesc })
      if (!r.ok) {
        setMsg({ ok: false, text: r.error })
        return
      }
      setMsg({ ok: true, text: '저장했습니다. 모든 디자이너의 공개 페이지에 반영됩니다.' })
      router.refresh()
    })
  }

  return (
    <form onSubmit={submit} className="rounded-xl bg-white p-5 ring-1 ring-neutral-200">
      <h2 className="text-sm font-semibold">가격 플랜 문구</h2>
      <p className="mt-1 text-xs text-neutral-500">
        금액은 디자이너가 각자 고릅니다. 여기서는 이름과 설명만 정합니다.
      </p>

      {msg && (
        <p
          className={`mt-4 rounded-lg px-3 py-2.5 text-sm ${
            msg.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'
          }`}
        >
          {msg.text}
        </p>
      )}

      <div className="mt-4 space-y-5">
        <PlanFields
          label="디자인 플랜"
          note="모든 디자이너에게 반드시 노출됩니다"
          prices={DESIGN_PRICES}
          name={designName}
          desc={designDesc}
          onName={setDesignName}
          onDesc={setDesignDesc}
        />
        <PlanFields
          label="프리미엄 플랜"
          note="디자이너가 켜고 끌 수 있습니다"
          prices={PREMIUM_PRICES}
          name={premiumName}
          desc={premiumDesc}
          onName={setPremiumName}
          onDesc={setPremiumDesc}
        />
      </div>

      <div className="mt-5 flex items-center gap-2">
        <button
          type="submit"
          disabled={pending || !dirty}
          className="rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-600 disabled:opacity-40"
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

function PlanFields({
  label,
  note,
  prices,
  name,
  desc,
  onName,
  onDesc,
}: {
  label: string
  note: string
  prices: readonly number[]
  name: string
  desc: string
  onName: (s: string) => void
  onDesc: (s: string) => void
}) {
  return (
    <div className="rounded-lg border border-neutral-200 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-xs font-semibold text-neutral-700">{label}</h3>
        <span className="text-[11px] text-neutral-400">{note}</span>
      </div>

      <label className="mt-3 block">
        <span className="mb-1.5 block text-xs font-medium text-neutral-600">이름</span>
        <input
          value={name}
          onChange={(e) => onName(e.target.value)}
          required
          className="h-9 w-full rounded-lg border border-neutral-300 px-3 text-sm outline-none ring-indigo-500 focus:ring-2"
        />
      </label>

      <label className="mt-3 block">
        <span className="mb-1.5 flex items-baseline justify-between text-xs font-medium text-neutral-600">
          설명
          <span className="font-normal text-neutral-400">
            {desc.length} / {MAX_PLAN_DESC}
          </span>
        </span>
        <textarea
          value={desc}
          onChange={(e) => onDesc(e.target.value)}
          rows={3}
          maxLength={MAX_PLAN_DESC}
          className="w-full resize-y rounded-lg border border-neutral-300 px-3 py-2 text-sm leading-relaxed outline-none ring-indigo-500 focus:ring-2"
        />
      </label>

      {/* 금액은 여기서 못 고치지만, 어떤 보기가 있는지는 알아야 문구를 맞출 수 있다 */}
      <p className="mt-2.5 text-[11px] text-neutral-400">
        선택 가능 금액: {prices.map(formatPrice).join(' · ')}
      </p>
    </div>
  )
}
