'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { AdminDesigner } from '@/lib/designer-shape'
import {
  DEFAULT_FULL_DESIGN_PRICE,
  DEFAULT_PROJECT_PRICE,
  designPriceOptions,
  formatPrice,
  formatPriceRange,
  type PlanCopies,
} from '@/lib/plans'
import { acceptsDesign } from '@/lib/scopes'
import { MAX_TAGS, SPECIALTY_SCOPE_MODE_LABELS } from '@/lib/specialty-shape'
import type { CategoryMeta } from '@/lib/inquiry-choices'
import { updateRequestSettings } from '@/app/studio/actions'

/* 설정 탭의 가격 플랜(0004_plan_options_by_category.sql).

   의뢰 받는 분야와 프로필 태그를 먼저 고르고, 그 아래 분야마다 받는 의뢰 유형과 금액을 둔다.
   둘은 같은 칸(designers.tags)·같은 상한(MAX_TAGS)을 써서 한 화면에서 함께 저장한다 —
   의뢰 받는 분야를 켜면 같은 이름의 태그도 켜진다.
   고르지 않은 분야의 칸도 보여주되 흐리게 잠근다 — 무엇을 고르면 무엇이 열리는지 보이게.
   잠근 칸의 값은 지우지 않고 그대로 보낸다.

   유형마다 주인이 다르다 —
     메인화면 시안 의뢰  어드민만 켜고 끈다. 디자이너는 시작가만 고른다
     디자인·프로젝트     고객이 선택하는 분야(web/app)에서 디자이너가 켠다. 하나는 켜져 있어야 한다
     범위가 정해진 분야  (랜딩·로고) 분야를 고르면 받는다. 금액은 어드민 몫이라 보기만 한다 */
