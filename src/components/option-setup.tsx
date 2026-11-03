'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  COMMON_BUCKET,
  MAX_OPTION_N,
  bucketOf,
  needsN,
  optionText,
  templateAllowsBucket,
  type DesignerOptionSetup,
  type OptionTemplate,
  type OptionsMode,
  type RegisteredOption,
} from '@/lib/plans'
import type { OptionCategory } from '@/lib/inquiry-choices'
import { setDesignerBucketOptions, setDesignerOptionsMode } from '@/app/admin/designers/actions'
import { setMyBucketOptions, setMyOptionsMode } from '@/app/studio/actions'

/* 화면에서 고치는 값 — 있으면 체크한 것, 값은 숫자 칸의 글자 */
export type Picks = Record<string, string>

export function picksOf(registered: RegisteredOption[] | undefined): Picks {
  return Object.fromEntries((registered ?? []).map((r) => [r.templateId, r.n == null ? '' : String(r.n)]))
}

/* 체크한 것을 저장할 모양으로 — 숫자가 필요한데 비었으면 이유(글자)를 돌려준다.
   등록돼도 공개 화면에 나가지 않는 항목이 되기 때문이다. */
export function optionsOf(templates: OptionTemplate[], picks: Picks): RegisteredOption[] | string {
  const out: RegisteredOption[] = []
  for (const t of templates) {
    if (!(t.id in picks)) continue
    if (!needsN(t.template)) {
      out.push({ templateId: t.id, n: null })
      continue
    }
    const raw = picks[t.id].trim()
    const n = Number(raw)
    if (!raw || !Number.isInteger(n) || n < 0 || n > MAX_OPTION_N) {
      return `'${t.template}'의 숫자를 0~${MAX_OPTION_N} 사이로 적어 주세요.`
    }
    out.push({ templateId: t.id, n })
  }
  return out
}

