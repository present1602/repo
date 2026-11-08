'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { useActionTransition } from '@/lib/use-action-transition'
import { useRouter } from 'next/navigation'
import {
  COMMON_BUCKET,
  MAX_CUSTOM_PER_BUCKET,
  MAX_CUSTOM_TEXT,
  MAX_OPTION_N,
  bucketOf,
  needsN,
  optionText,
  templateAllowsBucket,
  type CustomOption,
  type DesignerOptionSetup,
  type OptionTemplate,
  type RegisteredOption,
} from '@/lib/plans'
import { designerChoices, type OptionCategory } from '@/lib/inquiry-choices'
import { panelEntries, type PanelSource } from '@/lib/panel-entries'
import { PlanPanel } from './plan-panel'
import {
  addDesignerCustomOption,
  removeDesignerCustomOption,
  setDesignerBucketOptions,
} from '@/app/admin/designers/actions'
import { addMyCustomOption, removeMyCustomOption, setMyBucketOptions } from '@/app/studio/actions'
import { Flash } from '@/components/flash'

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

/* 공통에서 체크한 항목을 개별 목록에서 눌렀을 때 */
const COMMON_LOCK_ALERT = '공통 항목에서 체크한 항목입니다.\n바꾸려면 공통 항목에서 해제해 주세요.'

/* 템플릿 체크 목록 — {n} 이 있으면 숫자 칸이 문장 사이에 들어간다.
   lockedPicks 에 있는 템플릿(공통에서 체크한 것)은 체크된 채 잠가 보여준다 */
export function OptionChecklist({
  usable,
  picks,
  onChange,
  disabled,
  lockedPicks,
}: {
  usable: OptionTemplate[]
  picks: Picks
  onChange: (next: Picks) => void
  disabled?: boolean
  lockedPicks?: Picks
}) {
  if (usable.length === 0) {
    return <p className="text-[11px] text-neutral-400">이 플랜에서 고를 수 있는 항목이 없습니다.</p>
  }
  return (
    <div className="space-y-1.5">
      {usable.map((t) => {
        if (lockedPicks && t.id in lockedPicks) {
          const raw = lockedPicks[t.id].trim()
          return (
            <LockedLine
              key={t.id}
              text={
                needsN(t.template)
                  ? optionText(t.template, raw ? Number(raw) : null).replaceAll('{n}', 'n')
                  : t.template
              }
            />
          )
        }
        const on = t.id in picks
        const [before, ...rest] = t.template.split('{n}')
        /* 숫자가 있어야 공개 화면에 나간다 — 체크했는데 비었거나 틀리면 바로 아래에 알린다 */
        const raw = (picks[t.id] ?? '').trim()
        const n = Number(raw)
        const missingN = on && needsN(t.template) && (!raw || !Number.isInteger(n) || n < 0 || n > MAX_OPTION_N)
        return (
          <div key={t.id}>
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-neutral-700">
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
                <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">전용</span>
              )}
            </div>
            {missingN && <p className="mt-0.5 pl-5 text-[10px] text-red-600">숫자값을 입력해야 화면에 노출됩니다.</p>}
          </div>
        )
      })}
    </div>
  )
}

/* 공통에서 들어오는 한 줄 — 체크된 채 잠겨 있다. 눌러도 바뀌지 않고 어디서 바꾸는지 알린다.
   진짜 체크박스(disabled)는 브라우저가 꺼진 것처럼 흐리게 칠해 직접 그린다 */
function LockedLine({ text }: { text: string }) {
  return (
    <button
      type="button"
      onClick={() => window.alert(COMMON_LOCK_ALERT)}
      className="flex w-full items-center gap-1.5 text-left text-xs text-neutral-500"
    >
      <span
        aria-hidden
        className="grid size-[13px] shrink-0 place-items-center rounded-[3px] bg-violet-300 text-[9px] font-bold leading-none text-white"
      >
        ✓
      </span>
      <span className="min-w-0 break-words">{text}</span>
      <span className="shrink-0 rounded bg-violet-50 px-1.5 py-0.5 text-[10px] font-medium text-violet-500">공통</span>
    </button>
  )
}

