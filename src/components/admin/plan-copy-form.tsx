'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  MAX_PLAN_DESC,
  MAX_PLAN_NAME,
  PLAN_TIERS,
  type PlanCopies,
  type PlanText,
  type PlanTier,
} from '@/lib/plans'
import { SCOPES, SCOPE_LABELS, type Scope } from '@/lib/scopes'
import { updatePlanCopies } from '@/app/admin/settings/actions'

/* 금액을 누가 정하는지 — 문구를 맞출 때 참고하라고 각 유형 옆에 적는다 */
const PRICE_NOTES: Record<Scope, string> = {
  sample: '금액: 디자이너가 고름',
  logo: '금액: 디자이너가 고름',
  full_design: '금액: 어드민이 디자이너마다 정함',
  with_dev: '금액: 어드민이 디자이너마다 정함',
}

const TIER_LABELS: Record<PlanTier, string> = { basic: '기본', premium: '프리미엄' }

/* 플랜 이름·설명은 모든 디자이너가 함께 쓴다 — 여기서 한 번 고치면 전체에 반영된다.
   의뢰 유형 넷이 같은 모양이다.

   프리미엄은 유형마다 켜고 끈다. 켜야 디자이너 화면에서 디자이너별로 켜고
   금액을 넣을 수 있고, 둘 다 켜져야 공개 화면에 나간다. */
export function PlanCopyForm({ copies }: { copies: PlanCopies }) {
  const [draft, setDraft] = useState(copies)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [pending, start] = useTransition()
  const router = useRouter()

  const dirty = JSON.stringify(draft) !== JSON.stringify(copies)

  const edit = (plan: Scope, tier: PlanTier, patch: Partial<PlanText>) =>
    setDraft((d) => ({
      ...d,
      [plan]:
        tier === 'basic'
          ? { ...d[plan], basic: { ...d[plan].basic, ...patch } }
          : { ...d[plan], premium: { ...d[plan].premium, ...patch } },
    }))

  const setPremiumOn = (plan: Scope, enabled: boolean) =>
    setDraft((d) => ({ ...d, [plan]: { ...d[plan], premium: { ...d[plan].premium, enabled } } }))

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setMsg(null)
    start(async () => {
      const r = await updatePlanCopies(draft)
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
      <p className="mt-1 text-xs leading-relaxed text-neutral-500">
        의뢰 유형마다 기본과 프리미엄의 이름·설명을 정합니다. 디자이너 상세의 플랜 카드에 나갑니다.
        <br />
        프리미엄을 켠 유형만 디자이너별로 프리미엄을 켜고 금액을 넣을 수 있습니다.
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
        {SCOPES.map((plan) => (
          <div key={plan} className="rounded-lg border border-neutral-200 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <h3 className="text-xs font-semibold text-neutral-700">{SCOPE_LABELS[plan]}</h3>
                <span className="text-[11px] text-neutral-400">{PRICE_NOTES[plan]}</span>
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-neutral-600">
                프리미엄
                <input
                  type="checkbox"
                  role="switch"
                  checked={draft[plan].premium.enabled}
                  onChange={(e) => setPremiumOn(plan, e.target.checked)}
                  className="size-4 accent-violet-600"
                />
                <span className={draft[plan].premium.enabled ? 'text-violet-700' : 'text-neutral-400'}>
                  {draft[plan].premium.enabled ? '켜짐' : '꺼짐'}
                </span>
              </label>
            </div>

            <div className="mt-3 grid gap-4 md:grid-cols-2">
              {PLAN_TIERS.map((tier) => (
                <TierFields
                  key={tier}
                  label={TIER_LABELS[tier]}
                  /* 꺼 둔 프리미엄도 문구는 미리 넣어 둘 수 있다 — 흐리게만 보인다 */
                  muted={tier === 'premium' && !draft[plan].premium.enabled}
                  value={draft[plan][tier]}
                  onChange={(patch) => edit(plan, tier, patch)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 flex items-center gap-2">
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

function TierFields({
  label,
  muted,
  value,
  onChange,
}: {
  label: string
  /* 꺼 둔 프리미엄 — 공개 화면에 나가지 않는다는 표시 */
  muted?: boolean
  value: PlanText
  onChange: (patch: Partial<PlanText>) => void
}) {
  return (
    <div className={muted ? 'opacity-50' : ''}>
      <p className="flex items-center gap-1.5 text-[11px] font-semibold text-neutral-500">
        {label}
        {muted && (
          <span className="rounded bg-neutral-100 px-1.5 py-0.5 font-normal text-neutral-500">
            꺼짐
          </span>
        )}
      </p>

      <label className="mt-2 block">
        <span className="mb-1.5 block text-xs font-medium text-neutral-600">이름</span>
        <input
          value={value.name}
          onChange={(e) => onChange({ name: e.target.value })}
          required
          maxLength={MAX_PLAN_NAME}
          className="h-9 w-full rounded-lg border border-neutral-300 px-3 text-sm outline-none ring-violet-500 focus:ring-2"
        />
      </label>

      <label className="mt-3 block">
        <span className="mb-1.5 flex items-baseline justify-between text-xs font-medium text-neutral-600">
          설명
          <span className="font-normal text-neutral-400">
            {value.desc.length} / {MAX_PLAN_DESC}
          </span>
        </span>
        <textarea
          value={value.desc}
          onChange={(e) => onChange({ desc: e.target.value })}
          rows={3}
          maxLength={MAX_PLAN_DESC}
          className="w-full resize-y rounded-lg border border-neutral-300 px-3 py-2 text-sm leading-relaxed outline-none ring-violet-500 focus:ring-2"
        />
      </label>
    </div>
  )
}
