'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  SPECIALTY_SCOPE_MODES,
  SPECIALTY_SCOPE_MODE_LABELS,
  isSpecialtyScopeMode,
  priceOf,
  type PriceScope,
  type Specialty,
} from '@/lib/specialty-shape'
import {
  addSpecialty,
  renameSpecialty,
  setSpecialtyVisible,
  setSpecialtyScopeMode,
  setSpecialtyAllowSample,
  setSpecialtyDescription,
  setSpecialtyPrice,
  setExploreDesc,
  reorderSpecialties,
  deleteSpecialty,
} from '@/app/admin/settings/actions'
import { Flash } from '@/components/flash'

type Notice = { kind: 'ok' | 'error'; text: string } | null

/* 전문 분야 관리(011_specialties.sql).

   이 목록이 탐색 사이드바의 필터이자 디자이너 프로필의 선택지다.
   순서는 끌어서 바꾸고, 이름을 고치면 쓰던 디자이너의 tags 도 함께 바뀐다.
   분야마다, 그리고 '전체'에 탐색 제목 아래 문구를 적는다(0002_specialty_description.sql). */
export function SpecialtyManager({
  specialties,
  exploreDesc,
}: {
  specialties: Specialty[]
  /* '전체'일 때 탐색 제목 아래 문구 */
  exploreDesc: string
}) {
  const [notice, setNotice] = useState<Notice>(null)
  const [draft, setDraft] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const router = useRouter()

  /* 끄는 동안에만 쓰는 순서 — 평소에는 서버가 준 목록을 그대로 그린다 */
  const [dragging, setDragging] = useState<{ id: string; ids: string[] } | null>(null)
  const [savingOrder, startOrder] = useTransition()

  const dragId = dragging?.id ?? null

  const order = (() => {
    if (!dragging) return specialties
    const byId = new Map(specialties.map((s) => [s.id, s]))
    const kept = dragging.ids.map((id) => byId.get(id)).filter((s) => s != null)
    const known = new Set(kept.map((s) => s.id))
    return [...kept, ...specialties.filter((s) => !known.has(s.id))]
  })()

  const act = (fn: () => Promise<{ ok: boolean; error?: string }>, okText?: string) => {
    setNotice(null)
    start(async () => {
      const r = await fn()
      if (!r.ok) {
        setNotice({ kind: 'error', text: r.error ?? '처리에 실패했습니다.' })
        return
      }
      router.refresh()
      if (okText) setNotice({ kind: 'ok', text: okText })
    })
  }

  const moveTo = (i: number) => {
    setDragging((cur) => {
      if (!cur) return cur
      const from = order.findIndex((s) => s.id === cur.id)
      if (from === -1 || from === i) return cur
      const next = order.map((s) => s.id)
      const [id] = next.splice(from, 1)
      next.splice(i, 0, id)
      return { ...cur, ids: next }
    })
  }

  const commitOrder = () => {
    const moved = dragging
    setDragging(null)
    if (!moved) return
    if (specialties.map((s) => s.id).join() === moved.ids.join()) return

    startOrder(async () => {
      const r = await reorderSpecialties(moved.ids)
      if (!r.ok) {
        setNotice({ kind: 'error', text: r.error })
        return
      }
      router.refresh()
    })
  }

  return (
    <section className="rounded-xl bg-white p-5 ring-1 ring-neutral-200 md:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold">전문 분야</h2>
        <p className="text-xs text-neutral-500">
          탐색 화면의 필터이자 디자이너가 고르는 선택지입니다
          {savingOrder && <span className="ml-1.5 text-neutral-400">· 순서 저장 중…</span>}
        </p>
      </div>

      <Flash msg={notice} onDone={() => setNotice(null)} className="mt-3" />

      {/* 추가 */}
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (!draft.trim()) return
          act(async () => {
            const r = await addSpecialty(draft)
            if (r.ok) setDraft('')
            return r
          })
        }}
        className="mt-4 flex gap-2"
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="예: UX/UI, 브랜딩"
          maxLength={40}
          className="h-9 min-w-0 flex-1 rounded-lg border border-neutral-300 px-3 text-sm outline-none ring-violet-500 focus:ring-2"
        />
        <button
          type="submit"
          disabled={pending || !draft.trim()}
          className="shrink-0 rounded-lg bg-neutral-900 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-violet-600 disabled:opacity-40"
        >
          추가
        </button>
      </form>

      {/* '전체'일 때 문구 — 분야 문구와 같은 자리에 나간다 */}
      <div className="mt-4 rounded-xl bg-neutral-50 px-3.5 py-3 ring-1 ring-neutral-200">
        <p className="text-xs font-medium text-neutral-600">전체 문구</p>
        <DescField
          key={exploreDesc}
          value={exploreDesc}
          disabled={pending}
          placeholder="탐색 '전체'에서 제목 아래에 나갈 문구 — 비우면 나오지 않음"
          onSave={(text) => act(() => setExploreDesc(text), '전체 문구를 저장했습니다.')}
        />
      </div>

      {specialties.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-neutral-300 py-12 text-center text-sm text-neutral-500">
          아직 등록된 분야가 없습니다.
          <br />
          <span className="text-xs text-neutral-400">
            분야가 없으면 디자이너가 전문 분야를 고를 수 없습니다.
          </span>
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-neutral-200 overflow-hidden rounded-xl ring-1 ring-neutral-200">
          {order.map((s, i) => (
            <li
              key={s.id}
              onDragOver={(e) => {
                if (dragId == null) return
                e.preventDefault()
                moveTo(i)
              }}
              className={`flex flex-wrap items-center gap-x-2 bg-white pr-3 transition ${
                dragId === s.id ? 'opacity-40' : ''
              } ${s.visible ? '' : 'bg-neutral-50'}`}
            >
              {/* 끌기 손잡이 — 여기서만 끌 수 있다 */}
              <span
                draggable
                onDragStart={(e) => {
                  setDragging({ id: s.id, ids: specialties.map((x) => x.id) })
                  e.dataTransfer.effectAllowed = 'move'
                  /* Firefox 는 데이터가 없으면 드래그를 시작하지 않는다 */
                  e.dataTransfer.setData('text/plain', s.id)
                }}
                onDragEnd={commitOrder}
                aria-label="끌어서 순서 바꾸기"
                title="끌어서 순서 바꾸기"
                className="flex w-8 shrink-0 cursor-grab touch-none items-center justify-center self-stretch text-neutral-300 hover:text-neutral-600 active:cursor-grabbing"
              >
                <svg viewBox="0 0 16 16" fill="currentColor" className="size-4">
                  {[4, 8, 12].map((cy) =>
                    [6, 10].map((cx) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1.3" />),
                  )}
                </svg>
              </span>

              {editing === s.id ? (
                <RenameRow
                  specialty={s}
                  pending={pending}
                  onCancel={() => setEditing(null)}
                  onSubmit={(name) =>
                    act(async () => {
                      const r = await renameSpecialty(s.id, name)
                      if (r.ok) setEditing(null)
                      return r
                    }, '이름을 바꿨습니다. 쓰던 디자이너에게도 반영했습니다.')
                  }
                />
              ) : (
                <>
                  <div className="min-w-0 flex-1 py-3">
                    <span
                      className={`text-sm font-medium ${s.visible ? '' : 'text-neutral-400 line-through'}`}
                    >
                      {s.name}
                    </span>
                    <span className="ml-2 text-xs text-neutral-400">
                      {s.used ?? 0}명
                      {!s.visible && <span className="ml-1.5 text-neutral-500">· 숨김</span>}
                    </span>
                    <DescField
                      key={s.description}
                      value={s.description}
                      disabled={pending}
                      placeholder="탐색 제목 아래 문구 — 비우면 나오지 않음"
                      onSave={(text) =>
                        act(() => setSpecialtyDescription(s.id, text), `'${s.name}' 문구를 저장했습니다.`)
                      }
                    />
                  </div>

                  {/* 좁은 화면에서는 버튼이 다섯 개라 한 줄에 다 들어가지 않는다 — 이름 칸 아래로
                      내려 접히게 하고(손잡이 폭만큼 들여), 넓은 화면에서는 오른쪽 한 줄 */}
                  <div className="flex basis-full flex-wrap items-center gap-1.5 pb-3 pl-8 md:basis-auto md:shrink-0 md:flex-nowrap md:pb-0 md:pl-0">
                    {/* 의뢰 범위 — '고객이 선택'일 때만 탐색 제목 옆에 필터가 나온다 */}
                    <select
                      value={s.scope_mode}
                      onChange={(e) => {
                        const v = e.target.value
                        if (isSpecialtyScopeMode(v)) act(() => setSpecialtyScopeMode(s.id, v))
                      }}
                      disabled={pending}
                      aria-label={`${s.name} 의뢰 범위`}
                      className="h-[26px] rounded-md border border-neutral-300 bg-white px-1.5 text-[11px] font-medium text-neutral-700 disabled:opacity-50"
                    >
                      {SPECIALTY_SCOPE_MODES.map((m) => (
                        <option key={m} value={m}>
                          {SPECIALTY_SCOPE_MODE_LABELS[m]}
                        </option>
                      ))}
                    </select>
                    {/* 켜면 이 분야를 고른 디자이너가 메인 시안 의뢰를 받을지 고를 수 있다 */}
                    <label className="flex cursor-pointer items-center gap-1 rounded-md border border-neutral-300 px-2 py-1 text-[11px] font-medium text-neutral-700">
                      <input
                        type="checkbox"
                        checked={s.allow_sample}
                        disabled={pending}
                        onChange={(e) => {
                          const on = e.target.checked
                          const ask = on
                            ? `'${s.name}' 분야에 메인시안 우선 의뢰를 허용할까요?\n이 분야를 고른 디자이너의 메인시안 의뢰가 공개 화면에 나갑니다.`
                            : `'${s.name}' 분야의 메인시안 우선 허용을 끌까요?\n이 분야만 고른 디자이너는 메인시안 의뢰가 공개 화면에서 빠집니다.`
                          if (!confirm(ask)) return
                          act(() => setSpecialtyAllowSample(s.id, on))
                        }}
                        className="accent-violet-600"
                      />
                      메인시안 우선 허용
                    </label>
                    <button
                      onClick={() => setEditing(s.id)}
                      disabled={pending}
                      className={ghost}
                    >
                      이름
                    </button>
                    <button
                      onClick={() => act(() => setSpecialtyVisible(s.id, !s.visible))}
                      disabled={pending}
                      className={ghost}
                    >
                      {s.visible ? '숨기기' : '노출'}
                    </button>
                    <button
                      onClick={() => {
                        if (!confirm(`'${s.name}' 분야를 지울까요?\n이 분야를 고른 디자이너에게서도 빠집니다.`)) return
                        act(() => deleteSpecialty(s.id), '지웠습니다.')
                      }}
                      disabled={pending}
                      className="rounded-md border border-red-200 px-2 py-1 text-[11px] font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                    >
                      삭제
                    </button>
                  </div>
                  {/* 시작가 — 분야 줄 아래 전체 폭으로. 이름 칸과 줄을 맞춘다(손잡이 폭 + 간격) */}
                  <div className="basis-full space-y-1.5 pb-3 pl-8">
                  {/* 지금 범위가 받는 칸만 — 고객이 선택 분야는 둘 다. 범위를 바꿔도 적어 둔 값은 남는다 */}
                  {SCOPE_ROWS.filter((r) => s.scope_mode === 'choice' || s.scope_mode === r.scope).map((r) => (
                    <ScopePriceRow
                      key={r.scope}
                      specialty={s}
                      scope={r.scope}
                      label={r.label}
                      disabled={pending}
                      onSave={(tier, patch, done) =>
                        act(() => setSpecialtyPrice(s.id, r.scope, tier, patch), `'${s.name}' ${done}`)
                      }
                    />
                  ))}
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      <p className="mt-3 text-xs text-neutral-400">
        손잡이를 끌어 탐색 화면에 보이는 차례를 바꿉니다. 숨긴 분야는 탐색 사이드바에서만
        빠지고, 디자이너는 계속 고를 수 있으며 프로필에도 나옵니다. 의뢰 범위가 &lsquo;고객이 선택&rsquo;인
        분야만 탐색 제목 옆에 &lsquo;전체 | 디자인 | 디자인 + 개발&rsquo; 필터가 나옵니다.
        시작가를 비워 두면 디자이너마다 정한 가격(디자인 전체·프로젝트 최소가, 프리미엄은 디자이너별 프리미엄
        금액)이 나갑니다. 프리미엄은 설정의 유형별 프리미엄과 디자이너별 프리미엄이 함께 켜져 있어야 나가고,
        여기서 끄면 그 분야·범위에서만 빠집니다.
        &lsquo;메인시안 우선 허용&rsquo;을 켠 분야를 고른 디자이너만 메인시안 의뢰를 받을 수 있습니다. 쓰는
        디자이너가 있는 분야는 숨긴 뒤에 지울 수 있고, 지우면 그 디자이너들에게서도 빠집니다.
      </p>
    </section>
  )
}

/* 탐색 제목 아래 문구 한 칸 — 고친 뒤 칸을 벗어나거나 Enter 를 누르면 저장한다.
   서버 값이 바뀌면 key 로 새로 그려 입력이 따라온다. */
function DescField({
  value,
  disabled,
  placeholder,
  onSave,
}: {
  value: string
  disabled: boolean
  placeholder: string
  onSave: (text: string) => void
}) {
  const [text, setText] = useState(value)
  const save = () => {
    if (text.trim() !== value) onSave(text)
  }

  return (
    <input
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          save()
        }
        if (e.key === 'Escape') setText(value)
      }}
      disabled={disabled}
      maxLength={200}
      placeholder={placeholder}
      className="mt-1.5 h-8 w-full min-w-0 rounded-md border border-neutral-200 bg-white px-2.5 text-xs text-neutral-700 outline-none ring-violet-500 placeholder:text-neutral-400 focus:ring-2 disabled:opacity-60"
    />
  )
}

/* 범위별 시작가 줄(0011) — 메인화면 먼저 의뢰는 디자이너 가격이라 줄이 없다 */
const SCOPE_ROWS = [
  { scope: 'design', label: '디자인만' },
  { scope: 'design_dev', label: '디자인 + 개발' },
] as const

/* 범위 한 줄 — 기본 시작가, 그 옆에 프리미엄 켜짐과 시작가.
   프리미엄을 끄면 이 분야·범위에서만 빠진다(설정·디자이너별 프리미엄은 그대로).
   꺼도 금액은 남는다 — 다시 켤 때 다시 적지 않게 */
function ScopePriceRow({
  specialty: s,
  scope,
  label,
  disabled,
  onSave,
}: {
  specialty: Specialty
  scope: PriceScope
  label: string
  disabled: boolean
  onSave: (
    tier: 'basic' | 'premium',
    patch: { price?: number | null; enabled?: boolean; allowSample?: boolean },
    done: string,
  ) => void
}) {
  const basic = priceOf(s.prices, scope, 'basic')
  const premium = priceOf(s.prices, scope, 'premium')

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-neutral-500">
      <span className="w-20 shrink-0 font-medium text-neutral-600">{label}</span>
      <PriceField
        key={`basic:${basic.price}`}
        label="시작가"
        value={basic.price}
        disabled={disabled}
        onSave={(price) => onSave('basic', { price }, `${label} 시작가를 저장했습니다.`)}
      />
      {/* 메인화면 먼저 의뢰 옵션 — 분야의 '메인시안 우선 허용'이 켜졌을 때만 범위마다 고른다(0013) */}
      {s.allow_sample && (
        <label className="flex shrink-0 cursor-pointer items-center gap-1">
          <input
            type="checkbox"
            checked={basic.allowSample}
            disabled={disabled}
            onChange={(e) => {
              const on = e.target.checked
              onSave(
                'basic',
                { allowSample: on },
                `${label}에 메인화면 먼저 의뢰를 ${on ? '붙였습니다' : '뺐습니다'}.`,
              )
            }}
            className="accent-violet-600"
          />
          메인화면 먼저
        </label>
      )}
      {/* 프리미엄 체크와 그 금액은 함께 줄을 넘긴다 — 금액 칸만 떨어지면 어느 시작가인지 헷갈린다 */}
      <span className="flex shrink-0 items-center gap-x-3">
        <label className="flex shrink-0 cursor-pointer items-center gap-1">
          <input
            type="checkbox"
            checked={premium.enabled}
            disabled={disabled}
            onChange={(e) => {
              const on = e.target.checked
              onSave('premium', { enabled: on }, `${label} 프리미엄을 ${on ? '켰습니다' : '껐습니다'}.`)
            }}
            className="accent-violet-600"
          />
          프리미엄
        </label>
        <PriceField
          key={`premium:${premium.price}`}
          label="시작가"
          value={premium.price}
          disabled={disabled || !premium.enabled}
          placeholder="디자이너 금액"
          onSave={(price) => onSave('premium', { price }, `${label} 프리미엄 시작가를 저장했습니다.`)}
        />
      </span>
    </div>
  )
}

/* 분야 시작가 한 칸 — 의뢰 폼에서 이 분야 금액으로 나간다. 비우면 디자이너 가격.
   DescField 와 같이 칸을 벗어나거나 Enter 로 저장한다 */
function PriceField({
  label,
  value,
  disabled,
  placeholder = '디자이너 가격',
  onSave,
}: {
  label: string
  value: number | null
  placeholder?: string
  disabled: boolean
  onSave: (price: number | null) => void
}) {
  const [text, setText] = useState(value == null ? '' : String(value))
  const save = () => {
    const digits = text.replace(/\D/g, '')
    const next = digits ? Number(digits) : null
    if (next !== value) onSave(next)
  }

  return (
    <label className="flex items-center gap-1.5 text-[11px] text-neutral-500">
      <span className="shrink-0">{label}</span>
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            save()
          }
          if (e.key === 'Escape') setText(value == null ? '' : String(value))
        }}
        disabled={disabled}
        inputMode="numeric"
        placeholder={placeholder}
        className="h-8 w-28 shrink-0 rounded-md border border-neutral-200 bg-white px-2.5 text-xs text-neutral-700 outline-none ring-violet-500 placeholder:text-neutral-400 focus:ring-2 disabled:opacity-60"
      />
      <span className="shrink-0">원</span>
    </label>
  )
}

