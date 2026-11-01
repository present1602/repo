'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { displayName } from '@/lib/display-name'
import { Img } from '@/components/img'
import {
  addExploreFeatures,
  removeExploreFeature,
  reorderExploreFeatures,
} from '@/app/admin/exposure/actions'

export type ExposureDesigner = {
  id: string
  name: string | null
  email: string
  avatar_url: string | null
  works_visible: number
  works_total: number
  /* 탐색에 실제로 뜰 수 있는 상태인지(계정 열림 + 프로필 공개) */
  shown: boolean
}

type Notice = { kind: 'ok' | 'error'; text: string } | null

/* 노출 관리 — 모양(feature1) 하나에 디자이너 목록 하나.

   왼쪽에 그 모양이 탐색에서 어떻게 생겼는지 그림으로 보여주고, 오른쪽에
   그 모양으로 올린 디자이너를 차례대로 늘어놓는다. 끌어서 차례를 바꾸고,
   '제외' 로 내린다. 모양이 늘면(feature2 …) 이 묶음이 하나 더 생긴다. */
export function ExposureManager({
  designers,
  featureIds,
}: {
  designers: ExposureDesigner[]
  featureIds: string[]
}) {
  const [notice, setNotice] = useState<Notice>(null)
  const [picking, setPicking] = useState(false)
  const [pending, start] = useTransition()
  const router = useRouter()

  const byId = useMemo(() => new Map(designers.map((d) => [d.id, d])), [designers])
  /* 지워진 디자이너는 cascade 로 함께 빠지지만, 그 사이에 열어 둔 화면을 위해 걸러 둔다 */
  const featured = featureIds.map((id) => byId.get(id)).filter((d) => d != null)

  /* 끄는 동안에만 쓰는 순서 — 평소에는 서버가 준 목록을 그대로 그린다 */
  const [dragging, setDragging] = useState<{ id: string; ids: string[] } | null>(null)
  const [savingOrder, startOrder] = useTransition()
  const dragId = dragging?.id ?? null

  const order = dragging
    ? dragging.ids.map((id) => byId.get(id)).filter((d) => d != null)
    : featured

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
      const from = cur.ids.indexOf(cur.id)
      if (from === -1 || from === i) return cur
      const next = [...cur.ids]
      const [id] = next.splice(from, 1)
      next.splice(i, 0, id)
      return { ...cur, ids: next }
    })
  }

  const commitOrder = () => {
    const moved = dragging
    setDragging(null)
    if (!moved) return
    if (featured.map((d) => d.id).join() === moved.ids.join()) return

    startOrder(async () => {
      const r = await reorderExploreFeatures(moved.ids)
      if (!r.ok) {
        setNotice({ kind: 'error', text: r.error })
        return
      }
      router.refresh()
    })
  }

  return (
    <section className="rounded-xl bg-white p-5 ring-1 ring-neutral-200 md:p-6">
      {notice && (
        <p
          className={`mb-4 rounded-lg px-3.5 py-3 text-sm ${
            notice.kind === 'ok' ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'
          }`}
        >
          {notice.text}
        </p>
      )}

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* 모양 — 이 묶음이 탐색에서 어떻게 보이는지 */}
        <div className="shrink-0 lg:w-64">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold">feature1</h2>
            <span className="text-xs text-neutral-400">탐색 맨 위</span>
          </div>
          <Feature1Illustration />
          <p className="mt-2 text-xs leading-relaxed text-neutral-500">
            프로필 한 줄 아래 작업 썸네일을 가로로 늘어놓는 카드입니다. 작업이 많은 디자이너에게
            어울립니다.
          </p>
        </div>

        {/* 올린 디자이너 */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-neutral-600">
              {order.length}명
              {savingOrder && <span className="ml-1.5 text-neutral-400">· 순서 저장 중…</span>}
            </p>
            <button
              type="button"
              onClick={() => setPicking(true)}
              className="rounded-lg bg-neutral-900 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-violet-600"
            >
              디자이너 추가
            </button>
          </div>

          {order.length === 0 ? (
            <p className="mt-3 rounded-xl border border-dashed border-neutral-300 py-12 text-center text-sm text-neutral-500">
              올려 둔 디자이너가 없습니다.
              <br />
              <span className="text-xs text-neutral-400">
                없으면 탐색은 모두 기본 카드로 보입니다.
              </span>
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-neutral-200 overflow-hidden rounded-xl ring-1 ring-neutral-200">
              {order.map((d, i) => (
                <li
                  key={d.id}
                  onDragOver={(e) => {
                    if (dragId == null) return
                    e.preventDefault()
                    moveTo(i)
                  }}
                  className={`flex items-center gap-3 bg-white py-2.5 pr-3 transition ${
                    dragId === d.id ? 'opacity-40' : ''
                  }`}
                >
                  {/* 끌기 손잡이 — 여기서만 끌 수 있다 */}
                  <span
                    draggable
                    onDragStart={(e) => {
                      setDragging({ id: d.id, ids: featured.map((x) => x.id) })
                      e.dataTransfer.effectAllowed = 'move'
                      /* Firefox 는 데이터가 없으면 드래그를 시작하지 않는다 */
                      e.dataTransfer.setData('text/plain', d.id)
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

                  <DesignerLine designer={d} />

                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      act(() => removeExploreFeature(d.id), `${displayName(d)}님을 내렸습니다.`)
                    }
                    className="shrink-0 rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 transition hover:border-red-300 hover:bg-red-50 hover:text-red-700 disabled:opacity-40"
                  >
                    제외
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {picking && (
        <PickDialog
          designers={designers}
          already={new Set(featureIds)}
          pending={pending}
          onClose={() => setPicking(false)}
          onConfirm={(ids) =>
            act(async () => {
              const r = await addExploreFeatures(ids)
              if (r.ok) setPicking(false)
              return r
            }, `${ids.length}명을 올렸습니다.`)
          }
        />
      )}
    </section>
  )
}

/* 디자이너 한 줄 — 프로필·이름·이메일·포트폴리오 수(공개 / 전체) */
function DesignerLine({ designer: d, link = true }: { designer: ExposureDesigner; link?: boolean }) {
  const name = displayName(d)
  const cls = 'group flex min-w-0 flex-1 items-center gap-3'
  /* 다이얼로그에서는 줄 전체가 체크박스 label 이라 링크를 걸 수 없다 */
  const body = (
    <>
      {d.avatar_url ? (
        <Img src={d.avatar_url} alt={name} className="size-9 shrink-0 rounded-full" />
      ) : (
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-neutral-200 text-xs font-medium text-neutral-500">
          {name.slice(0, 1)}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-sm font-medium group-hover:text-violet-600">
          <span className="truncate">{name}</span>
          {/* 올려 둬도 탐색에 안 뜨는 이유를 줄에서 바로 알 수 있게 */}
          {!d.shown && (
            <span className="shrink-0 rounded bg-neutral-200 px-1.5 py-0.5 text-[10px] font-normal text-neutral-600">
              비공개
            </span>
          )}
        </span>
        <span className="block truncate text-xs text-neutral-500">{d.email}</span>
      </span>
      <span
        className="shrink-0 text-xs tabular-nums text-neutral-500"
        title="포트폴리오 공개 수 / 전체 수"
      >
        <span className="font-semibold text-neutral-900">{d.works_visible}</span> / {d.works_total}
      </span>
    </>
  )
  return link ? (
    <Link href={`/admin/designers/${d.id}`} className={cls}>
      {body}
    </Link>
  ) : (
    <span className={cls}>{body}</span>
  )
}

/* 디자이너 고르기 — 전체 목록에서 여러 명을 체크하고 확인.
   이미 올라 있는 사람은 체크된 채로 잠가 둔다 — 여기서 빼는 건 목록의 '제외' 몫이다. */
function PickDialog({
  designers,
  already,
  pending,
  onClose,
  onConfirm,
}: {
  designers: ExposureDesigner[]
  already: Set<string>
  pending: boolean
  onClose: () => void
  onConfirm: (ids: string[]) => void
}) {
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [q, setQ] = useState('')

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  /* 포트폴리오가 많은 사람부터 — 이 모양에 어울리는 사람을 찾기 쉽게 */
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return designers
      .filter((d) => !needle || `${displayName(d)} ${d.email}`.toLowerCase().includes(needle))
      .sort((a, b) => b.works_visible - a.works_visible || b.works_total - a.works_total)
  }, [designers, q])

  const toggle = (id: string) =>
    setPicked((cur) => {
      const next = new Set(cur)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 md:items-center md:p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="디자이너 추가"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[85vh] w-full max-w-xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl md:rounded-2xl"
      >
        <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4">
          <h2 className="font-semibold">디자이너 추가</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="text-2xl leading-none text-neutral-500 transition hover:text-neutral-900"
          >
            ×
          </button>
        </div>

        <div className="border-b border-neutral-200 px-5 py-3">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="이름, 이메일 검색"
            className="h-9 w-full rounded-lg border border-neutral-300 px-3 text-sm outline-none ring-violet-500 focus:ring-2"
          />
        </div>

        <ul className="min-h-0 flex-1 divide-y divide-neutral-100 overflow-y-auto">
          {list.map((d) => {
            const on = already.has(d.id)
            return (
              <li key={d.id}>
                <label
                  className={`flex items-center gap-3 px-5 py-2.5 ${
                    on ? 'cursor-default bg-neutral-50' : 'cursor-pointer hover:bg-neutral-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={on || picked.has(d.id)}
                    disabled={on}
                    onChange={() => toggle(d.id)}
                    className="size-4 shrink-0 accent-violet-600"
                  />
                  <DesignerLine designer={d} link={false} />
                  {on && <span className="shrink-0 text-[11px] text-neutral-400">올라 있음</span>}
                </label>
              </li>
            )
          })}
          {list.length === 0 && (
            <li className="py-12 text-center text-sm text-neutral-500">맞는 디자이너가 없습니다.</li>
          )}
        </ul>

        <div className="flex items-center justify-between gap-3 border-t border-neutral-200 px-5 py-3">
          <span className="text-sm text-neutral-500">{picked.size}명 선택</span>
          <button
            type="button"
            disabled={pending || picked.size === 0}
            onClick={() => onConfirm([...picked])}
            className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-600 disabled:opacity-40"
          >
            {pending ? '추가 중…' : '확인'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* feature1 이 탐색에서 어떤 모양인지 — 실제 카드의 뼈대만 추린 그림.
   위에 프로필 한 줄(사진·이름·분야·버튼), 아래에 썸네일이 가로로 늘어선다. */
function Feature1Illustration() {
  return (
    <div
      aria-hidden
      className="mt-3 rounded-xl bg-neutral-100 p-3 ring-1 ring-neutral-200"
    >
      <div className="rounded-lg bg-white p-2.5 shadow-sm ring-1 ring-neutral-200/70">
        <div className="flex items-center gap-2">
          <span className="size-5 shrink-0 rounded-full bg-violet-200" />
          <span className="flex-1 space-y-1">
            <span className="block h-1.5 w-14 rounded-full bg-neutral-800" />
            <span className="block h-1 w-20 rounded-full bg-neutral-300" />
          </span>
          <span className="h-3 w-7 rounded bg-neutral-100" />
          <span className="h-3 w-9 rounded bg-neutral-900" />
        </div>
        <div className="mt-2.5 flex gap-1">
          {[
            'w-10 bg-violet-200',
            'w-7 bg-amber-100',
            'w-12 bg-sky-100',
            'w-7 bg-rose-100',
            'w-5 bg-emerald-100',
          ].map((c) => (
            <span key={c} className={`h-14 shrink-0 rounded ${c}`} />
          ))}
          <span className="grid h-14 w-5 shrink-0 place-items-center rounded border border-dashed border-neutral-300 text-[8px] text-neutral-400">
            +
          </span>
        </div>
      </div>
      {/* 아래에 이어지는 기본 카드들 — 흐리게 */}
      <div className="mt-2 flex gap-2 rounded-lg bg-white/60 p-2 opacity-60 ring-1 ring-neutral-200/70">
        <span className="h-8 w-12 shrink-0 rounded bg-neutral-200" />
        <span className="flex-1 space-y-1 pt-1">
          <span className="block h-1.5 w-12 rounded-full bg-neutral-400" />
          <span className="block h-1 w-16 rounded-full bg-neutral-300" />
        </span>
      </div>
      <p className="mt-1.5 text-center text-[10px] text-neutral-400">↑ feature1 · ↓ 기본 카드</p>
    </div>
  )
}
