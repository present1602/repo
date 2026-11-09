'use client'

import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { useActionTransition } from '@/lib/use-action-transition'
import { useRouter } from 'next/navigation'
import {
  COMMON_BUCKET,
  MAX_CUSTOM_PER_BUCKET,
  MAX_CUSTOM_TEXT,
  MAX_OPTION_N,
  N_TOKEN,
  bucketOf,
  needsN,
  optionText,
  templateAllowsBucket,
  type CustomOption,
  type DesignerOptionSetup,
  type OptionTemplate,
  type PlanTier,
  type RegisteredOption,
} from '@/lib/plans'
import { designerChoices, type InquiryScope, type OptionCategory } from '@/lib/inquiry-choices'
import { panelEntries, type PanelSource } from '@/lib/panel-entries'
import { PlanPanel, type PanelFocus } from './plan-panel'
import {
  addDesignerCustomOption,
  removeDesignerCustomOption,
  setDesignerBucketOptions,
  setDesignerCustomOptionTiers,
} from '@/app/admin/designers/actions'
import {
  addMyCustomOption,
  removeMyCustomOption,
  setMyBucketOptions,
  setMyCustomOptionTiers,
} from '@/app/studio/actions'
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

/* 체크를 바로 저장할 모양으로 — 숫자가 비었거나 틀리면 n 없이 둔다(공개 화면에서 빠진다).
   기본 단계 목록은 체크하는 순간 저장하므로 숫자를 적기 전 상태도 그대로 보낸다 */
export function draftOptionsOf(templates: OptionTemplate[], picks: Picks): RegisteredOption[] {
  const valid = Object.fromEntries(previewOptions(picks).map((o) => [o.templateId, o.n]))
  return templates.filter((t) => t.id in picks).map((t) => ({ templateId: t.id, n: needsN(t.template) ? valid[t.id] : null }))
}

/* 템플릿 체크 목록 — {n} 이 있으면 숫자 칸이 문장 사이에 들어간다.
   lockedPicks 에 있는 템플릿(공통에서 체크한 것)은 체크된 채 잠가 보여준다.
   onCommit — 값이 확정될 때(체크·해제는 바로, 숫자는 Enter·포커스 아웃). 바로 저장하는 화면이 쓴다 */
