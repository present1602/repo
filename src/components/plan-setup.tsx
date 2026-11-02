'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  MAX_OPTION_N,
  MAX_PLAN_DURATION,
  needsN,
  optionText,
  slotOf,
  templateAllows,
  type DesignerPlanDetails,
  type DesignerPlanOptions,
  type OptionTemplate,
  type PlanCopies,
  type PlanTier,
  type RegisteredOption,
} from '@/lib/plans'
import type { Scope } from '@/lib/scopes'
import { setDesignerPlanSetup } from '@/app/admin/designers/actions'
import { setMyPlanOptions } from '@/app/studio/actions'

/* 등록할 수 있는 플랜 하나 — 부모가 정한다(받는 유형, 켜진 프리미엄) */
export type SetupSlot = { scope: Scope; tier: PlanTier }

/* 화면에서 고치는 값 — picks 에 있으면 체크한 것, 값은 숫자 칸의 글자 */
type Draft = { duration: string; picks: Record<string, string> }

/* 플랜마다 포함 항목을 등록하는 화면(037_plan_details.sql).

   어드민이 만든 템플릿 중 그 플랜에서 고를 수 있는 것을 체크하고, {n} 이 있으면
   숫자까지 넣어 저장해야 공개 화면에 나간다. 처음에는 아무것도 체크돼 있지 않다.

   어드민(디자이너 상세)과 디자이너(스튜디오)가 함께 쓴다. 작업 기간은 어드민만
   고친다 — mode 가 admin 일 때만 칸이 보인다. */
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
    picks: Object.fromEntries(
      (registered[slotOf(s.scope, s.tier)] ?? []).map((r) => [r.templateId, r.n == null ? '' : String(r.n)]),
    ),
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

    /* 숫자가 필요한데 비었으면 저장하지 않는다 — 등록돼도 나가지 않는 항목이 된다 */
    const options: RegisteredOption[] = []
    for (const t of templates) {
      if (!(t.id in cur.picks)) continue
      const raw = cur.picks[t.id].trim()
      if (needsN(t.template)) {
        const n = Number(raw)
        if (!raw || !Number.isInteger(n) || n < 0 || n > MAX_OPTION_N) {
          setMsg({ ok: false, text: `'${t.template}'의 숫자를 0~${MAX_OPTION_N} 사이로 적어 주세요.` })
          return
        }
        options.push({ templateId: t.id, n })
      } else {
        options.push({ templateId: t.id, n: null })
      }
    }

    if (!window.confirm(`${nameOf(s)}의 ${mode === 'admin' ? '작업 기간·' : ''}포함 항목을 저장할까요?`)) return

    setMsg(null)
    start(async () => {
      const r =
        mode === 'admin'
          ? await setDesignerPlanSetup(designerId, s.scope, s.tier, {
              duration: cur.duration.trim() || null,
              options,
            })
          : await setMyPlanOptions(s.scope, s.tier, options)
      if (!r.ok) {
        setMsg({ ok: false, text: r.error })
        return
      }
      setMsg({ ok: true, text: `${nameOf(s)}을(를) 저장했습니다.` })
      router.refresh()
    })
  }

  return (
    <section className="rounded-xl bg-white p-5 ring-1 ring-neutral-200">
      <h2 className="text-sm font-semibold">
        {mode === 'admin' ? '작업 기간 · 포함 항목' : '포함 항목'}
      </h2>
      <p className="mt-1 text-xs leading-relaxed text-neutral-500">
        플랜마다 보여줄 항목을 고르고 숫자를 넣어 저장하세요. 저장한 항목만 공개 페이지의 의뢰 패널에
        나갑니다.
        {mode === 'admin' && ' 작업 기간을 비워 두면 설정의 전체 공통값(회색 글씨)을 따릅니다.'}
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

              <div className="mt-2.5 space-y-1.5">
                {usable.length === 0 && (
                  <p className="text-[11px] text-neutral-400">이 플랜에서 고를 수 있는 항목이 없습니다.</p>
                )}
                {usable.map((t) => {
                  const on = t.id in cur.picks
                  const [before, ...rest] = t.template.split('{n}')
                  return (
                    <div key={t.id} className="flex flex-wrap items-center gap-1.5 text-xs text-neutral-700">
                      <input
                        type="checkbox"
                        checked={on}
                        aria-label={optionText(t.template, null)}
                        onChange={(e) => {
                          const picks = { ...cur.picks }
                          if (e.target.checked) picks[t.id] = ''
                          else delete picks[t.id]
                          set({ ...cur, picks })
                        }}
                        className="accent-violet-600"
                      />
                      {needsN(t.template) ? (
                        <>
                          <span>{before}</span>
                          <input
                            type="number"
                            inputMode="numeric"
                            aria-label={`${t.template} 숫자`}
                            value={cur.picks[t.id] ?? ''}
                            disabled={!on}
                            onChange={(e) => set({ ...cur, picks: { ...cur.picks, [t.id]: e.target.value } })}
                            min={0}
                            max={MAX_OPTION_N}
                            placeholder="n"
                            className="h-7 w-14 rounded-md border border-neutral-300 bg-white px-2 text-xs outline-none ring-violet-500 focus:ring-2 disabled:bg-neutral-50"
                          />
                          <span>{rest.join('{n}')}</span>
                        </>
                      ) : (
                        <span>{t.template}</span>
                      )}
                      {/* 어드민이 이 디자이너에게만 만들어 준 항목 */}
                      {t.designerId && (
                        <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                          전용
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>

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