/* 체크 상태를 미리보기용 등록 값으로 — 숫자가 비었거나 틀리면 n 없이 둔다(공개 화면처럼 빠진다) */
function previewOptions(picks: Picks): RegisteredOption[] {
  return Object.entries(picks).map(([templateId, raw]) => {
    const n = Number(raw.trim())
    return {
      templateId,
      n: raw.trim() && Number.isInteger(n) && n >= 0 && n <= MAX_OPTION_N ? n : null,
    }
  })
}

/* 미리보기 재료 — 저장된 값으로 서버가 만들어 넘긴다. 포함 항목만 화면에서 고친 값으로 바꿔 그린다 */
export type OptionPreview = Omit<PanelSource, 'choices'> & {
  designerId: string
  designerName: string
  /* 가격·스위치·저장된 분야 — 의뢰 유형은 화면에서 고친 분야로 다시 만든다(designerChoices) */
  designer: Parameters<typeof designerChoices>[0]
}

/* 화면에서 고친 체크를 미리보기(설정 탭 오른쪽 칸)로 올려 보내는 통로 — 미리보기는
   포함 항목 칸 밖에 있어 props 로 닿지 않는다(OptionSetup 은 페이지가 그려 넘긴다) */
export type OptionDrafts = Record<string, Picks>
export const OptionDraftsContext = createContext<((drafts: OptionDrafts) => void) | null>(null)

/* 저장된 포함 항목에 화면에서 고친 체크를 얹는다 — 개별 목록에서는 공통에 체크된 템플릿을 뺀다
   (저장하면 서버도 그렇게 한다). 직접 입력은 + 로 바로 저장되므로 저장된 값을 쓴다 */
export function liveOptionSetup(setup: DesignerOptionSetup, drafts: OptionDrafts | null): DesignerOptionSetup {
  if (!drafts) return setup
  const commonIds = new Set(Object.keys(drafts[COMMON_BUCKET] ?? {}))
  return {
    custom: setup.custom,
    buckets: Object.fromEntries(
      Object.entries(drafts).map(([b, p]) => [
        b,
        previewOptions(
          b === COMMON_BUCKET ? p : Object.fromEntries(Object.entries(p).filter(([id]) => !commonIds.has(id))),
        ),
      ]),
    ),
  }
}