export function OptionChecklist({
  usable,
  picks,
  onChange,
  onCommit,
  disabled,
  lockedPicks,
}: {
  usable: OptionTemplate[]
  picks: Picks
  onChange: (next: Picks) => void
  onCommit?: (next: Picks) => void
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
                  onCommit?.(next)
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
                    onBlur={() => onCommit?.(picks)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') e.currentTarget.blur()
                    }}
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

/* 목록 하나의 화면 값 — 단계(STANDARD·PREMIUM)마다 체크. 두 단계는 같은 항목 줄을 나눠 쓴다(0017) */
export type TierPicks = Record<PlanTier, Picks>
const NO_PICKS: TierPicks = { basic: {}, premium: {} }

/* 화면에서 고친 체크를 미리보기(설정 탭 오른쪽 칸)로 올려 보내는 통로 — 미리보기는
   포함 항목 칸 밖에 있어 props 로 닿지 않는다(OptionSetup 은 페이지가 그려 넘긴다) */
export type OptionDrafts = Record<string, TierPicks>
export const OptionDraftsContext = createContext<((drafts: OptionDrafts) => void) | null>(null)

/* 개별 항목 칸을 건드리면(포커스·저장) 미리보기가 그 의뢰 유형을 골라 보여주게 알리는 통로.
   tier — PREMIUM 열을 건드리면 미리보기도 PREMIUM 탭으로 */
export type OptionTouch = { category: string; scope: InquiryScope; tier?: PlanTier }
export const OptionFocusContext = createContext<((touch: OptionTouch) => void) | null>(null)

/* 분야 카드의 열 — 넷까지는 칸이 넓으면 한 줄에 모두, 다섯부터는 세 열.
   좁아지면 두 열, 한 열로 내려간다(@container 폭 기준). Tailwind 가 읽도록 글자 그대로 둔다 */
function categoryCols(count: number): string {
  if (count <= 1) return 'grid-cols-1'
  if (count === 2) return 'grid-cols-1 @min-[28rem]:grid-cols-2'
  if (count === 3) return 'grid-cols-1 @min-[28rem]:grid-cols-2 @min-[38rem]:grid-cols-3'
  if (count === 4) return 'grid-cols-1 @min-[28rem]:grid-cols-2 @min-[38rem]:grid-cols-4'
  return 'grid-cols-1 @min-[28rem]:grid-cols-2 @min-[38rem]:grid-cols-3'
}

/* 공통이 맡은 템플릿 — 공통에서 어느 단계든 체크했으면 개별 목록에서는 잠긴다(서버도 그렇게 한다) */
function commonIdsOf(common: TierPicks | undefined): Set<string> {
  return new Set([...Object.keys(common?.basic ?? {}), ...Object.keys(common?.premium ?? {})])
}

/* 저장된 포함 항목에 화면에서 고친 체크를 얹는다 — 개별 목록에서는 공통이 맡은 템플릿을 뺀다
   (저장하면 서버도 그렇게 한다). 직접 입력은 바로 저장되므로 저장된 값을 쓴다 */
export function liveOptionSetup(setup: DesignerOptionSetup, drafts: OptionDrafts | null): DesignerOptionSetup {
  if (!drafts) return setup
  const commonIds = commonIdsOf(drafts[COMMON_BUCKET])
  const tierOf = (tier: PlanTier) =>
    Object.fromEntries(
      Object.entries(drafts).map(([b, d]) => [
        b,
        previewOptions(
          b === COMMON_BUCKET
            ? d[tier]
            : Object.fromEntries(Object.entries(d[tier]).filter(([id]) => !commonIds.has(id))),
        ),
      ]),
    )
  return {
    custom: setup.custom,
    buckets: tierOf('basic'),
    premium: setup.premium == null ? null : tierOf('premium'),
  }
}

/* 포함 항목(0004·0005·0017).

   왼쪽 공통 항목 — 모든 의뢰 유형에 먼저 나간다
   오른쪽 개별 항목 — 의뢰 받는 분야마다 공통 다음에 나간다. 디자인만·프로젝트는 같은 디자이너가
               맡으므로 한 목록이고, 메인화면 먼저 의뢰만 따로다(0018).
               공통에서 체크한 항목은 체크된 채 잠겨 보인다(같은 줄이 두 번 나가지 않게 — 서버도 막는다).
               저장 전이라도 공통에서 체크하는 순간 잠긴다.
               고르지 않은 분야는 칸만 흐리게 보여준다(디자이너 화면).
   프리미엄이 켜진 의뢰 유형은 STANDARD·PREMIUM 두 열의 표다 — 항목 줄은 같고, 단계마다
     체크와 숫자만 다르다(상세 패널이 두 단계를 같은 줄로 견준다). 공통 칸은 프리미엄이 켜진
     유형이 하나라도 있으면 두 열이다. 프리미엄이 없으면 예전처럼 한 줄 체크 목록.
     공통은 한 줄을 다 쓰고, 개별(분야 카드)은 그 아래에 넷까지 한 줄·다섯부터 세 열(categoryCols).
   저장 버튼은 없다 — 체크·해제는 바로, 숫자와 직접 입력은 Enter·포커스 아웃·+ 로 바로 저장된다.
   {n} 항목은 숫자 없이 체크해도 저장되지만 공개 화면에는 숫자를 적어야 나간다.
   고친 체크는 OptionDraftsContext 로 설정 탭의 미리보기에 바로 비친다.
   0017 전이면 PREMIUM 열 없이 기본 단계만 — 프리미엄은 플랜마다 따로(plan-setup.tsx). */
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
  const [drafts, setDrafts] = useState<OptionDrafts>(() => {
    const buckets = new Set([...Object.keys(setup?.buckets ?? {}), ...Object.keys(setup?.premium ?? {})])
    return Object.fromEntries(
      [...buckets].map((b) => [b, { basic: picksOf(setup?.buckets[b]), premium: picksOf(setup?.premium?.[b]) }]),
    )
  })
  const router = useRouter()
  const report = useContext(OptionDraftsContext)
  const touch = useContext(OptionFocusContext)
  useEffect(() => {
    report?.(drafts)
  }, [report, drafts])

  if (!setup) {
    return (
      <section className="rounded-xl bg-white p-5 ring-1 ring-neutral-200">
        <h2 className="text-sm font-semibold">의뢰유형별 옵션안내항목 설정</h2>
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
          포함 항목 표가 아직 없습니다. 0004_plan_options_by_category.sql 을 먼저 적용해 주세요.
        </p>
      </section>
    )
  }

  const draftOf = (b: string) => drafts[b] ?? NO_PICKS
  const setDraft = (b: string, tier: PlanTier, p: Picks) =>
    setDrafts((d) => ({ ...d, [b]: { ...(d[b] ?? NO_PICKS), [tier]: p } }))
  const commonPicks = draftOf(COMMON_BUCKET)

  /* PREMIUM 열 — 0017 이 돌았고 그 유형에 프리미엄이 나갈 때만 */
  const premiumReady = setup.premium != null
  const tiersOf = (premium: boolean): PlanTier[] => (premiumReady && premium ? ['basic', 'premium'] : ['basic'])
  const anyPremium = categories.some((c) => c.plans.some((p) => p.premium))
  const wide = premiumReady && anyPremium

  /* 서버 결과 — 실패만 알린다. 고칠 때마다 바로 저장되므로 성공은 목록 옆 '저장됨'으로 충분하다 */
  const done = (r: { ok: true } | { ok: false; error: string }) => {
    if (!r.ok) {
      setMsg({ ok: false, text: r.error })
      return false
    }
    router.refresh()
    return true
  }

  const actions: BucketActions = {
    save: async (bucket, tier, options) => {
      setMsg(null)
      const r =
        mode === 'admin'
          ? await setDesignerBucketOptions(designerId, bucket, options, tier)
          : await setMyBucketOptions(bucket, options, tier)
      /* 공통에 저장한 항목은 서버가 개별 목록(두 단계 모두)에서 뺀다 — 화면의 체크도 같이 비운다 */
      if (r.ok && bucket === COMMON_BUCKET) {
        const moved = new Set(options.map((o) => o.templateId))
        const keep = (p: Picks) => Object.fromEntries(Object.entries(p).filter(([id]) => !moved.has(id)))
        setDrafts((d) =>
          Object.fromEntries(
            Object.entries(d).map(([b, p]) => [
              b,
              b === COMMON_BUCKET ? p : { basic: keep(p.basic), premium: keep(p.premium) },
            ]),
          ),
        )
      }
      return done(r)
    },
    add: async (bucket, text, tiers) => {
      setMsg(null)
      const r =
        mode === 'admin'
          ? await addDesignerCustomOption(designerId, bucket, text, tiers)
          : await addMyCustomOption(bucket, text, tiers)
      return done(r)
    },
    setTiers: async (id, tiers) => {
      setMsg(null)
      const r =
        mode === 'admin'
          ? await setDesignerCustomOptionTiers(designerId, id, tiers)
          : await setMyCustomOptionTiers(id, tiers)
      return done(r)
    },
    remove: async (id, text) => {
      if (!window.confirm(`'${text}'을(를) 지울까요?`)) return false
      setMsg(null)
      const r = mode === 'admin' ? await removeDesignerCustomOption(designerId, id) : await removeMyCustomOption(id)
      return done(r)
    },
  }

  const commonCustom = setup.custom[COMMON_BUCKET] ?? []

  return (
    <section className="rounded-xl bg-white p-5 ring-1 ring-neutral-200">
      <h2 className="text-sm font-semibold">의뢰유형별 옵션안내항목 설정</h2>
      <p className="mt-1 text-xs leading-relaxed text-neutral-500">
        고객이 상세 페이지에서 의뢰 유형을 고르면 가격 아래에 체크 목록으로 보여요. 공통 항목이 먼저, 그 의뢰 유형의
        개별 항목이 이어서 나갑니다.
        {wide && ' 프리미엄이 있는 유형은 같은 항목을 STANDARD·PREMIUM 마다 체크하고 숫자를 따로 넣을 수 있어요.'}
      </p>
      {/* 분야 × 유형 칸이 많아 좁은 화면에서는 길게 늘어진다 — 휴대폰 폭(md 미만)에서만 알린다 */}
      <p className="mt-2 rounded-md bg-amber-50 px-2.5 py-1.5 text-[11px] leading-relaxed text-amber-700 md:hidden">
        옵션안내항목 설정은 모바일에서는 다소 불편할 수 있습니다(PC 권장).
      </p>

      <Flash msg={msg} onDone={() => setMsg(null)} className="mt-4" />

      {/* 공통은 한 줄을 다 쓰고, 개별(분야 카드)은 그 아래에 여러 열로 */}
      <div className="mt-4 space-y-5">
        <div>
          <h3 className="text-xs font-semibold text-neutral-800">공통 항목</h3>
          <p className="mt-0.5 text-[11px] text-neutral-500">모든 의뢰 유형에 들어갑니다.</p>
          <div className="mt-2">
            <BucketEditor
              title="공통"
              bucket={COMMON_BUCKET}
              tiers={tiersOf(anyPremium)}
              picks={commonPicks}
              onPicks={(tier, p) => setDraft(COMMON_BUCKET, tier, p)}
              custom={setup.custom[COMMON_BUCKET]}
              templates={templates}
              actions={actions}
            />
          </div>
        </div>

        <div>
          <h3 className="text-xs font-semibold text-neutral-800">개별 항목</h3>
          <p className="mt-0.5 text-[11px] text-neutral-500">
            그 분야에만, 공통 항목 아래에 이어서 들어갑니다. 공통에서 체크한 항목은 잠겨 있어요.
          </p>
          {/* 분야가 넷까지는 넓은 화면에서 한 줄에, 다섯부터는 세 열. 열 수는 화면이 아니라
              이 칸의 실제 폭(container query)으로 정한다 — 오른쪽 미리보기가 붙어 있어 폭이 좁다 */}
          <div className="@container mt-2">
            <div className={`grid items-start gap-3 ${categoryCols(categories.length)}`}>
            {categories.map((c) => {
              /* 디자이너는 고른 분야만 고친다. 어드민은 미리 채워 둘 수 있다 */
              const locked = mode === 'designer' && !c.on
              return (
                <div
                  key={c.id}
                  className={`min-w-0 rounded-lg border p-3 ${locked ? 'border-neutral-200 bg-neutral-50' : 'border-neutral-200'}`}
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
                      /* 목록이 하나뿐인 분야는 분야 이름이 곧 제목 — 한 번 더 적지 않는다.
                         본계약(디자인만·프로젝트)은 한 목록이라 메인 시안 목록이 있을 때만 제목이 붙는다 */
                      const sub = c.plans.length > 1 ? p.label : null
                      return (
                        <BucketEditor
                          key={bucket}
                          title={sub ? `${c.name} · ${sub}` : c.name}
                          heading={sub}
                          /* 의뢰 유형 이름은 분야마다 같아('메인화면 먼저 의뢰') 어느 분야 칸인지 붙여 둔다.
                             '홈페이지/반응형웹' 처럼 긴 이름은 앞부분만 */
                          badge={c.name.split('/')[0].trim()}
                          onTouch={(tier) => touch?.({ category: c.name, scope: p.scope, tier })}
                          bucket={bucket}
                          tiers={tiersOf(p.premium)}
                          picks={draftOf(bucket)}
                          onPicks={(tier, next) => setDraft(bucket, tier, next)}
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
  focus,
}: {
  preview: OptionPreview
  drafts: OptionDrafts | null
  /* 가격 플랜에서 고친 의뢰 받는 분야 — null 이면 저장된 값 */
  picked: string[] | null
  /* 포함 항목에서 건드린 칸의 유형 — 그 줄을 골라 보여준다 */
  focus?: PanelFocus | null
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
        <span className="text-[10px] text-neutral-400">고치면 바로 저장되고 여기 보여요</span>
      </div>
      {/* 실제 상세는 왼쪽 포트폴리오가 훨씬 넓다 — 그 느낌이 나게 작업 자리를 넉넉히 */}
      <div className="grid grid-cols-[132px_minmax(0,1fr)] gap-3 p-3">
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
            focus={focus}
          />
        </div>
      </div>
    </div>
  )
}

type CustomTiers = { basic: boolean; premium: boolean }

type BucketActions = {
  save: (bucket: string, tier: PlanTier, options: RegisteredOption[]) => Promise<boolean>
  add: (bucket: string, text: string, tiers: CustomTiers) => Promise<boolean>
  setTiers: (id: string, tiers: CustomTiers) => Promise<boolean>
  remove: (id: string, text: string) => Promise<boolean>
}

/* '저장됨' 을 보여 두는 시간 */
const SAVED_MS = 1500

const TIER_LABEL: Record<PlanTier, string> = { basic: 'STANDARD', premium: 'PREMIUM' }

/* 숫자 칸이 비었거나 틀렸는지 — 그러면 공개 화면에 나가지 않는다 */
function badN(raw: string | undefined): boolean {
  const v = (raw ?? '').trim()
  const n = Number(v)
  return !v || !Number.isInteger(n) || n < 0 || n > MAX_OPTION_N
}

/* 목록 하나 — 템플릿 체크와 직접 입력. 저장 버튼 없이 고치는 대로 저장한다.
   tiers 가 둘이면 STANDARD·PREMIUM 두 열의 표(TierTable), 하나면 한 줄 체크 목록 */
function BucketEditor({
  title,
  heading,
  badge,
  onTouch,
  bucket,
  tiers,
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
  /* 제목 앞 작은 분야 뱃지 — 제목이 있을 때만 */
  badge?: string
  /* 이 칸을 건드릴 때(포커스·저장) — 미리보기가 이 유형(과 단계)을 고르게. 공통 칸은 없다 */
  onTouch?: (tier?: PlanTier) => void
  bucket: string
  /* 보여줄 단계 — 프리미엄이 켜진 칸만 둘 */
  tiers: PlanTier[]
  /* 화면에서 고친 체크 — OptionSetup 이 들고 있다(공통 체크가 개별 잠금·미리보기에 바로 비치게) */
  picks: TierPicks
  onPicks: (tier: PlanTier, next: Picks) => void
  custom: CustomOption[] | undefined
  templates: OptionTemplate[]
  /* 공통에서 체크한 템플릿·직접 적은 항목 — 체크된 채 잠가 보여준다 */
  lockedPicks?: TierPicks
  lockedCustom?: CustomOption[]
  disabled?: boolean
  /* 분야 카드 안에 들어가는 칸 — 테두리를 한 겹 덜 쓴다 */
  nested?: boolean
  actions: BucketActions
}) {
  const [error, setError] = useState('')
  const [draft, setDraft] = useState('')
  const [justSaved, setJustSaved] = useState(false)
  const [pending, start] = useActionTransition()
  /* 직접 적은 항목의 단계 체크 — 저장이 끝나 새로 받기 전에도 바로 보이게 */
  const [tierOverride, setTierOverride] = useState<Record<string, CustomTiers>>({})
  const usable = templates.filter((t) => templateAllowsBucket(t, bucket))
  /* 공통이 맡은 템플릿 — 이 목록에서는 잠기고 저장·비교에서 빠진다 */
  const commonIds = lockedPicks ? commonIdsOf(lockedPicks) : new Set<string>()
  const own = usable.filter((t) => !commonIds.has(t.id))
  const list = custom ?? []
  const table = tiers.length > 1

  /* 마지막으로 보낸 목록(단계마다) — 숫자 칸에서 그냥 빠져나가거나 같은 값이면 다시 보내지 않는다 */
  const lastSent = useRef<Record<PlanTier, string>>({
    basic: JSON.stringify(draftOptionsOf(own, picks.basic)),
    premium: JSON.stringify(draftOptionsOf(own, picks.premium)),
  })
  /* 직접 입력이 Enter·포커스 아웃·+ 로 겹쳐 두 번 들어가지 않게 */
  const adding = useRef(false)

  useEffect(() => {
    if (!justSaved) return
    const t = setTimeout(() => setJustSaved(false), SAVED_MS)
    return () => clearTimeout(t)
  }, [justSaved])

  const commit = (tier: PlanTier, next: Picks) => {
    /* 사파리는 체크박스를 눌러도 포커스가 가지 않는다 — 저장할 때도 알린다 */
    onTouch?.(tier)
    const options = draftOptionsOf(own, next)
    const key = JSON.stringify(options)
    if (key === lastSent.current[tier]) return
    lastSent.current[tier] = key
    setError('')
    start(async () => {
      try {
        if (await actions.save(bucket, tier, options)) return setJustSaved(true)
      } catch (err) {
        lastSent.current[tier] = ''
        throw err
      }
      /* 실패하면 같은 값으로 다시 시도할 수 있게 */
      lastSent.current[tier] = ''
    }, `${title} 포함 항목 저장`)
  }

  const tiersOfCustom = (c: CustomOption): CustomTiers => tierOverride[c.id] ?? { basic: c.basic, premium: c.premium }

  const toggleCustom = (c: CustomOption, tier: PlanTier, on: boolean) => {
    onTouch?.(tier)
    const next = { ...tiersOfCustom(c), [tier]: on }
    setTierOverride((o) => ({ ...o, [c.id]: next }))
    setError('')
    start(async () => {
      if (await actions.setTiers(c.id, next)) return setJustSaved(true)
      /* 실패하면 저장된 값으로 되돌린다 */
      setTierOverride((o) => {
        const rest = { ...o }
        delete rest[c.id]
        return rest
      })
    }, `${title} 항목 단계 저장`)
  }

  const add = () => {
    const text = draft.trim()
    if (!text || adding.current) return
    if (text.length > MAX_CUSTOM_TEXT) {
      setError(`항목은 ${MAX_CUSTOM_TEXT}자 이내로 입력해 주세요.`)
      return
    }
    setError('')
    adding.current = true
    start(async () => {
      try {
        /* 표에서는 두 단계 모두에 넣어 둔다 — 빼려면 그 단계 체크를 끈다 */
        if (await actions.add(bucket, text, { basic: true, premium: table })) {
          setDraft('')
          setJustSaved(true)
        }
      } finally {
        adding.current = false
      }
    }, `${title} 항목 추가`)
  }

  const removeButton = (c: CustomOption) =>
    !disabled && (
      <button
        type="button"
        disabled={pending}
        onClick={() => start(async () => void (await actions.remove(c.id, c.text)), `${title} 항목 삭제`)}
        aria-label={`${c.text} 지우기`}
        className="grid size-5 shrink-0 place-items-center rounded text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700"
      >
        ×
      </button>
    )

  return (
    /* 안의 어느 칸이든 포커스가 들어오면(직접 입력 포함) 미리보기를 이 유형으로 옮긴다 —
       표의 단계 칸이면(data-tier) 그 단계 탭까지 */
    <div
      className={nested ? '' : 'rounded-lg border border-neutral-200 p-3.5'}
      onFocus={(e) => {
        const tier = (e.target as HTMLElement).closest('[data-tier]')?.getAttribute('data-tier')
        onTouch?.(tier === 'basic' || tier === 'premium' ? tier : undefined)
      }}
    >
      {heading && (
        <h5
          className={`mb-2 flex items-center gap-1.5 text-xs font-semibold ${disabled ? 'text-neutral-400' : 'text-neutral-800'}`}
        >
          {badge && (
            <span className="shrink-0 rounded border border-neutral-300 bg-white px-1.5 py-px text-[10px] font-medium text-neutral-500">
              {badge}
            </span>
          )}
          {heading}
        </h5>
      )}

      {table ? (
        <TierTable
          tiers={tiers}
          usable={usable}
          picks={picks}
          onPicks={onPicks}
          onCommit={commit}
          lockedPicks={lockedPicks}
          commonIds={commonIds}
          lockedCustom={lockedCustom ?? []}
          custom={list}
          customTiers={tiersOfCustom}
          onCustom={toggleCustom}
          removeButton={removeButton}
          disabled={disabled || pending}
        />
      ) : (
        <>
          <OptionChecklist
            usable={usable}
            picks={picks.basic}
            onChange={(p) => onPicks('basic', p)}
            onCommit={(p) => commit('basic', p)}
            disabled={disabled}
            /* 공통이 맡은 줄 — 숫자는 기본 단계 값으로 보인다 */
            lockedPicks={lockedPicks ? { ...lockedPicks.premium, ...lockedPicks.basic } : undefined}
          />

          {/* 공통에 직접 적은 항목 — 여기서도 잠근 채 보인다 */}
          {lockedCustom && lockedCustom.length > 0 && (
            <div className="mt-1.5 space-y-1.5">
              {lockedCustom.map((c) => (
                <LockedLine key={c.id} text={c.text} />
              ))}
            </div>
          )}

          {/* 직접 적은 항목 — 이 목록에만 들어간다. 체크를 끄면 남겨 둔 채 공개 화면에서 뺀다 */}
          {list.length > 0 && (
            <ul className="mt-1.5 space-y-1.5">
              {list.map((c) => (
                <li key={c.id} className="flex items-center gap-1.5 text-xs text-neutral-700">
                  <input
                    type="checkbox"
                    checked={tiersOfCustom(c).basic}
                    disabled={disabled || pending}
                    onChange={(e) => toggleCustom(c, 'basic', e.target.checked)}
                    aria-label={c.text}
                    className="accent-violet-600"
                  />
                  <span className="min-w-0 break-words">{c.text}</span>
                  {removeButton(c)}
                </li>
              ))}
            </ul>
          )}
        </>
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
            /* 적어 두고 다른 곳을 누르면 그대로 더한다 */
            onBlur={add}
            maxLength={MAX_CUSTOM_TEXT}
            placeholder="직접 입력"
            aria-label={`${title} 항목 직접 입력`}
            className="h-8 min-w-0 flex-1 rounded-md border border-neutral-300 bg-white px-2.5 text-xs outline-none ring-violet-500 focus:ring-2"
          />
          <button
            type="button"
            disabled={pending || !draft.trim()}
            /* 누르는 순간 입력칸의 포커스 아웃이 먼저 더한다 — 여기서는 겹치지 않게만(adding) */
            onClick={add}
            aria-label="항목 더하기"
            className="grid size-8 shrink-0 place-items-center rounded-md border border-neutral-300 text-base text-neutral-700 transition hover:bg-neutral-100 disabled:opacity-40"
          >
            +
          </button>
        </div>
      )}

      {error && <p className="mt-2 text-[11px] text-red-600">{error}</p>}
      {/* 저장 상태 — 자리를 미리 잡아 두어 글자가 생겼다 사라져도 아래가 들썩이지 않는다 */}
      {!disabled && (
        <p aria-live="polite" className="mt-1.5 h-4 text-[11px] text-neutral-400">
          {pending ? '저장 중…' : justSaved ? '저장됨 ✓' : ''}
        </p>
      )}
    </div>
  )
}

/* 표 한 줄 — 좁으면 두 단계 칸만 두 열(항목 이름은 위에 한 줄로), 넓으면(20rem~) 항목 | STANDARD | PREMIUM */
const ROW =
  'grid grid-cols-2 items-center gap-x-2 gap-y-1 border-b border-neutral-100 py-1.5 @min-[20rem]:grid-cols-[minmax(0,1fr)_5.5rem_5.5rem]'
/* 항목 이름 칸 — 좁으면 한 줄을 다 쓴다 */
const LABEL = 'col-span-2 min-w-0 @min-[20rem]:col-span-1 @min-[20rem]:pr-2'
/* 줄 끝까지 — 숫자 안내 문구 */
const FULL = 'col-span-2 @min-[20rem]:col-span-3'

/* STANDARD·PREMIUM 표 — 줄은 항목 하나, 열은 단계. 칸마다 체크와 (필요하면) 숫자.
   크몽 패키지 입력처럼 두 단계를 나란히 놓고 차이만 다르게 적는다.
   공통이 맡은 줄은 공통 값 그대로 잠겨 보인다 — 누르면 어디서 바꾸는지 알린다 */
function TierTable({
  tiers,
  usable,
  picks,
  onPicks,
  onCommit,
  lockedPicks,
  commonIds,
  lockedCustom,
  custom,
  customTiers,
  onCustom,
  removeButton,
  disabled,
}: {
  tiers: PlanTier[]
  usable: OptionTemplate[]
  picks: TierPicks
  onPicks: (tier: PlanTier, next: Picks) => void
  onCommit: (tier: PlanTier, next: Picks) => void
  lockedPicks?: TierPicks
  commonIds: Set<string>
  lockedCustom: CustomOption[]
  custom: CustomOption[]
  customTiers: (c: CustomOption) => CustomTiers
  onCustom: (c: CustomOption, tier: PlanTier, on: boolean) => void
  removeButton: (c: CustomOption) => React.ReactNode
  disabled?: boolean
}) {
  if (usable.length === 0 && custom.length === 0 && lockedCustom.length === 0) {
    return <p className="text-[11px] text-neutral-400">이 플랜에서 고를 수 있는 항목이 없습니다.</p>
  }

  /* 잠긴 칸 — 공통에서 그 단계에 체크했는지와 숫자만 보여준다 */
  const lockedMark = (on: boolean, n?: string) => (
    <span className={`text-xs ${on ? 'font-semibold text-violet-500' : 'text-neutral-300'}`}>
      {on ? (n?.trim() ? `✓ ${n.trim()}` : '✓') : '—'}
    </span>
  )

  return (
    /* 칸 폭에 따라 두 모양 — 넓으면 [항목 | STANDARD | PREMIUM] 한 줄, 좁으면(분야 카드를
       한 줄에 여럿 늘어놓은 PC 화면) 항목 이름을 위에 두고 두 단계 칸을 그 아래에 */
    <div role="table" className="@container text-xs">
      <div role="row" className={`${ROW} border-neutral-200 pt-0 text-[10px] tracking-wide`}>
        <span role="columnheader" className="hidden font-medium text-neutral-400 @min-[20rem]:block">
          항목
        </span>
        {tiers.map((t) => (
          <span
            key={t}
            role="columnheader"
            className={`text-center font-semibold ${t === 'premium' ? 'text-violet-700' : 'text-neutral-600'}`}
          >
            {TIER_LABEL[t]}
          </span>
        ))}
      </div>

      {usable.map((t) => {
        const label = needsN(t.template) ? t.template.replaceAll(N_TOKEN, 'n') : t.template
        if (commonIds.has(t.id)) {
          return (
            <div key={t.id} role="row" className={`${ROW} text-neutral-500`}>
              <span role="rowheader" className={LABEL}>
                <button
                  type="button"
                  onClick={() => window.alert(COMMON_LOCK_ALERT)}
                  className="flex w-full items-center gap-1.5 text-left"
                >
                  <span className="min-w-0 break-words">{label}</span>
                  <span className="shrink-0 rounded bg-violet-50 px-1.5 py-0.5 text-[10px] font-medium text-violet-500">
                    공통
                  </span>
                </button>
              </span>
              {tiers.map((tier) => (
                <span key={tier} role="cell" className="text-center">
                  {lockedMark(t.id in (lockedPicks?.[tier] ?? {}), lockedPicks?.[tier][t.id])}
                </span>
              ))}
            </div>
          )
        }
        const missing = tiers.filter((tier) => t.id in picks[tier] && needsN(t.template) && badN(picks[tier][t.id]))
        return (
          <div key={t.id} role="row" className={ROW}>
            <span role="rowheader" className={`${LABEL} text-neutral-700`}>
              <span className="break-words">{label}</span>
              {/* 어드민이 이 디자이너에게만 만들어 준 항목 */}
              {t.designerId && (
                <span className="ml-1.5 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                  전용
                </span>
              )}
            </span>
            {tiers.map((tier) => {
              const on = t.id in picks[tier]
              const p = picks[tier]
              return (
                <span key={tier} role="cell" data-tier={tier} className="flex items-center justify-center gap-1">
                  <input
                    type="checkbox"
                    checked={on}
                    disabled={disabled}
                    aria-label={`${optionText(t.template, null)} ${TIER_LABEL[tier]}`}
                    onChange={(e) => {
                      const next = { ...p }
                      if (e.target.checked) next[t.id] = ''
                      else delete next[t.id]
                      onPicks(tier, next)
                      onCommit(tier, next)
                    }}
                    className="accent-violet-600"
                  />
                  {needsN(t.template) && (
                    <input
                      type="number"
                      inputMode="numeric"
                      aria-label={`${t.template} ${TIER_LABEL[tier]} 숫자`}
                      value={p[t.id] ?? ''}
                      disabled={disabled || !on}
                      onChange={(e) => onPicks(tier, { ...p, [t.id]: e.target.value })}
                      onBlur={() => onCommit(tier, p)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') e.currentTarget.blur()
                      }}
                      min={0}
                      max={MAX_OPTION_N}
                      placeholder="n"
                      className={`h-7 w-11 rounded-md border bg-white px-1.5 text-xs outline-none ring-violet-500 focus:ring-2 disabled:bg-neutral-50 ${
                        missing.includes(tier) ? 'border-red-400' : 'border-neutral-300'
                      }`}
                    />
                  )}
                </span>
              )
            })}
            {missing.length > 0 && (
              <span role="cell" className={`${FULL} text-right text-[10px] text-red-600`}>
                {missing.map((tier) => TIER_LABEL[tier]).join('·')} 숫자값을 입력해야 화면에 노출됩니다.
              </span>
            )}
          </div>
        )
      })}

      {/* 공통에 직접 적은 항목 — 공통 값 그대로 잠겨 보인다 */}
      {lockedCustom.map((c) => (
        <div key={c.id} role="row" className={`${ROW} text-neutral-500`}>
          <span role="rowheader" className={LABEL}>
            <button
              type="button"
              onClick={() => window.alert(COMMON_LOCK_ALERT)}
              className="flex w-full items-center gap-1.5 text-left"
            >
              <span className="min-w-0 break-words">{c.text}</span>
              <span className="shrink-0 rounded bg-violet-50 px-1.5 py-0.5 text-[10px] font-medium text-violet-500">
                공통
              </span>
            </button>
          </span>
          {tiers.map((tier) => (
            <span key={tier} role="cell" className="text-center">
              {lockedMark(c[tier])}
            </span>
          ))}
        </div>
      ))}

      {/* 직접 적은 항목 — 이 목록에만. 단계마다 넣을지 고른다 */}
      {custom.map((c) => {
        const cur = customTiers(c)
        return (
          <div key={c.id} role="row" className={ROW}>
            <span role="rowheader" className={`${LABEL} flex items-center gap-1 text-neutral-700`}>
              <span className="min-w-0 break-words">{c.text}</span>
              {removeButton(c)}
            </span>
            {tiers.map((tier) => (
              <span key={tier} role="cell" data-tier={tier} className="flex justify-center">
                <input
                  type="checkbox"
                  checked={cur[tier]}
                  disabled={disabled}
                  aria-label={`${c.text} ${TIER_LABEL[tier]}`}
                  onChange={(e) => onCustom(c, tier, e.target.checked)}
                  className="accent-violet-600"
                />
              </span>
            ))}
          </div>
        )
      })}
    </div>
  )
}