export function PlanForm({
  designer: d,
  copy,
  categories: all,
}: {
  designer: AdminDesigner
  copy: PlanCopies
  /* 어드민이 만든 분야 전부, 설정 차례대로. 메뉴에 나오는(visible) 것은 의뢰 받는 분야,
     나머지는 프로필 태그로만 고른다 */
  categories: CategoryMeta[]
}) {
  const categories = all.filter((c) => c.visible)
  const hidden = all.filter((c) => !c.visible)
  const initialPicked = categories.filter((c) => d.tags.includes(c.name)).map((c) => c.name)
  const initialExtra = hidden.filter((c) => d.tags.includes(c.name)).map((c) => c.name)
  /* 목록에 없는 이름(어드민이 바꾸거나 지운 분야) — 끌 수 없으므로 알려만 주고, 저장하면 빠진다 */
  const orphans = d.tags.filter((t) => !all.some((c) => c.name === t))

  const [picked, setPicked] = useState<string[]>(initialPicked)
  const [extra, setExtra] = useState<string[]>(initialExtra)
  const [designPrice, setDesignPrice] = useState(d.design_price)
  /* 0004 전 값(둘 다 꺼짐)은 디자인을 받는 것으로 본다 — 지금까지 늘 받았다 */
  const initialDesign = acceptsDesign(d)
  const [fullDesign, setFullDesign] = useState(initialDesign)
  const [withDev, setWithDev] = useState(d.scope_with_dev)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [pending, start] = useTransition()
  const router = useRouter()

  const startOptions = designPriceOptions(d.price_max)
  const full = picked.length + extra.length >= MAX_TAGS
  const flip = (list: string[], name: string) =>
    list.includes(name) ? list.filter((n) => n !== name) : [...list, name]
  const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((n) => b.includes(n))

  /* 고객이 선택하는 분야를 골랐으면 디자인·프로젝트 중 하나는 켜져 있어야 한다 */
  const needsReach = categories.some((c) => c.scope_mode === 'choice' && picked.includes(c.name))
  const reachMissing = needsReach && !fullDesign && !withDev

  const dirty =
    !sameSet(picked, initialPicked) ||
    !sameSet(extra, initialExtra) ||
    orphans.length > 0 ||
    designPrice !== d.design_price ||
    fullDesign !== initialDesign ||
    withDev !== d.scope_with_dev

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setMsg(null)
    if (reachMissing) {
      setMsg({ ok: false, text: '디자인 의뢰나 프로젝트 의뢰 중 하나는 선택해 주세요.' })
      return
    }
    start(async () => {
      const r = await updateRequestSettings({
        categories: picked,
        profileTags: extra,
        designPrice,
        scopeFullDesign: fullDesign,
        scopeWithDev: withDev,
      })
      if (!r.ok) {
        setMsg({ ok: false, text: r.error })
        return
      }
      setMsg({ ok: true, text: '저장했습니다.' })
      router.refresh()
    })
  }

  const fullPrice = d.full_design_price ?? DEFAULT_FULL_DESIGN_PRICE
  const projectPrice = d.project_price ?? DEFAULT_PROJECT_PRICE

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
          의뢰 받는 분야를 고르면 그 분야의 의뢰 유형과 금액을 설정할 수 있습니다. 플랜 이름과 설명은
          모든 디자이너가 함께 쓰므로 변경할 수 없습니다.
        </p>
      </div>

      {/* 의뢰 받는 분야 — designers.tags 중 메뉴에 나오는 분야. 프로필 태그는 프로필 탭이 맡는다 */}
      <section>
        <div className="mb-1.5 flex items-baseline justify-between gap-2">
          <h3 className="text-xs font-medium text-neutral-600">의뢰 받는 분야</h3>
          <span className="text-[11px] text-neutral-400">탐색 메뉴와 의뢰 폼에 나와요</span>
        </div>
        {categories.length === 0 ? (
          <p className="rounded-lg border border-dashed border-neutral-300 px-3 py-4 text-xs text-neutral-500">
            아직 고를 수 있는 분야가 없습니다. 관리자에게 문의해 주세요.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
            {categories.map(({ name }) => {
              const on = picked.includes(name)
              const blocked = !on && full
              return (
                <label
                  key={name}
                  className={`flex min-h-11 items-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition ${
                    on
                      ? 'border-violet-600 bg-violet-50 font-semibold text-violet-700'
                      : blocked
                        ? 'border-neutral-200 text-neutral-300'
                        : 'cursor-pointer border-neutral-300 font-medium hover:bg-neutral-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={on}
                    disabled={blocked}
                    onChange={() => setPicked((p) => flip(p, name))}
                    className="accent-violet-600"
                  />
                  {name}
                </label>
              )
            })}
          </div>
        )}
        {categories.length > 0 && picked.length === 0 && (
          <p className="mt-2 text-[11px] leading-relaxed text-amber-700">
            의뢰 받는 분야를 고르지 않으면 분야별 탐색에서는 보이지 않아요.
          </p>
        )}
      </section>

      {/* 프로필 태그 — 공개 프로필 머리에 나가는 분야. 목록은 고정이다 — 켜고 꺼도 칩이
          생기거나 사라지지 않고 켜짐만 바뀐다. 칩이 들락날락하면 나머지 칩 자리가 흔들린다.
          의뢰 받는 분야는 위 칸이 켜고 끈다 — 여기서는 켜짐만 비춘다 */}
      {all.length > 0 && (
        <section>
          <div className="mb-1.5 flex items-baseline justify-between gap-2">
            <h3 className="text-xs font-medium text-neutral-600">프로필 태그</h3>
            <span className="text-[11px] tabular-nums text-neutral-400">
              {picked.length + extra.length} / {MAX_TAGS}
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {all.map(({ name, visible }) => {
              if (visible) {
                const on = picked.includes(name)
                return (
                  <span
                    key={name}
                    title="위 의뢰 받는 분야에서 고르면 함께 켜져요"
                    className={`rounded-full border px-3 py-1 text-xs ${
                      on
                        ? 'border-violet-200 bg-violet-50 font-medium text-violet-700'
                        : 'border-dashed border-neutral-200 text-neutral-300'
                    }`}
                  >
                    #{name}
                  </span>
                )
              }
              const on = extra.includes(name)
              const blocked = !on && full
              return (
                <button
                  key={name}
                  type="button"
                  aria-pressed={on}
                  disabled={blocked}
                  onClick={() => setExtra((x) => flip(x, name))}
                  className={`rounded-full border px-3 py-1 text-xs transition ${
                    on
                      ? 'border-violet-200 bg-violet-50 font-medium text-violet-700'
                      : blocked
                        ? 'border-neutral-200 text-neutral-300'
                        : 'border-neutral-300 text-neutral-600 hover:border-neutral-500 hover:text-neutral-900'
                  }`}
                >
                  #{name}
                </button>
              )
            })}
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-neutral-500">
            의뢰 받는 분야는 자동으로 태그가 됩니다. 나머지는 프로필에 표시만 됩니다. 합쳐서 최대{' '}
            {MAX_TAGS}개까지 선택 가능합니다.
          </p>
          {orphans.length > 0 && (
            <p className="mt-2 text-[11px] leading-relaxed text-amber-700">
              {orphans.join(', ')} — 지금은 고를 수 없는 분야입니다. 저장하면 빠집니다.
            </p>
          )}
        </section>
      )}

      {/* 분야마다 받는 의뢰 유형과 금액 */}
      <div className="space-y-3">
        {categories.map((c) => {
          const on = picked.includes(c.name)
          const showSample = c.allow_sample && copy.sample.visible
          return (
            <section
              key={c.id}
              className={`rounded-xl border p-4 transition ${
                on ? 'border-neutral-200 bg-white' : 'border-neutral-200 bg-neutral-50'
              }`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <h3 className={`text-sm font-semibold ${on ? '' : 'text-neutral-400'}`}>{c.name}</h3>
                <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[11px] text-neutral-500">
                  {SPECIALTY_SCOPE_MODE_LABELS[c.scope_mode]}
                </span>
                {!on && (
                  <span className="rounded bg-neutral-200 px-1.5 py-0.5 text-[10px] font-medium text-neutral-500">
                    미선택
                  </span>
                )}
              </div>
              {!on && (
                <p className="mt-1 text-[11px] text-neutral-400">
                  위에서 {c.name}을(를) 선택하면 설정할 수 있어요.
                </p>
              )}

              <div className="mt-3 space-y-2">
                {/* 메인화면 시안 의뢰 — 받을지는 어드민 몫, 시작가만 디자이너가 고른다 */}
                {showSample && (
                  <Row
                    dim={!on}
                    check={<LockedCheck on={d.scope_sample} />}
                    title={copy.sample.basic.name}
                    badge="관리자 설정"
                    hint={
                      d.scope_sample
                        ? '이 분야를 받으면 함께 받습니다. 변경은 관리자에게 문의해 주세요.'
                        : '관리자가 꺼 두었습니다.'
                    }
                  >
                    <div className="mt-2.5 flex flex-wrap items-end gap-3">
                      <label className="min-w-0">
                        <span className="mb-1 block text-[11px] font-medium text-neutral-600">시작가</span>
                        <select
                          value={designPrice}
                          disabled={!on || !d.scope_sample}
                          onChange={(e) => setDesignPrice(Number(e.target.value))}
                          className="h-9 rounded-lg border border-neutral-300 bg-white px-3 text-sm outline-none ring-violet-500 focus:ring-2 disabled:bg-neutral-100 disabled:text-neutral-400"
                        >
                          {/* 보기에 없는 저장값(상한을 내린 뒤)도 지금 값으로 보이게 */}
                          {!startOptions.includes(designPrice) && (
                            <option value={designPrice}>{formatPrice(designPrice)}</option>
                          )}
                          {startOptions.map((p) => (
                            <option key={p} value={p}>
                              {formatPrice(p)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <span className="pb-2 text-neutral-400">~</span>
                      <div className="min-w-0">
                        <span className="mb-1 block text-[11px] font-medium text-neutral-600">
                          상한 <span className="font-normal text-neutral-400">(관리자 설정)</span>
                        </span>
                        <p className="flex h-9 items-center rounded-lg bg-neutral-100 px-3 text-sm font-medium text-neutral-500">
                          {formatPrice(d.price_max)}
                        </p>
                      </div>
                    </div>
                    <p className="mt-2 text-[11px] text-neutral-400">
                      공개 프로필에는 {formatPriceRange(designPrice, d.price_max)}으로 보입니다.
                    </p>
                  </Row>
                )}

                {c.scope_mode === 'choice' ? (
                  <>
                    {copy.full_design.visible && (
                      <Row
                        dim={!on}
                        check={
                          <input
                            type="checkbox"
                            checked={fullDesign}
                            disabled={!on}
                            onChange={(e) => setFullDesign(e.target.checked)}
                            className="mt-0.5 shrink-0 accent-violet-600"
                          />
                        }
                        title={copy.full_design.basic.name}
                        price={`${formatPrice(fullPrice)}~`}
                        hint="디자인까지 맡는 의뢰입니다. 금액은 관리자가 정합니다."
                        selectable
                      />
                    )}
                    {copy.with_dev.visible && (
                      <Row
                        dim={!on}
                        check={
                          <input
                            type="checkbox"
                            checked={withDev}
                            disabled={!on}
                            onChange={(e) => setWithDev(e.target.checked)}
                            className="mt-0.5 shrink-0 accent-violet-600"
                          />
                        }
                        title={copy.with_dev.basic.name}
                        price={`${formatPrice(projectPrice)}~`}
                        hint="SOOM 개발자와 팀이 되어 개발까지 맡는 의뢰입니다. 금액은 관리자가 정합니다."
                        selectable
                      />
                    )}
                    {on && reachMissing && (
                      <p className="text-[11px] text-red-600">
                        디자인 의뢰나 프로젝트 의뢰 중 하나는 선택해야 합니다. 둘 다 선택해도 됩니다.
                      </p>
                    )}
                  </>
                ) : (
                  /* 범위가 정해진 분야 — 분야를 고르면 받는다. 금액은 분야 시작가, 없으면 디자이너 범위 가격 */
                  <Row
                    dim={!on}
                    check={<LockedCheck on={on} />}
                    title={c.scope_mode === 'design_dev' ? `${c.name} 개발` : c.name}
                    price={`${formatPrice(
                      c.price_from ?? (c.scope_mode === 'design_dev' ? projectPrice : fullPrice),
                    )}~`}
                    hint={
                      c.scope_mode === 'design_dev'
                        ? '디자인 후 개발은 SOOM 이 이어받습니다. 금액은 관리자가 정합니다.'
                        : '이 분야를 고르면 받습니다. 금액은 관리자가 정합니다.'
                    }
                  />
                )}
              </div>
            </section>
          )
        })}
      </div>

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

/* 의뢰 유형 한 줄 — 체크 · 이름 · 금액 · 설명 */
function Row({
  dim,
  check,
  title,
  badge,
  price,
  hint,
  selectable,
  children,
}: {
  dim: boolean
  check: React.ReactNode
  title: string
  badge?: string
  price?: string
  hint: string
  /* 눌러서 켜고 끄는 줄만 손가락 커서를 준다 */
  selectable?: boolean
  children?: React.ReactNode
}) {
  const Wrap = selectable ? 'label' : 'div'
  return (
    <Wrap
      className={`flex items-start gap-2.5 rounded-lg border border-neutral-200 bg-white p-3 ${
        dim ? 'opacity-60' : selectable ? 'cursor-pointer hover:bg-neutral-50' : ''
      }`}
    >
      {check}
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">{title}</span>
          {badge && (
            <span className="rounded bg-neutral-200 px-1.5 py-0.5 text-[10px] font-medium text-neutral-600">
              {badge}
            </span>
          )}
          {price && <span className="ml-auto text-xs text-neutral-500">{price}</span>}
        </span>
        <span className="mt-0.5 block text-xs leading-relaxed text-neutral-500">{hint}</span>
        {children}
      </span>
    </Wrap>
  )
}

/* 디자이너가 바꿀 수 없는 체크 — disabled 체크박스는 브라우저가 흐리게 칠해 꺼진 것처럼
   보이므로, 같은 자리에 같은 크기로 그려 켜짐이 분명하게 한다 */
function LockedCheck({ on }: { on: boolean }) {
  return (
    <span
      role="img"
      aria-label={on ? '선택됨 (변경 불가)' : '선택 안 됨 (변경 불가)'}
      className={`mt-0.5 grid size-4 shrink-0 place-items-center rounded-[3px] text-[10px] font-bold text-white ${
        on ? 'bg-violet-600' : 'border border-neutral-300 bg-neutral-100'
      }`}
    >
      {on ? '✓' : ''}
    </span>
  )
}
