'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  MAX_PLAN_DURATION,
  slotOf,
  templateAllows,
  type DesignerPlanDetails,
  type DesignerPlanOptions,
  type OptionTemplate,
  type PlanCopies,
  type PlanTier,
} from '@/lib/plans'
import type { Scope } from '@/lib/scopes'
import { setDesignerPlanSetup } from '@/app/admin/designers/actions'
import { setMyPlanOptions } from '@/app/studio/actions'
import { OptionChecklist, optionsOf, picksOf, type Picks } from './option-setup'

/* 등록할 수 있는 플랜 하나 — 부모가 정한다(받는 유형, 켜진 프리미엄) */
export type SetupSlot = { scope: Scope; tier: PlanTier }

/* 화면에서 고치는 값 — picks 에 있으면 체크한 것, 값은 숫자 칸의 글자 */
type Draft = { duration: string; picks: Picks }

/* 플랜마다 작업 기간과 프리미엄 포함 항목을 등록하는 화면(037_plan_details.sql).

   기본 단계 포함 항목은 0004 부터 공통·분야별 목록(option-setup.tsx)이 맡는다 —
   여기서는 프리미엄 단계만 항목을 고른다. {n} 이 있으면 숫자까지 넣어 저장해야 공개 화면에 나간다.

   어드민(디자이너 상세)과 디자이너(스튜디오)가 함께 쓴다. 작업 기간은 어드민만
   고친다 — mode 가 admin 일 때만 칸이 보인다. 디자이너 화면은 켜진 프리미엄이 없으면 그리지 않는다. */
export function PlanSetup({
  mode,
  designerId,
  slots,
  copies,
  templates,
  registered,
  details,
}: {
  mode: 'admin' | 'designer'
  designerId: string
  slots: SetupSlot[]
  copies: PlanCopies
  templates: OptionTemplate[]
  registered: DesignerPlanOptions
  /* 디자이너별 작업 기간 — 어드민 화면에서만 */
  details?: DesignerPlanDetails
}) {
  const savedOf = (s: SetupSlot): Draft => ({
    duration: details?.[s.scope]?.[s.tier]?.duration ?? '',
    picks: s.tier === 'premium' ? picksOf(registered[slotOf(s.scope, s.tier)]) : {},
  })

  const [draft, setDraft] = useState<Record<string, Draft>>(() =>
    Object.fromEntries(slots.map((s) => [slotOf(s.scope, s.tier), savedOf(s)])),
  )
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [pending, start] = useTransition()
  const router = useRouter()

  const nameOf = (s: SetupSlot) =>
    s.tier === 'premium' ? `${copies[s.scope].premium.name}` : copies[s.scope].basic.name

  const save = (s: SetupSlot) => {
    const key = slotOf(s.scope, s.tier)
    const cur = draft[key]
    /* 기본 단계 포함 항목은 공통·분야별 목록(option-setup.tsx)이 맡는다 — 여기서는 작업 기간만 */
    const withOptions = s.tier === 'premium'

    const options = withOptions
      ? optionsOf(templates.filter((t) => templateAllows(t, key)), cur.picks)
      : null
    if (typeof options === 'string') {
      setMsg({ ok: false, text: options })
      return
    }

    const what = [mode === 'admin' && '작업 기간', withOptions && '포함 항목'].filter(Boolean).join('·')
    if (!window.confirm(`${nameOf(s)}의 ${what}을 저장할까요?`)) return

    setMsg(null)
    start(async () => {
      const r =
        mode === 'admin'
          ? await setDesignerPlanSetup(designerId, s.scope, s.tier, {
              duration: cur.duration.trim() || null,
              options,
            })
          : await setMyPlanOptions(s.scope, s.tier, options ?? [])
      if (!r.ok) {
        setMsg({ ok: false, text: r.error })
        return
      }
      setMsg({ ok: true, text: `${nameOf(s)}을(를) 저장했습니다.` })
      router.refresh()
    })
  }

  if (mode === 'designer' && slots.length === 0) return null

  return (
    <section className="rounded-xl bg-white p-5 ring-1 ring-neutral-200">
      <h2 className="text-sm font-semibold">
        {mode === 'admin' ? '작업 기간 · 프리미엄 포함 항목' : '프리미엄 포함 항목'}
      </h2>
      <p className="mt-1 text-xs leading-relaxed text-neutral-500">
        {mode === 'admin'
          ? '플랜마다 작업 기간을 정합니다. 비워 두면 설정의 전체 공통값(회색 글씨)을 따릅니다. 프리미엄은 포함 항목도 여기서 고릅니다.'
          : '켜진 프리미엄 플랜에 보여줄 항목을 고르고 숫자를 넣어 저장하세요.'}
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

      {slots.length === 0 && (
        <p className="mt-4 rounded-lg border border-dashed border-neutral-300 py-6 text-center text-xs text-neutral-400">
          받는 의뢰 유형이 없습니다.
        </p>
      )}

      <div className="mt-4 space-y-3">
        {slots.map((s) => {
          const key = slotOf(s.scope, s.tier)
          const cur = draft[key] ?? savedOf(s)
          const saved = savedOf(s)
          const dirty = JSON.stringify(cur) !== JSON.stringify(saved)
          const usable = templates.filter((t) => templateAllows(t, key))
          const set = (next: Draft) => setDraft((d) => ({ ...d, [key]: next }))

          return (
            <div key={key} className="rounded-lg border border-neutral-200 p-3.5">
              <div className="flex items-center gap-2">
                {s.tier === 'premium' && (
                  <span className="rounded bg-violet-700 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-white">
                    PREMIUM
                  </span>
                )}
                <h3 className="text-xs font-semibold text-neutral-800">{nameOf(s)}</h3>
              </div>

              {mode === 'admin' && (
                <label className="mt-2.5 flex items-center gap-2 text-xs text-neutral-600">
                  <span className="shrink-0">작업 기간</span>
                  <input
                    value={cur.duration}
                    onChange={(e) => set({ ...cur, duration: e.target.value })}
                    maxLength={MAX_PLAN_DURATION}
                    placeholder={copies[s.scope][s.tier].duration || '없음'}
                    className="h-8 min-w-0 flex-1 rounded-md border border-neutral-300 bg-white px-2.5 text-xs outline-none ring-violet-500 focus:ring-2"
                  />
                </label>
              )}

              {s.tier === 'premium' && (
                <div className="mt-2.5">
                  <OptionChecklist usable={usable} picks={cur.picks} onChange={(picks) => set({ ...cur, picks })} />
                </div>
              )}

              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  disabled={pending || !dirty}
                  onClick={() => save(s)}
                  className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-violet-600 disabled:opacity-40"
                >
                  {pending ? '저장 중…' : '저장'}
                </button>
                {dirty && !pending && (
                  <span className="text-[11px] text-neutral-400">저장하지 않은 변경이 있습니다</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