/* 이름 바꾸기 한 줄 — 고치는 동안에는 그 줄만 입력칸이 된다 */
function RenameRow({
  specialty: s,
  pending,
  onCancel,
  onSubmit,
}: {
  specialty: Specialty
  pending: boolean
  onCancel: () => void
  onSubmit: (name: string) => void
}) {
  const [name, setName] = useState(s.name)

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (name.trim()) onSubmit(name)
      }}
      className="flex min-w-0 flex-1 items-center gap-2 py-2"
    >
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={40}
        autoFocus
        className="h-8 min-w-0 flex-1 rounded border border-neutral-300 px-2 text-sm outline-none ring-violet-500 focus:ring-2"
      />
      {(s.used ?? 0) > 0 && (
        <span className="shrink-0 text-[11px] text-amber-700">{s.used}명에게 함께 반영</span>
      )}
      <button
        type="submit"
        disabled={pending || !name.trim() || name === s.name}
        className="shrink-0 rounded bg-neutral-900 px-2 py-1 text-[11px] font-semibold text-white disabled:opacity-40"
      >
        저장
      </button>
      <button type="button" onClick={onCancel} disabled={pending} className={ghost}>
        취소
      </button>
    </form>
  )
}

const ghost =
  'rounded-md border border-neutral-300 px-2 py-1 text-[11px] font-medium text-neutral-700 transition hover:bg-neutral-100 disabled:opacity-50'
