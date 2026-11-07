'use client'

import { useEffect, useRef, useState, useTransition, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { AdminDesigner } from '@/lib/designer-shape'
import { MAX_BIO } from '@/lib/portfolio-limits'
import {
  formatPrice,
  formatPriceRange,
  DESIGN_PRICES,
  DEFAULT_PRICE_MAX,
  MIN_PRICE_MAX,
  MAX_PRICE_MAX,
  MIN_CONTRACT_PRICE,
  MAX_CONTRACT_PRICE,
  DEFAULT_FULL_DESIGN_PRICE,
  DEFAULT_PROJECT_PRICE,
  type DesignerOptionSetup,
  type DesignerPremiums,
  type DesignerPlanDetails,
  type DesignerPlanOptions,
  type OptionTemplate,
  type PlanCopies,
} from '@/lib/plans'
import { SCOPES, SCOPE_LABELS, type Scope } from '@/lib/scopes'
import { displayName, NAME_MAX, nameError } from '@/lib/display-name'
import {
  updateDesigner,
  setDesignerVisible,
  setDesignerProfilePublic,
  resetPassword,
  deleteDesigner,
  setDesignerPrices,
  setDesignerPremiums,
  setDesignerScope,
  setDesignerAvatar,
  removeDesignerAvatar,
} from '@/app/admin/designers/actions'
import { Img } from '@/components/img'
import { Field, input, ghostButton } from './form-bits'
import { SpecialtyPicker } from './specialty-picker'
import type { SpecialtyOption } from '@/lib/specialty-shape'
import { DESIGNER_TABS, type DesignerTab } from './designer-tabs'
import { PlanSetup, type SetupSlot } from '@/components/plan-setup'
import { OptionSetup } from '@/components/option-setup'
import { optionCategories, type CategoryMeta } from '@/lib/inquiry-choices'
import { OptionTemplateManager } from './option-template-manager'
import { Flash } from '@/components/flash'

type Notice = { kind: 'ok' | 'warn' | 'error'; text: string } | null

/* 받침에 따라 '을'/'를' — '상한을', '최소가를'. 한글이 아니면 '를' */
function eulReul(word: string) {
  const c = word.charCodeAt(word.length - 1) - 0xac00
  return c >= 0 && c <= 11171 && c % 28 !== 0 ? '을' : '를'
}

export function DesignerDetail({
  tab,
  designer: d,
  specialties,
  premiums,
  premiumOn,
  copies,
  planDetails,
  templates,
  planOptions,
  metas,
  optionSetup,
  portfolio,
}: {
  /* 지금 탭 — 주소의 ?tab= 에서 온다(designer-tabs.ts) */
  tab: DesignerTab
  /* 포트폴리오 탭 내용 — 서버에서 그린 것(AdminPortfolio)을 그대로 끼운다 */
  portfolio: ReactNode
  /* 전체 공통 플랜 문구·기간·포함 항목과 이 디자이너의 덮어쓰기(037_plan_details.sql) */
  copies: PlanCopies
  planDetails: DesignerPlanDetails
  /* 포함 항목 템플릿과 이 디자이너가 플랜마다 등록한 것 */
  templates: OptionTemplate[]
  planOptions: DesignerPlanOptions
  /* 분야 전부(분야별 포함 항목 칸)와 기본 단계 포함 항목 — 공통·분야별(0004). null 이면 0004 전 */
  metas: CategoryMeta[]
  optionSetup: DesignerOptionSetup | null
  designer: AdminDesigner
  /* 전문 분야 선택지 — 숨긴 분야까지 전부, 메뉴 노출 분야가 앞 */
  specialties: SpecialtyOption[]
  /* 유형별 프리미엄 — 디자이너마다 켜짐과 금액, 어드민만 정한다(036_plan_copy_premium.sql) */
  premiums: DesignerPremiums
  /* 설정에서 프리미엄을 켠 유형 — 켜진 유형만 디자이너별로 켤 수 있다 */
  premiumOn: Record<Scope, boolean>
}) {
  const [notice, setNotice] = useState<Notice>(null)

  return (
    <div className="min-w-0 space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-4">
          <AvatarImage designer={d} size="size-14" />
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight">{displayName(d)}</h1>
            <p className="mt-1 text-sm text-neutral-500">{d.email}</p>

            {/* 공개 페이지로 — 숨겨져 있으면 열어도 404 라 이유를 대신 보여준다 */}
            {d.visible && d.profile_public ? (
              <Link
                href={`/designers/${d.id}`}
                target="_blank"
                rel="noopener"
                className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-violet-600 transition hover:text-violet-800"
              >
                공개 페이지 보기 ↗
              </Link>
            ) : (
              <p className="mt-2 text-xs text-neutral-400">
                {!d.visible
                  ? '계정이 비활성이라 공개 페이지가 열리지 않습니다.'
                  : '프로필이 숨김 상태라 공개 페이지가 열리지 않습니다.'}
              </p>
            )}

            {/* 상세 페이지 미리보기 — 공개 페이지와 같은 화면을 공개 여부와 상관없이
                연다(/designers/[id]/preview, 어드민만). 공개 전에도 확인할 수 있어야
                하므로 위 조건 바깥에 둔다. */}
            <Link
              href={`/designers/${d.id}/preview`}
              target="_blank"
              rel="noopener"
              className="mt-1.5 flex w-fit items-center gap-1 text-sm font-medium text-violet-600 transition hover:text-violet-800"
            >
              상세 페이지 미리보기 ↗
            </Link>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {/* 두 상태는 축이 다르다 — 계정은 관리자만, 프로필은 관리자와 디자이너 본인이 정한다 */}
          <span
            className={`rounded px-2 py-1 text-[11px] font-medium ${
              d.visible ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
            }`}
          >
            계정 {d.visible ? '활성' : '비활성'}
          </span>
          <span
            className={`rounded px-2 py-1 text-[11px] font-medium ${
              d.profile_public
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-neutral-200 text-neutral-600'
            }`}
            title="관리자와 디자이너 본인이 바꿀 수 있습니다"
          >
            프로필 {d.profile_public ? '노출' : '숨김'}
          </span>
          <ProfilePublicButton designer={d} onNotice={setNotice} />
          <VisibleButton designer={d} onNotice={setNotice} />
        </div>
      </header>

      <Flash msg={notice} onDone={() => setNotice(null)} />

      {/* 탭 줄 — 링크라서 주소가 바뀐다. 페이지가 탭마다 key 를 바꿔 새로 그리므로
          알림 문구는 다음 탭으로 넘어가지 않는다 */}
      <nav aria-label="디자이너 관리" className="flex gap-1 border-b border-neutral-200">
        {DESIGNER_TABS.map((t) => {
          const on = t.key === tab
          return (
            <Link
              key={t.key}
              href={t.key === 'profile' ? `/admin/designers/${d.id}` : `?tab=${t.key}`}
              aria-current={on ? 'page' : undefined}
              scroll={false}
              className={`-mb-px border-b-2 px-3.5 py-2.5 text-sm font-medium transition ${
                on
                  ? 'border-violet-600 text-violet-700'
                  : 'border-transparent text-neutral-500 hover:text-neutral-900'
              }`}
            >
              {t.label}
            </Link>
          )
        })}
      </nav>

      {tab === 'profile' && (
        <div className="max-w-2xl space-y-6">
          <AvatarSection designer={d} onNotice={setNotice} />
          <ProfileForm designer={d} specialties={specialties} onNotice={setNotice} />
          <AccountSection designer={d} onNotice={setNotice} />
        </div>
      )}

      {tab === 'portfolio' && portfolio}

      {/* 설정 — 왼쪽 가격 플랜(기본·프리미엄), 오른쪽 받을 의뢰 유형.
          좁은 화면에서는 의뢰 유형이 아래로 내려간다 */}
      {tab === 'settings' && (
        <div className="grid max-w-5xl items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="min-w-0 space-y-6">
            <PlanSummary
              designer={d}
              premiums={premiums}
              premiumOn={premiumOn}
              onNotice={setNotice}
            />
            {/* 이 디자이너만 쓰는 문장 — 어드민만 만든다. 만든 것은 아래 등록 목록에 함께 나온다 */}
            <OptionTemplateManager
              templates={templates.filter((t) => t.designerId === d.id)}
              copies={copies}
              designerId={d.id}
            />
            {/* 기본 단계 포함 항목 — 공통 또는 분야별. 고르지 않은 분야도 미리 채워 둘 수 있다 */}
            <OptionSetup
              mode="admin"
              designerId={d.id}
              setup={optionSetup}
              categories={optionCategories(d, metas, copies)}
              templates={templates}
            />
            {/* 작업 기간은 받지 않는 유형도 미리 채워 둘 수 있게 전부. 로고는 분야가 맡아 뺐다.
                프리미엄(포함 항목까지)은 설정에서 켠 플랜만 */}
            <PlanSetup
              mode="admin"
              designerId={d.id}
              slots={SCOPES.filter((s) => s !== 'logo').flatMap((s): SetupSlot[] => [
                { scope: s, tier: 'basic' },
                ...(premiumOn[s] ? [{ scope: s, tier: 'premium' as const }] : []),
              ])}
              copies={copies}
              templates={templates}
              registered={planOptions}
              details={planDetails}
            />
          </div>
          <ScopeSection designer={d} onNotice={setNotice} />
        </div>
      )}
    </div>
  )
}

/* ─────────── 가격 ─────────── */

/* 금액 — 의뢰 유형 넷이 같은 모양으로 한 줄씩. 받을 유형은 옆의 ScopeSection.
   메인 시안·로고 시작가는 디자이너가 고르고(시안은 어드민도 바꿀 수 있다),
   시안 상한·디자인 전체·프로젝트 최소가·프리미엄 금액은 어드민만 정한다.
   이름·설명은 설정 화면에서 고친다.

   저장 버튼이 없다 — 칸마다 바꾸고 벗어나면(선택 상자는 고르면) 확인을 받고
   바로 저장한다. 취소하면 저장된 값으로 되돌린다. 여러 칸을 고쳐 놓고
   저장을 잊는 일이 없게. */
function PlanSummary({
  designer: d,
  premiums,
  premiumOn,
  onNotice,
}: {
  designer: AdminDesigner
  premiums: DesignerPremiums
  premiumOn: Record<Scope, boolean>
  onNotice: (n: Notice) => void
}) {
  /* 035 전에는 칸이 없어 undefined 로 온다 — 기본값으로 보여준다 */
  const fullNow = d.full_design_price ?? DEFAULT_FULL_DESIGN_PRICE
  const projectNow = d.project_price ?? DEFAULT_PROJECT_PRICE

  const [priceMax, setPriceMax] = useState(String(d.price_max))
  const [fullPrice, setFullPrice] = useState(String(fullNow))
  const [projectPrice, setProjectPrice] = useState(String(projectNow))
  /* 프리미엄 — 유형마다 켜짐과 금액. 꺼도 금액은 남겨 둔다(다시 켤 때 다시 적지 않게) */
  const premiumNow = (s: Scope) => ({
    on: premiums[s]?.enabled ?? false,
    price: premiums[s] ? String(premiums[s].price) : '',
  })
  const [premium, setPremium] = useState<Record<Scope, { on: boolean; price: string }>>(() => ({
    sample: premiumNow('sample'),
    logo: premiumNow('logo'),
    full_design: premiumNow('full_design'),
    with_dev: premiumNow('with_dev'),
  }))
  const setPremiumOf = (s: Scope, patch: Partial<{ on: boolean; price: string }>) =>
    setPremium((p) => ({ ...p, [s]: { ...p[s], ...patch } }))
  const [pending, start] = useTransition()
  const router = useRouter()

  /* 한 칸 저장 — 실패하면 화면 값을 저장된 값으로 되돌린다 */
  const commit = (
    run: () => Promise<{ ok: true } | { ok: false; error: string }>,
    done: string,
    revert: () => void,
  ) => {
    onNotice(null)
    start(async () => {
      const r = await run()
      if (!r.ok) {
        revert()
        onNotice({ kind: 'error', text: r.error })
        return
      }
      router.refresh()
      onNotice({ kind: 'ok', text: done })
    })
  }

  /* 직접 적는 금액 칸 — 바뀌었을 때만 묻는다 */
  const commitPrice = (
    label: string,
    value: string,
    saved: number,
    reset: (v: string) => void,
    patch: (n: number) => Parameters<typeof setDesignerPrices>[1],
  ) => {
    const n = Number(value)
    if (value.trim() === String(saved)) return
    if (!value.trim() || !Number.isFinite(n)) {
      reset(String(saved))
      onNotice({ kind: 'error', text: `${label}${eulReul(label)} 숫자로 적어 주세요.` })
      return
    }
    if (!window.confirm(`${label}${eulReul(label)} ${formatPrice(n)}으로 바꿀까요?`)) {
      reset(String(saved))
      return
    }
    commit(
      () => setDesignerPrices(d.id, patch(n)),
      `${label}${eulReul(label)} ${formatPrice(n)}으로 바꿨습니다.`,
      () => reset(String(saved)),
    )
  }

  /* 프리미엄 한 유형 저장 */
  const commitPremium = (s: Scope, next: { on: boolean; price: string }, question: string, done: string) => {
    const before = premiumNow(s)
    if (!window.confirm(question)) {
      setPremiumOf(s, before)
      return
    }
    setPremiumOf(s, next)
    commit(
      () =>
        setDesignerPremiums(d.id, {
          [s]: { enabled: next.on, price: next.price.trim() ? Number(next.price) : null },
        }),
      done,
      () => setPremiumOf(s, before),
    )
  }

  const togglePremium = (s: Scope, on: boolean) => {
    const label = `${SCOPE_LABELS[s]} 프리미엄`
    const price = premium[s].price.trim()
    if (!on) {
      commitPremium(s, { on: false, price }, `${label}${eulReul(label)} 끌까요?`, `${label}${eulReul(label)} 껐습니다.`)
      return
    }
    /* 금액이 없으면 칸만 열어 둔다 — 금액을 적고 벗어날 때 묻는다 */
    if (!price) {
      setPremiumOf(s, { on: true })
      return
    }
    commitPremium(
      s,
      { on: true, price },
      `${label}${eulReul(label)} ${formatPrice(Number(price))}으로 켤까요?`,
      `${label}${eulReul(label)} 켰습니다.`,
    )
  }

  const blurPremium = (s: Scope) => {
    const label = `${SCOPE_LABELS[s]} 프리미엄`
    const cur = premium[s]
    const saved = premiumNow(s)
    const price = cur.price.trim()
    if (cur.on === saved.on && price === saved.price) return

    /* 켜 놓고 금액을 비우면 — 프리미엄을 끄고 금액도 지운다 */
    if (!price) {
      commitPremium(
        s,
        { on: false, price: '' },
        `${label} 금액을 비울까요? 프리미엄도 꺼집니다.`,
        `${label}${eulReul(label)} 껐습니다.`,
      )
      return
    }
    if (!Number.isFinite(Number(price))) {
      setPremiumOf(s, saved)
      onNotice({ kind: 'error', text: `${label} 금액을 숫자로 적어 주세요.` })
      return
    }
    commitPremium(
      s,
      { on: cur.on, price },
      `${label}${eulReul(label)} ${formatPrice(Number(price))}으로 ${saved.on ? '바꿀까요' : '켤까요'}?`,
      `${label}${eulReul(label)} ${formatPrice(Number(price))}으로 저장했습니다.`,
    )
  }

  /* 요약 — 유형마다 받는지, 기본 금액, 프리미엄 금액 */
  const rows: { s: Scope; on: boolean; base: string }[] = [
    { s: 'sample', on: d.scope_sample, base: formatPriceRange(d.design_price, d.price_max) },
    /* 고객이 선택하는 분야(web/app)의 디자인 의뢰 — 로고는 분야가 맡아 줄에서 뺐다 */
    { s: 'full_design', on: true, base: `${formatPrice(fullNow)}~` },
    { s: 'with_dev', on: true, base: `${formatPrice(projectNow)}~` },
  ]

  return (
    <section className="rounded-xl bg-white p-5 ring-1 ring-neutral-200">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold">가격 플랜</h2>
        <Link
          href="/admin/settings"
          className="text-xs font-medium text-violet-600 transition hover:text-violet-800"
        >
          문구·프리미엄 설정 →
        </Link>
      </div>

      <dl className="mt-3 space-y-2 text-sm">
        {rows.map(({ s, on, base }) => (
          <div key={s} className="flex items-baseline justify-between gap-2">
            <dt className="text-neutral-500">{SCOPE_LABELS[s]}</dt>
            <dd className="flex flex-wrap items-center justify-end gap-1.5 text-right">
              {!on && (
                <span className="rounded bg-neutral-200 px-1.5 py-0.5 text-[11px] text-neutral-600">
                  안 받음
                </span>
              )}
              <span className={on ? 'font-medium' : 'text-neutral-400'}>{base}</span>
              {/* 디자이너별로 켠 프리미엄 — 설정에서 꺼져 있으면 나가지 않으므로 흐리게 */}
              {premiums[s]?.enabled && (
                <span
                  title={premiumOn[s] ? undefined : '설정에서 이 유형의 프리미엄이 꺼져 있어 나가지 않습니다'}
                  className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${
                    premiumOn[s] ? 'bg-violet-100 text-violet-700' : 'bg-neutral-100 text-neutral-400'
                  }`}
                >
                  P {formatPrice(premiums[s]!.price)}~
                </span>
              )}
            </dd>
          </div>
        ))}
      </dl>

      <div className="mt-4 space-y-3 border-t border-neutral-200 pt-4">
        <p className="text-[11px] text-neutral-400">
          칸을 고치고 벗어나면 저장할지 묻습니다.{pending && ' 저장 중…'}
        </p>

        <label className="block">
          <span className="mb-1.5 flex items-baseline justify-between text-xs font-medium text-neutral-600">
            메인 시안 시작가
            <span className="font-normal text-neutral-400">디자이너도 수정</span>
          </span>
          {/* 선택 상자는 고르는 순간 묻는다 — 취소하면 저장된 값이 그대로 남는다(제어 값) */}
          <select
            value={d.design_price}
            disabled={pending}
            onChange={(e) => {
              const n = Number(e.target.value)
              if (!window.confirm(`메인 시안 시작가를 ${formatPrice(n)}으로 바꿀까요?`)) return
              commit(
                () => setDesignerPrices(d.id, { designPrice: n }),
                `메인 시안 시작가를 ${formatPrice(n)}으로 바꿨습니다.`,
                () => {},
              )
            }}
            className="h-9 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm outline-none ring-violet-500 focus:ring-2 disabled:opacity-60"
          >
            {DESIGN_PRICES.map((p) => (
              <option key={p} value={p}>
                {formatPrice(p)}
              </option>
            ))}
          </select>
        </label>

        <PriceInput
          label="메인 시안 가격 상한"
          value={priceMax}
          onChange={setPriceMax}
          onCommit={() =>
            commitPrice('메인 시안 가격 상한', priceMax, d.price_max, setPriceMax, (n) => ({ priceMax: n }))
          }
          min={MIN_PRICE_MAX}
          max={MAX_PRICE_MAX}
          help={`올려 두면 디자이너가 더 높은 시작가를 고를 수 있습니다. 기본 ${formatPrice(DEFAULT_PRICE_MAX)}.`}
        />
        <PriceInput
          label="디자인 전체 최소가"
          value={fullPrice}
          onChange={setFullPrice}
          onCommit={() =>
            commitPrice('디자인 전체 최소가', fullPrice, fullNow, setFullPrice, (n) => ({
              fullDesignPrice: n,
            }))
          }
          min={MIN_CONTRACT_PRICE}
          max={MAX_CONTRACT_PRICE}
          help={`상세 카드와 의뢰 폼에 "N원~" 으로 나갑니다. 기본 ${formatPrice(DEFAULT_FULL_DESIGN_PRICE)}.`}
        />
        <PriceInput
          label="프로젝트 최소가"
          value={projectPrice}
          onChange={setProjectPrice}
          onCommit={() =>
            commitPrice('프로젝트 최소가', projectPrice, projectNow, setProjectPrice, (n) => ({
              projectPrice: n,
            }))
          }
          min={MIN_CONTRACT_PRICE}
          max={MAX_CONTRACT_PRICE}
          help={`기본 ${formatPrice(DEFAULT_PROJECT_PRICE)}.`}
        />

        {/* 프리미엄 — 유형마다 켜고 금액을 넣는다. 설정에서 그 유형의 프리미엄을
            켜 둬야 여기서 켤 수 있다. 둘 다 켜져야 공개 화면에 나간다. */}
        <div className="rounded-lg border border-violet-200 bg-violet-50/40 p-3">
          <p className="text-xs font-semibold text-violet-800">프리미엄</p>
          <p className="mt-1 text-[11px] leading-relaxed text-neutral-500">
            설정에서 프리미엄을 켠 유형만 켤 수 있습니다. 꺼도 금액은 남아 있습니다.
          </p>
          <div className="mt-3 space-y-2.5">
            {SCOPES.filter((s) => s !== 'logo').map((s) => {
              const allowed = premiumOn[s]
              const on = premium[s].on
              return (
                <div key={s} className="flex items-center justify-between gap-3">
                  <label
                    className={`flex min-w-0 items-center gap-2 text-xs ${
                      allowed ? 'cursor-pointer text-neutral-700' : 'text-neutral-400'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      /* 설정에서 꺼진 유형은 켤 수 없다 — 이미 켜져 있으면 끌 수는 있다 */
                      disabled={pending || (!allowed && !on)}
                      onChange={(e) => togglePremium(s, e.target.checked)}
                      className="shrink-0 accent-violet-600"
                    />
                    <span className="truncate">{SCOPE_LABELS[s]}</span>
                    {!allowed && <span className="shrink-0 text-[11px]">· 설정에서 꺼짐</span>}
                  </label>
                  <input
                    type="number"
                    inputMode="numeric"
                    aria-label={`${SCOPE_LABELS[s]} 프리미엄 금액`}
                    value={premium[s].price}
                    onChange={(e) => setPremiumOf(s, { price: e.target.value })}
                    onBlur={() => blurPremium(s)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') e.currentTarget.blur()
                    }}
                    disabled={!on || pending}
                    min={MIN_CONTRACT_PRICE}
                    max={MAX_CONTRACT_PRICE}
                    step={1000}
                    placeholder={on ? '금액' : '—'}
                    className="h-9 w-32 shrink-0 rounded-lg border border-neutral-300 bg-white px-3 text-sm outline-none ring-violet-500 focus:ring-2 disabled:bg-neutral-50 disabled:text-neutral-400"
                  />
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}

/* 받을 의뢰 유형 — 누르면 확인을 받고 바로 저장한다(저장 버튼 없음).

   메인화면 시안은 어드민만 켜고 끈다(0004) — 디자이너 화면에서는 켜진 채 잠겨 있다.
   디자인·프로젝트는 디자이너 본인도 스튜디오에서 바꾼다 — 여기서는 대신 바꿔 준다.
   고객이 선택하는 분야(web/app)는 둘 중 하나는 켜져 있어야 한다. */
const SCOPE_HELP: Record<Scope, string> = {
  sample: '메인화면 시안만 먼저 받는 의뢰입니다. 관리자만 바꿀 수 있습니다.',
  logo: '로고 디자인 의뢰입니다. 디자이너 본인도 바꿀 수 있습니다.',
  full_design: 'web/app 처럼 고객이 범위를 고르는 분야의 디자인 의뢰입니다. 디자이너 본인도 바꿀 수 있습니다.',
  with_dev: 'web/app 처럼 고객이 범위를 고르는 분야의 개발 포함 의뢰입니다. 디자이너 본인도 바꿀 수 있습니다.',
}

function ScopeSection({
  designer: d,
  onNotice,
}: {
  designer: AdminDesigner
  onNotice: (n: Notice) => void
}) {
  const [pending, start] = useTransition()
  const router = useRouter()

  /* 로고는 분야가 맡고, 디자인·프로젝트는 고객이 고르는 옵션이라 늘 받는다 — 메인 시안만 켜고 끈다 */
  const TOGGLES = ['sample'] as const
  const current: Record<(typeof TOGGLES)[number], boolean> = {
    sample: d.scope_sample,
  }

  const toggle = (scope: Scope, on: boolean) => {
    /* 취소하면 체크가 그대로 남는다 — checked 가 저장된 값(d)을 따른다 */
    const ok = window.confirm(
      on
        ? `이 디자이너가 ${SCOPE_LABELS[scope]}${eulReul(SCOPE_LABELS[scope])} 받도록 열까요?`
        : `이 디자이너의 ${SCOPE_LABELS[scope]}${eulReul(SCOPE_LABELS[scope])} 닫을까요?`,
    )
    if (!ok) return
    start(async () => {
      onNotice(null)
      const r = await setDesignerScope(d.id, scope, on)
      if (!r.ok) {
        onNotice({ kind: 'error', text: r.error })
        return
      }
      router.refresh()
      onNotice({
        kind: 'ok',
        text: `${SCOPE_LABELS[scope]}${eulReul(SCOPE_LABELS[scope])} ${on ? '받도록 열었습니다' : '닫았습니다'}.`,
      })
    })
  }

  return (
    <section className="rounded-xl bg-white p-5 ring-1 ring-neutral-200">
      <h2 className="text-sm font-semibold">의뢰 유형</h2>
      <p className="mt-1 text-xs leading-relaxed text-neutral-500">
        분야를 고르면 그 분야의 의뢰는 받습니다 — web/app 의 디자인·프로젝트는 고객이 의뢰할 때
        고르는 옵션입니다. 여기서는 메인화면 시안 의뢰만 켜고 끕니다.
      </p>

      {TOGGLES.map((s) => (
        <ScopeCheck
          key={s}
          label={SCOPE_LABELS[s]}
          help={SCOPE_HELP[s]}
          checked={current[s]}
          disabled={pending}
          onChange={(on) => toggle(s, on)}
        />
      ))}
    </section>
  )
}

/* 어드민이 직접 적는 금액 칸 — 터무니없는 값은 서버가 막는다 */
function PriceInput({
  label,
  value,
  onChange,
  onCommit,
  min,
  max,
  help,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  /* 칸을 벗어날 때 — 바뀌었으면 저장할지 묻는다 */
  onCommit: () => void
  min: number
  max: number
  help: string
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-baseline justify-between text-xs font-medium text-neutral-600">
        {label}
        <span className="font-normal text-neutral-400">어드민만 수정</span>
      </span>
      <input
        type="number"
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onCommit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
        }}
        min={min}
        max={max}
        step={1000}
        className="h-9 w-full rounded-lg border border-neutral-300 px-3 text-sm outline-none ring-violet-500 focus:ring-2"
      />
      <span className="mt-1.5 block text-xs leading-relaxed text-neutral-400">{help}</span>
    </label>
  )
}

function ScopeCheck({
  label,
  help,
  checked,
  disabled,
  onChange,
}: {
  label: string
  help: string
  checked: boolean
  disabled: boolean
  onChange: (on: boolean) => void
}) {
  return (
    <label className="mt-2.5 flex cursor-pointer items-start gap-2.5">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 shrink-0 accent-violet-600"
      />
      <span className="min-w-0">
        <span className="block text-sm font-medium">{label}</span>
        <span className="mt-0.5 block text-xs leading-relaxed text-neutral-500">{help}</span>
      </span>
    </label>
  )
}

/* ─────────── 프로필 수정 ─────────── */

function ProfileForm({
  designer: d,
  specialties,
  onNotice,
}: {
  designer: AdminDesigner
  specialties: SpecialtyOption[]
  onNotice: (n: Notice) => void
}) {
  const [email, setEmail] = useState(d.email)
  const [name, setName] = useState(d.name ?? '')
  const [oneLiner, setOneLiner] = useState(d.one_liner ?? '')
  const [bio, setBio] = useState(d.bio ?? '')
  const [tags, setTags] = useState(d.tags)
  const [pending, start] = useTransition()
  const router = useRouter()

  /* 저장 버튼을 누를 수 있는지 — 바뀐 것이 없으면 누를 이유가 없다 */
  const dirty =
    email !== d.email ||
    name !== (d.name ?? '') ||
    oneLiner !== (d.one_liner ?? '') ||
    bio !== (d.bio ?? '') ||
    tags.join(', ') !== d.tags.join(', ')

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    onNotice(null)
    /* 바꿀 때만 본다 — 규칙 이전에 들어온 이름이 있어도 다른 칸은 고칠 수 있게 */
    const bad = name !== (d.name ?? '') ? nameError(name) : null
    if (bad) return onNotice({ kind: 'error', text: bad })
    start(async () => {
      const r = await updateDesigner({
        id: d.id,
        email,
        name,
        oneLiner,
        bio,
        /* 서버에는 지금까지처럼 쉼표 문자열로 보낸다 — 화면만 체크박스로 바뀌었다 */
        tags: tags.join(', '),
      })
      if (!r.ok) return onNotice({ kind: 'error', text: r.error })
      onNotice({ kind: 'ok', text: '저장했습니다.' })
      router.refresh()
    })
  }

  return (
    <form onSubmit={submit} className="rounded-xl bg-white p-5 ring-1 ring-neutral-200">
      <h2 className="text-sm font-semibold">프로필</h2>

      <div className="mt-4 grid gap-3">
        <Field label="이메일" required hint="로그인 아이디">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className={input}
          />
        </Field>
        <Field label="이름" hint="선택 · 한글 실명 2~6자">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={NAME_MAX}
            placeholder="비워두면 디자이너가 직접 입력"
            className={input}
          />
        </Field>
        <Field label="한 줄 소개" hint="선택">
          <input value={oneLiner} onChange={(e) => setOneLiner(e.target.value)} className={input} />
        </Field>
        <Field label="소개글" hint={`선택 · 상세 화면 문단 · ${bio.length}/${MAX_BIO}`}>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={5}
            maxLength={MAX_BIO}
            className="w-full resize-y rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm outline-none ring-violet-500 focus:ring-2"
          />
        </Field>
        <SpecialtyPicker options={specialties} value={tags} onChange={setTags} />
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

/* ─────────── 프로필 이미지 ─────────── */

/* 없으면 이름 첫 글자 — 공개 목록(designer-list.tsx 의 Avatar)과 같은 모양 */
function AvatarImage({ designer: d, size }: { designer: AdminDesigner; size: string }) {
  if (d.avatar_url) {
    return <Img src={d.avatar_url} alt="" className={`${size} shrink-0 rounded-full`} />
  }
  return (
    <div
      className={`${size} grid shrink-0 place-items-center rounded-full bg-neutral-200 text-lg font-semibold text-neutral-500`}
    >
      {displayName(d).slice(0, 1)}
    </div>
  )
}

/* 고르면 바로 올린다 — 디자이너 본인 화면(profile-form.tsx 의 AvatarPicker)과 같다 */
function AvatarSection({
  designer: d,
  onNotice,
}: {
  designer: AdminDesigner
  onNotice: (n: Notice) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [pending, start] = useTransition()
  const router = useRouter()

  const pick = (file: File) => {
    onNotice(null)
    const form = new FormData()
    form.set('designerId', d.id)
    form.set('image', file)
    start(async () => {
      const r = await setDesignerAvatar(form)
      if (!r.ok) return onNotice({ kind: 'error', text: r.error })
      onNotice({ kind: 'ok', text: d.avatar_url ? '프로필 이미지를 바꿨습니다.' : '프로필 이미지를 등록했습니다.' })
      router.refresh()
    })
  }

  const remove = () => {
    if (!confirm('프로필 이미지를 삭제할까요?')) return
    onNotice(null)
    start(async () => {
      const r = await removeDesignerAvatar(d.id)
      if (!r.ok) return onNotice({ kind: 'error', text: r.error })
      onNotice({ kind: 'ok', text: '프로필 이미지를 삭제했습니다.' })
      router.refresh()
    })
  }

  return (
    <section className="rounded-xl bg-white p-5 ring-1 ring-neutral-200">
      <h2 className="text-sm font-semibold">프로필 이미지</h2>

      <div className="mt-4 flex items-center gap-4">
        <AvatarImage designer={d} size="size-16" />
        <div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) pick(f)
              /* 같은 파일을 다시 고를 수 있게 비운다 */
              e.target.value = ''
            }}
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={pending}
              className={ghostButton}
            >
              {pending ? '처리 중…' : d.avatar_url ? '이미지 변경' : '이미지 등록'}
            </button>
            {d.avatar_url && (
              <button
                type="button"
                onClick={remove}
                disabled={pending}
                className="rounded-md border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50"
              >
                삭제
              </button>
            )}
          </div>
          <p className="mt-1.5 text-xs text-neutral-400">정사각형 이미지를 권장합니다</p>
        </div>
      </div>
    </section>
  )
}

/* ─────────── 계정 ─────────── */

function AccountSection({
  designer: d,
  onNotice,
}: {
  designer: AdminDesigner
  onNotice: (n: Notice) => void
}) {
  const [pending, start] = useTransition()
  /* 재발급 직후 값 — router.refresh() 가 끝나기 전에도 바로 보여 복사할 수 있게 한다 */
  const [issued, setIssued] = useState<string | null>(null)
  const router = useRouter()
  const tempPassword = issued ?? d.temp_password

  return (
    <section className="rounded-xl bg-white p-5 ring-1 ring-neutral-200">
      <h2 className="text-sm font-semibold">계정</h2>

      <dl className="mt-3.5 space-y-2.5 text-sm">
        <div className="flex gap-3">
          <dt className="w-28 shrink-0 text-neutral-500">비밀번호</dt>
          <dd>
            {tempPassword ? (
              <span className="flex flex-wrap items-center gap-2">
                <code className="rounded bg-amber-100 px-2 py-0.5 text-[13px] tracking-wide text-amber-900">
                  {tempPassword}
                </code>
                <CopyButton text={tempPassword} />
                <span className="text-xs text-neutral-500">임시 — 아직 변경하지 않았습니다</span>
              </span>
            ) : (
              <span className="text-neutral-600">
                설정 완료
                {d.password_changed_at &&
                  ` · ${new Date(d.password_changed_at).toLocaleString('ko-KR')}`}
              </span>
            )}
          </dd>
        </div>
        <div className="flex gap-3">
          <dt className="w-28 shrink-0 text-neutral-500">마지막 로그인</dt>
          <dd className="text-neutral-600">
            {d.last_login_at ? new Date(d.last_login_at).toLocaleString('ko-KR') : '기록 없음'}
          </dd>
        </div>
        <div className="flex gap-3">
          <dt className="w-28 shrink-0 text-neutral-500">등록일</dt>
          <dd className="text-neutral-600">{new Date(d.created_at).toLocaleString('ko-KR')}</dd>
        </div>
      </dl>

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          onClick={() => {
            if (!confirm(`${displayName(d)}의 비밀번호를 재발급할까요? 지금 비밀번호는 바로 쓸 수 없게 됩니다.`)) {
              return
            }
            onNotice(null)
            start(async () => {
              const r = await resetPassword(d.id)
              if (!r.ok) return onNotice({ kind: 'error', text: r.error })
              setIssued(r.tempPassword)
              onNotice(
                r.mailed
                  ? { kind: 'ok', text: `${d.email} 로 새 임시 비밀번호를 보냈습니다.` }
                  : {
                      kind: 'warn',
                      text: `임시 비밀번호 ${r.tempPassword} 를 발급했지만 메일 발송에 실패했습니다 (${r.mailError}).`,
                    },
              )
              router.refresh()
            })
          }}
          disabled={pending}
          className={ghostButton}
        >
          임시 비밀번호 재발급
        </button>

        <button
          onClick={() => {
            if (!confirm(`${displayName(d)}(${d.email}) 계정을 삭제할까요? 되돌릴 수 없습니다.`)) {
              return
            }
            onNotice(null)
            start(async () => {
              const r = await deleteDesigner(d.id)
              if (!r.ok) return onNotice({ kind: 'error', text: r.error })
              router.push('/admin/designers')
            })
          }}
          disabled={pending}
          className="rounded-md border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50"
        >
          계정 삭제
        </button>
      </div>
    </section>
  )
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(false), 1500)
    return () => clearTimeout(t)
  }, [copied])

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
          setCopied(true)
        } catch {
          /* http 접속 등으로 클립보드가 막히면 직접 고를 수 있게 둔다 */
          window.prompt('복사해 주세요', text)
        }
      }}
      className={ghostButton}
    >
      {copied ? '복사됨' : '복사'}
    </button>
  )
}