/* 기본 단계 포함 항목(0004·0005).

   왼쪽 공통 항목 — 모든 의뢰 유형에 먼저 나간다
   오른쪽 개별 항목 — 의뢰 받는 분야마다(web/app 은 그 안의 범위마다) 공통 다음에 나간다.
               공통에서 체크한 항목은 체크된 채 잠겨 보인다(같은 줄이 두 번 나가지 않게 — 서버도 막는다).
               저장 전이라도 공통에서 체크하는 순간 잠긴다.
               고르지 않은 분야는 칸만 흐리게 보여준다(디자이너 화면).
   목록마다 템플릿 체크는 저장 버튼으로, 직접 입력은 + 를 누르면 바로 저장된다.
   고친 체크는 OptionDraftsContext 로 설정 탭의 미리보기에 바로 비친다.
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
  /* 목록마다 화면에서 고친 체크 — 공통 체크가 개별 목록 잠금·미리보기에 바로 비친다 */
  const [drafts, setDrafts] = useState<Record<string, Picks>>(() =>
    Object.fromEntries(Object.entries(setup?.buckets ?? {}).map(([b, r]) => [b, picksOf(r)])),
  )
  const router = useRouter()
  const report = useContext(OptionDraftsContext)
  useEffect(() => {
    report?.(drafts)
  }, [report, drafts])

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

  const draftOf = (b: string) => drafts[b] ?? {}
  const setDraft = (b: string, p: Picks) => setDrafts((d) => ({ ...d, [b]: p }))
  const commonPicks = draftOf(COMMON_BUCKET)

  /* 서버 결과를 알림으로 — 성공하면 새로 그린다 */
  const done = (r: { ok: true } | { ok: false; error: string }, okText: string) => {
    if (!r.ok) {
      setMsg({ ok: false, text: r.error })
      return false
    }
    setMsg({ ok: true, text: okText })
    router.refresh()
    return true
  }

  const actions: BucketActions = {
    save: async (bucket, title, options) => {
      setMsg(null)
      const r =
        mode === 'admin'
          ? await setDesignerBucketOptions(designerId, bucket, options)
          : await setMyBucketOptions(bucket, options)
      /* 공통에 저장한 항목은 서버가 개별 목록에서 뺀다 — 화면의 체크도 같이 비운다 */
      if (r.ok && bucket === COMMON_BUCKET) {
        const moved = new Set(options.map((o) => o.templateId))
        setDrafts((d) =>
          Object.fromEntries(
            Object.entries(d).map(([b, p]) => [
              b,
              b === COMMON_BUCKET ? p : Object.fromEntries(Object.entries(p).filter(([id]) => !moved.has(id))),
            ]),
          ),
        )
      }
      return done(r, `${title} 포함 항목을 저장했습니다.`)
    },
    add: async (bucket, text) => {
      setMsg(null)
      const r =
        mode === 'admin'
          ? await addDesignerCustomOption(designerId, bucket, text)
          : await addMyCustomOption(bucket, text)
      return done(r, `'${text.trim()}'을(를) 더했습니다.`)
    },
    remove: async (id, text) => {
      if (!window.confirm(`'${text}'을(를) 지울까요?`)) return false
      setMsg(null)
      const r = mode === 'admin' ? await removeDesignerCustomOption(designerId, id) : await removeMyCustomOption(id)
      return done(r, `'${text}'을(를) 지웠습니다.`)
    },
  }

  const commonCustom = setup.custom[COMMON_BUCKET] ?? []

  return (
    <section className="rounded-xl bg-white p-5 ring-1 ring-neutral-200">
      <h2 className="text-sm font-semibold">포함 항목</h2>
      <p className="mt-1 text-xs leading-relaxed text-neutral-500">
        고객이 상세 페이지에서 의뢰 유형을 고르면 가격 아래에 체크 목록으로 보여요. 공통 항목이 먼저, 그 의뢰 유형의
        개별 항목이 이어서 나갑니다.
      </p>

      <Flash msg={msg} onDone={() => setMsg(null)} className="mt-4" />

      <div className="mt-4 grid items-start gap-5 lg:grid-cols-2">
        <div>
          <h3 className="text-xs font-semibold text-neutral-800">공통 항목</h3>
          <p className="mt-0.5 text-[11px] text-neutral-500">모든 의뢰 유형에 들어갑니다.</p>
          <div className="mt-2">
            <BucketEditor
              title="공통"
              bucket={COMMON_BUCKET}
              saved={setup.buckets[COMMON_BUCKET]}
              picks={commonPicks}
              onPicks={(p) => setDraft(COMMON_BUCKET, p)}
              custom={setup.custom[COMMON_BUCKET]}
              templates={templates}
              actions={actions}
            />
          </div>
        </div>

        <div>
          <h3 className="text-xs font-semibold text-neutral-800">개별 항목</h3>
          <p className="mt-0.5 text-[11px] text-neutral-500">
            그 의뢰 유형에만, 공통 항목 아래에 이어서 들어갑니다. 공통에서 체크한 항목은 잠겨 있어요.
          </p>
          <div className="mt-2 space-y-3">
            {categories.map((c) => {
              /* 디자이너는 고른 분야만 고친다. 어드민은 미리 채워 둘 수 있다 */
              const locked = mode === 'designer' && !c.on
              return (
                <div
                  key={c.id}
                  className={`rounded-lg border p-3.5 ${locked ? 'border-neutral-200 bg-neutral-50' : 'border-neutral-200'}`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className={`text-sm font-semibold ${locked ? 'text-neutral-400' : ''}`}>{c.name}</h4>
                    {/* 디자이너 화면은 흐린 카드로 충분하다 — 어드민은 고르지 않은 분야도 고칠 수 있어
                        카드가 흐려지지 않으므로 라벨로 알린다 */}
                    {!c.on && mode === 'admin' && (
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
                  <div className="mt-2.5 space-y-4">
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
                          picks={draftOf(bucket)}
                          onPicks={(next) => setDraft(bucket, next)}
                          custom={setup.custom[bucket]}
                          templates={templates}
                          lockedPicks={commonPicks}
                          lockedCustom={commonCustom}
                          disabled={locked}
                          nested
                          actions={actions}
                        />
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}

/* 상세 페이지 미리보기 — 왼쪽은 작업 자리를 그림으로만, 오른쪽은 실제 의뢰 패널.
   패널은 공개 화면과 같은 계산(panel-entries.ts)에 화면에서 고친 포함 항목을 넣어 그린다 */
export function DetailPreview({
  preview,
  drafts,
  picked,
}: {
  preview: OptionPreview
  drafts: OptionDrafts | null
  /* 가격 플랜에서 고친 의뢰 받는 분야 — null 이면 저장된 값 */
  picked: string[] | null
}) {
  const { designerId, designerName, designer, ...src } = preview
  /* 고른 분야의 유형만 — 공개 화면은 고른 분야가 없으면 메뉴 분야를 다 보여주지만(폼을 보낼 수 있게),
     미리보기는 끈 분야가 바로 빠져 보여야 한다 */
  const tags = picked ?? designer.tags
  const choices = designerChoices({ ...designer, tags }, src.metas, {
    copies: src.copies,
    premiums: src.premiums,
  }).filter((c) => tags.includes(c.name))
  const entries = panelEntries({
    ...src,
    choices,
    optionSetup: src.optionSetup && liveOptionSetup(src.optionSetup, drafts),
  })
  return (
    <div className="overflow-hidden rounded-xl bg-neutral-100 ring-1 ring-neutral-200">
      <div className="flex items-center justify-between border-b border-neutral-200 bg-white px-3 py-2">
        <span className="text-[11px] font-semibold text-neutral-700">상세 페이지 미리보기</span>
        <span className="text-[10px] text-neutral-400">저장 전 체크도 바로 보여요</span>
      </div>
      <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-3 p-3">
        {/* 작업 자리 — 이름 줄과 작업 카드를 흐린 상자로 */}
        <div aria-hidden className="space-y-2">
          <div className="flex items-center gap-1.5">
            <span className="size-5 shrink-0 rounded-full bg-neutral-300" />
            <span className="h-2 flex-1 rounded bg-neutral-300" />
          </div>
          <div className="h-1.5 w-3/4 rounded bg-neutral-200" />
          <div className="grid grid-cols-2 gap-1.5 pt-1">
            <span className="col-span-2 h-14 rounded bg-neutral-200" />
            <span className="h-16 rounded bg-neutral-200" />
            <span className="h-10 rounded bg-neutral-200" />
            <span className="h-10 rounded bg-neutral-200" />
            <span className="h-16 rounded bg-neutral-200" />
            <span className="col-span-2 h-12 rounded bg-neutral-200" />
          </div>
        </div>
        <div className="min-w-0">
          <PlanPanel
            designerId={designerId}
            designerName={designerName}
            choices={choices}
            entries={entries}
            preview
          />
        </div>
      </div>
    </div>
  )
}

type BucketActions = {
  save: (bucket: string, title: string, options: RegisteredOption[]) => Promise<boolean>
  add: (bucket: string, text: string) => Promise<boolean>
  remove: (id: string, text: string) => Promise<boolean>
}

/* 목록 하나 — 템플릿 체크(저장 전 고친 값은 이 안에만)와 직접 입력 */
function BucketEditor({
  title,
  heading,
  bucket,
  saved,
  picks,
  onPicks,
  custom,
  templates,
  lockedPicks,
  lockedCustom,
  disabled,
  nested,
  actions,
}: {
  title: string
  /* 칸 위 제목 — 비우면 적지 않는다 */
  heading?: string | null
  bucket: string
  saved: RegisteredOption[] | undefined
  /* 화면에서 고친 체크 — OptionSetup 이 들고 있다(공통 체크가 개별 잠금·미리보기에 바로 비치게) */
  picks: Picks
  onPicks: (next: Picks) => void
  custom: CustomOption[] | undefined
  templates: OptionTemplate[]
  /* 공통에서 체크한 템플릿·직접 적은 항목 — 체크된 채 잠가 보여준다 */
  lockedPicks?: Picks
  lockedCustom?: CustomOption[]
  disabled?: boolean
  /* 분야 카드 안에 들어가는 칸 — 테두리를 한 겹 덜 쓴다 */
  nested?: boolean
  actions: BucketActions
}) {
  const [error, setError] = useState('')
  const [draft, setDraft] = useState('')
  const [pending, start] = useActionTransition()
  const usable = templates.filter((t) => templateAllowsBucket(t, bucket))
  /* 이 목록이 정하는 템플릿 — 공통에서 체크한 것은 공통 몫이라 저장·비교에서 뺀다 */
  const own = usable.filter((t) => !(lockedPicks && t.id in lockedPicks))
  const ownOnly = (p: Picks) => Object.fromEntries(own.filter((t) => t.id in p).map((t) => [t.id, p[t.id]]))
  const dirty = JSON.stringify(ownOnly(picks)) !== JSON.stringify(ownOnly(picksOf(saved)))
  const list = custom ?? []

  const submit = () => {
    const options = optionsOf(own, picks)
    if (typeof options === 'string') {
      setError(options)
      return
    }
    setError('')
    start(async () => {
      await actions.save(bucket, title, options)
    })
  }

  const add = () => {
    const text = draft.trim()
    if (!text) return
    if (text.length > MAX_CUSTOM_TEXT) {
      setError(`항목은 ${MAX_CUSTOM_TEXT}자 이내로 입력해 주세요.`)
      return
    }
    setError('')
    start(async () => {
      if (await actions.add(bucket, text)) setDraft('')
    })
  }

  return (
    <div className={nested ? '' : 'rounded-lg border border-neutral-200 p-3.5'}>
      {heading && (
        <h5 className={`mb-2 text-xs font-semibold ${disabled ? 'text-neutral-400' : 'text-neutral-800'}`}>
          {heading}
        </h5>
      )}

      <OptionChecklist usable={usable} picks={picks} onChange={onPicks} disabled={disabled} lockedPicks={lockedPicks} />

      {/* 공통에 직접 적은 항목 — 여기서도 잠근 채 보인다 */}
      {lockedCustom && lockedCustom.length > 0 && (
        <div className="mt-1.5 space-y-1.5">
          {lockedCustom.map((c) => (
            <LockedLine key={c.id} text={c.text} />
          ))}
        </div>
      )}

      {/* 직접 적은 항목 — 이 목록에만 들어간다 */}
      {list.length > 0 && (
        <ul className="mt-1.5 space-y-1.5">
          {list.map((c) => (
            <li key={c.id} className="flex items-center gap-1.5 text-xs text-neutral-700">
              <svg
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="size-3.5 shrink-0 text-violet-600"
                aria-hidden
              >
                <path d="M3 8.5l3 3 7-7" />
              </svg>
              <span className="min-w-0 break-words">{c.text}</span>
              {!disabled && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => start(async () => void (await actions.remove(c.id, c.text)))}
                  aria-label={`${c.text} 지우기`}
                  className="grid size-5 shrink-0 place-items-center rounded text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700"
                >
                  ×
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {!disabled && list.length < MAX_CUSTOM_PER_BUCKET && (
        <div className="mt-2 flex items-center gap-1.5">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              /* 한글 조합 중 Enter 는 글자 확정이다 — 그때는 더하지 않는다 */
              if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                e.preventDefault()
                add()
              }
            }}
            maxLength={MAX_CUSTOM_TEXT}
            placeholder="직접 입력"
            aria-label={`${title} 항목 직접 입력`}
            className="h-8 min-w-0 flex-1 rounded-md border border-neutral-300 bg-white px-2.5 text-xs outline-none ring-violet-500 focus:ring-2"
          />
          <button
            type="button"
            disabled={pending || !draft.trim()}
            onClick={add}
            aria-label="항목 더하기"
            className="grid size-8 shrink-0 place-items-center rounded-md border border-neutral-300 text-base text-neutral-700 transition hover:bg-neutral-100 disabled:opacity-40"
          >
            +
          </button>
        </div>
      )}

      {error && <p className="mt-2 text-[11px] text-red-600">{error}</p>}
      {!disabled && (own.length > 0 || dirty) && (
        <div className="mt-2.5 flex items-center gap-2">
          <button
            type="button"
            disabled={pending || !dirty}
            onClick={submit}
            className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-violet-600 disabled:opacity-40"
          >
            {pending ? '저장 중…' : '체크 저장'}
          </button>
          {dirty && !pending && <span className="text-[11px] text-neutral-400">저장하지 않은 변경이 있습니다</span>}
        </div>
      )}
    </div>
  )
}