/* 템플릿 체크 목록 — {n} 이 있으면 숫자 칸이 문장 사이에 들어간다 */
export function OptionChecklist({
  usable,
  picks,
  onChange,
  disabled,
}: {
  usable: OptionTemplate[]
  picks: Picks
  onChange: (next: Picks) => void
  disabled?: boolean
}) {
  if (usable.length === 0) {
    return <p className="text-[11px] text-neutral-400">이 플랜에서 고를 수 있는 항목이 없습니다.</p>
  }
  return (
    <div className="space-y-1.5">
      {usable.map((t) => {
        const on = t.id in picks
        const [before, ...rest] = t.template.split('{n}')
        return (
          <div key={t.id} className="flex flex-wrap items-center gap-1.5 text-xs text-neutral-700">
            <input
              type="checkbox"
              checked={on}
              disabled={disabled}
              aria-label={optionText(t.template, null)}
              onChange={(e) => {
                const next = { ...picks }
                if (e.target.checked) next[t.id] = ''
                else delete next[t.id]
                onChange(next)
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
                  value={picks[t.id] ?? ''}
                  disabled={disabled || !on}
                  onChange={(e) => onChange({ ...picks, [t.id]: e.target.value })}
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
  )
}

/* 기본 단계 포함 항목(0004_plan_options_by_category.sql).

   맨 위 라디오로 방식을 고른다 —
     모든 의뢰에 공통 — 목록 하나가 모든 의뢰 패널에 나간다
     분야별로 따로   — 의뢰 받는 분야마다(web/app 은 그 안의 범위마다) 따로 등록한다.
                       고르지 않은 분야는 칸만 흐리게 보여준다(디자이너 화면).
   목록마다 저장 버튼이 따로 있다. 방식은 누르는 즉시 저장한다.
   프리미엄 단계는 플랜마다 따로(plan-setup.tsx). */
export function OptionSetup({
  mode,
  designerId,
  setup,
  categories,
  templates,
}: {
  mode: 'admin' | 'designer'
  designerId: string
  /* null 이면 0004 전 — 저장할 자리가 없다 */
  setup: DesignerOptionSetup | null
  categories: OptionCategory[]
  templates: OptionTemplate[]
}) {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [pending, start] = useTransition()
  const router = useRouter()

  if (!setup) {
    return (
      <section className="rounded-xl bg-white p-5 ring-1 ring-neutral-200">
        <h2 className="text-sm font-semibold">포함 항목</h2>
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
          포함 항목 표가 아직 없습니다. 0004_plan_options_by_category.sql 을 먼저 적용해 주세요.
        </p>
      </section>
    )
  }

  const switchMode = (next: OptionsMode) => {
    if (next === setup.mode) return
    const text =
      next === 'by_category'
        ? '분야별로 따로 설정할까요? 아직 비어 있는 분야에는 지금 공통 항목이 복사됩니다.'
        : '모든 의뢰에 공통 항목을 쓸까요? 분야별로 등록한 항목은 남아 있지만 공개 화면에는 나가지 않습니다.'
    if (!window.confirm(text)) return

    /* 고른 분야의 칸에만 공통 항목을 복사한다 */
    const seed = categories.filter((c) => c.on).flatMap((c) => c.plans.map((p) => bucketOf(c.id, p.plan)))
    setMsg(null)
    start(async () => {
      const r =
        mode === 'admin'
          ? await setDesignerOptionsMode(designerId, next, seed)
          : await setMyOptionsMode(next, seed)
      if (!r.ok) {
        setMsg({ ok: false, text: r.error })
        return
      }
      setMsg({ ok: true, text: next === 'by_category' ? '분야별 설정으로 바꿨습니다.' : '공통 설정으로 바꿨습니다.' })
      router.refresh()
    })
  }

  const save = async (bucket: string, title: string, options: RegisteredOption[]) => {
    setMsg(null)
    const r =
      mode === 'admin'
        ? await setDesignerBucketOptions(designerId, bucket, options)
        : await setMyBucketOptions(bucket, options)
    if (!r.ok) {
      setMsg({ ok: false, text: r.error })
      return false
    }
    setMsg({ ok: true, text: `${title} 포함 항목을 저장했습니다.` })
    router.refresh()
    return true
  }

  return (
    <section className="rounded-xl bg-white p-5 ring-1 ring-neutral-200">
      <h2 className="text-sm font-semibold">포함 항목</h2>
      <p className="mt-1 text-xs leading-relaxed text-neutral-500">
        의뢰 패널에 보여줄 항목을 고르고 숫자를 넣어 저장하세요. 저장한 항목만 공개 페이지에 나갑니다.
      </p>

      <div role="radiogroup" aria-label="포함 항목 방식" className="mt-3.5 grid gap-2 sm:grid-cols-2">
        {(
          [
            ['common', '모든 의뢰에 공통 적용', '항목 하나로 모든 의뢰에 똑같이 나갑니다.'],
            ['by_category', '분야별로 따로 설정', '의뢰 받는 분야마다 항목을 따로 정합니다.'],
          ] as const
        ).map(([key, label, hint]) => (
          <label
            key={key}
            className={`flex items-start gap-2.5 rounded-lg border p-3 transition ${
              setup.mode === key ? 'border-violet-600 bg-violet-50' : 'cursor-pointer border-neutral-300 hover:bg-neutral-50'
            }`}
          >
            <input
              type="radio"
              name={`option-mode-${designerId}`}
              checked={setup.mode === key}
              disabled={pending}
              onChange={() => switchMode(key)}
              className="mt-0.5 shrink-0 accent-violet-600"
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium">{label}</span>
              <span className="mt-0.5 block text-xs text-neutral-500">{hint}</span>
            </span>
          </label>
        ))}
      </div>

      {msg && (
        <p
          className={`mt-4 rounded-lg px-3 py-2.5 text-sm ${
            msg.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'
          }`}
        >
          {msg.text}
        </p>
      )}

      <div className="mt-4 space-y-3">
        {setup.mode === 'common' ? (
          <BucketEditor
            key={COMMON_BUCKET}
            title="모든 의뢰 공통"
            bucket={COMMON_BUCKET}
            saved={setup.buckets[COMMON_BUCKET]}
            templates={templates}
            onSave={save}
          />
        ) : (
          categories.map((c) => {
            /* 디자이너는 고른 분야만 고친다. 어드민은 미리 채워 둘 수 있다 */
            const locked = mode === 'designer' && !c.on
            return (
              <div
                key={c.id}
                className={`rounded-lg border p-3.5 ${locked ? 'border-neutral-200 bg-neutral-50' : 'border-neutral-200'}`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className={`text-sm font-semibold ${locked ? 'text-neutral-400' : ''}`}>{c.name}</h3>
                  {!c.on && (
                    <span className="rounded bg-neutral-200 px-1.5 py-0.5 text-[10px] font-medium text-neutral-500">
                      미선택
                    </span>
                  )}
                </div>
                {locked && (
                  <p className="mt-1 text-[11px] text-neutral-400">
                    위 가격 플랜의 의뢰 받는 분야에서 {c.name}을(를) 선택하면 설정할 수 있어요.
                  </p>
                )}
                {c.plans.length === 0 && (
                  <p className="mt-2 text-[11px] text-neutral-400">받는 의뢰 유형이 없습니다.</p>
                )}
                <div className="mt-2.5 space-y-2.5">
                  {c.plans.map((p) => {
                    const bucket = bucketOf(c.id, p.plan)
                    /* 범위가 하나뿐인 분야는 분야 이름이 곧 제목 — 한 번 더 적지 않는다 */
                    const sub = c.plans.length > 1 ? p.label : null
                    return (
                      <BucketEditor
                        key={bucket}
                        title={sub ? `${c.name} · ${sub}` : c.name}
                        heading={sub}
                        bucket={bucket}
                        saved={setup.buckets[bucket]}
                        templates={templates}
                        disabled={locked}
                        nested
                        onSave={save}
                      />
                    )
                  })}
                </div>
              </div>
            )
          })
        )}
      </div>
    </section>
  )
}

/* 목록 하나 — 저장 전 고친 값은 이 안에만 있다 */
function BucketEditor({
  title,
  heading,
  bucket,
  saved,
  templates,
  disabled,
  nested,
  onSave,
}: {
  title: string
  /* 칸 위 제목 — 비우면 적지 않는다(공통은 title 을 쓴다) */
  heading?: string | null
  bucket: string
  saved: RegisteredOption[] | undefined
  templates: OptionTemplate[]
  disabled?: boolean
  /* 분야 카드 안에 들어가는 칸 — 테두리를 한 겹 덜 쓴다 */
  nested?: boolean
  onSave: (bucket: string, title: string, options: RegisteredOption[]) => Promise<boolean>
}) {
  const initial = picksOf(saved)
  const [picks, setPicks] = useState<Picks>(initial)
  const [error, setError] = useState('')
  const [pending, start] = useTransition()
  const usable = templates.filter((t) => templateAllowsBucket(t, bucket))
  const dirty = JSON.stringify(picks) !== JSON.stringify(initial)

  const submit = () => {
    const options = optionsOf(usable, picks)
    if (typeof options === 'string') {
      setError(options)
      return
    }
    setError('')
    start(async () => {
      await onSave(bucket, title, options)
    })
  }

  return (
    <div className={nested ? '' : 'rounded-lg border border-neutral-200 p-3.5'}>
      {(nested ? heading : title) && (
        <h4 className={`mb-2 text-xs font-semibold ${disabled ? 'text-neutral-400' : 'text-neutral-800'}`}>
          {nested ? heading : title}
        </h4>
      )}
      <OptionChecklist usable={usable} picks={picks} onChange={setPicks} disabled={disabled} />
      {error && <p className="mt-2 text-[11px] text-red-600">{error}</p>}
      {!disabled && (
        <div className="mt-2.5 flex items-center gap-2">
          <button
            type="button"
            disabled={pending || !dirty}
            onClick={submit}
            className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-violet-600 disabled:opacity-40"
          >
            {pending ? '저장 중…' : '저장'}
          </button>
          {dirty && !pending && <span className="text-[11px] text-neutral-400">저장하지 않은 변경이 있습니다</span>}
        </div>
      )}
    </div>
  )
}
