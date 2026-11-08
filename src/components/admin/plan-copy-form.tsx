'use client'

import { useState } from 'react'
import { useActionTransition } from '@/lib/use-action-transition'
import { useRouter } from 'next/navigation'
import {
  MAX_PLAN_DESC,
  MAX_PLAN_DURATION,
  MAX_PLAN_NAME,
  PLAN_TIERS,
  type PlanCopies,
  type PlanTier,
  type PlanTierCopy,
} from '@/lib/plans'
import { SCOPES, SCOPE_LABELS, type Scope } from '@/lib/scopes'
import { updatePlanCopies } from '@/app/admin/settings/actions'
import { Flash } from '@/components/flash'

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

   프리미엄은 여기서 켜고 끄지 않는다 — 이름·설명만 정한다. 켜고 끄기와 금액은
   전문 분야의 범위별 칸(기본 설정)과 디자이너별 프리미엄이 맡는다. */
export function PlanCopyForm({ copies }: { copies: PlanCopies }) {
  const [draft, setDraft] = useState(copies)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [pending, start] = useActionTransition()
  const router = useRouter()

  const dirty = JSON.stringify(draft) !== JSON.stringify(copies)

  const edit = (plan: Scope, tier: PlanTier, patch: Partial<PlanTierCopy>) =>
    setDraft((d) => ({
      ...d,
      [plan]:
        tier === 'basic'
          ? { ...d[plan], basic: { ...d[plan].basic, ...patch } }
          : { ...d[plan], premium: { ...d[plan].premium, ...patch } },
    }))

  const setVisible = (plan: Scope, visible: boolean) =>
    setDraft((d) => ({ ...d, [plan]: { ...d[plan], visible } }))

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
        의뢰 유형마다 기본과 프리미엄의 이름·설명·작업 기간을 정합니다. 디자이너 상세의 의뢰
        패널에 나갑니다. 작업 기간은 디자이너마다 따로 바꿀 수 있습니다.
        <br />
        프리미엄을 켜고 끄는 것과 금액은 기본 설정의 전문 분야(분야·범위별)에서 정합니다.
        <br />
        숨긴 플랜은 공개 화면(상세·의뢰 폼·탐색)과 디자이너 스튜디오에서 빠집니다. 디자이너별
        설정은 남아 있어 다시 노출하면 돌아옵니다.
      </p>

      <Flash msg={msg} onDone={() => setMsg(null)} className="mt-4" />

      <div className="mt-4 space-y-5">
        {SCOPES.map((plan) => (
          <div
            key={plan}
            className={`rounded-lg border p-4 ${
              draft[plan].visible ? 'border-neutral-200' : 'border-dashed border-neutral-300 bg-neutral-50'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <h3 className="text-xs font-semibold text-neutral-700">{SCOPE_LABELS[plan]}</h3>
                <span className="text-[11px] text-neutral-400">{PRICE_NOTES[plan]}</span>
              </div>
              <div className="flex flex-wrap items-center gap-4">
              {/* 노출 — 끄면 이 플랜이 공개 화면 어디에도 나가지 않는다 */}
              <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-neutral-600">
                노출
                <input
                  type="checkbox"
                  role="switch"
                  checked={draft[plan].visible}
                  onChange={(e) => setVisible(plan, e.target.checked)}
                  className="size-4 accent-violet-600"
                />
                <span className={draft[plan].visible ? 'text-violet-700' : 'text-neutral-400'}>
                  {draft[plan].visible ? '노출' : '숨김'}
                </span>
              </label>
              </div>
            </div>

            <div className="mt-3 grid gap-4 md:grid-cols-2">
              {PLAN_TIERS.map((tier) => (
                <TierFields
                  key={tier}
                  label={TIER_LABELS[tier]}
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
  value,
  onChange,
}: {
  label: string
  value: PlanTierCopy
  onChange: (patch: Partial<PlanTierCopy>) => void
}) {
  return (
    <div>
      <p className="flex items-center gap-1.5 text-[11px] font-semibold text-neutral-500">{label}</p>

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

      <label className="mt-3 block">
        <span className="mb-1.5 block text-xs font-medium text-neutral-600">작업 기간</span>
        <input
          value={value.duration}
          onChange={(e) => onChange({ duration: e.target.value })}
          maxLength={MAX_PLAN_DURATION}
          placeholder="예: 3–5일 (비우면 나가지 않음)"
          className="h-9 w-full rounded-lg border border-neutral-300 px-3 text-sm outline-none ring-violet-500 focus:ring-2"
        />
      </label>

    </div>
  )
}