/* 프로필만 숨기거나 노출 — 로그인은 그대로다 */
function ProfilePublicButton({
  designer: d,
  onNotice,
}: {
  designer: AdminDesigner
  onNotice: (n: Notice) => void
}) {
  const [pending, start] = useTransition()
  const router = useRouter()

  return (
    <button
      onClick={() => {
        onNotice(null)
        start(async () => {
          const r = await setDesignerProfilePublic(d.id, !d.profile_public)
          if (!r.ok) return onNotice({ kind: 'error', text: r.error })
          if (r.warning) onNotice({ kind: 'warn', text: r.warning })
          router.refresh()
        })
      }}
      disabled={pending}
      title={d.profile_public ? '탐색·홈·상세에서 숨깁니다. 로그인은 막지 않습니다.' : '탐색·홈·상세에 다시 노출합니다.'}
      className={ghostButton}
    >
      {pending ? '…' : d.profile_public ? '프로필 숨기기' : '프로필 노출하기'}
    </button>
  )
}

function VisibleButton({
  designer: d,
  onNotice,
}: {
  designer: AdminDesigner
  onNotice: (n: Notice) => void
}) {
  const [pending, start] = useTransition()
  const router = useRouter()

  return (
    <button
      onClick={() => {
        onNotice(null)
        start(async () => {
          const r = await setDesignerVisible(d.id, !d.visible)
          if (!r.ok) return onNotice({ kind: 'error', text: r.error })
          router.refresh()
        })
      }}
      disabled={pending}
      className={ghostButton}
    >
      {pending ? '…' : d.visible ? '계정 비활성화' : '계정 활성화'}
    </button>
  )
}
