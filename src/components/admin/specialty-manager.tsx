'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { Specialty } from '@/lib/specialty-shape'
import {
  addSpecialty,
  renameSpecialty,
  setSpecialtyVisible,
  reorderSpecialties,
  deleteSpecialty,
} from '@/app/admin/settings/actions'

type Notice = { kind: 'ok' | 'error'; text: string } | null

/* 전문 분야 관리(011_specialties.sql).

   이 목록이 탐색 사이드바의 필터이자 디자이너 프로필의 선택지다.
   순서는 끌어서 바꾸고, 이름을 고치면 쓰던 디자이너의 tags 도 함께 바뀐다. */
export function SpecialtyManager({ specialties }: { specialties: Specialty[] }) {
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

      {notice && (
        <p
          className={`mt-3 rounded-lg px-3.5 py-3 text-sm ${
            notice.kind === 'ok' ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'
          }`}
        >
          {notice.text}
        </p>
      )}

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
          className="h-9 min-w-0 flex-1 rounded-lg border border-neutral-300 px-3 text-sm outline-none ring-indigo-500 focus:ring-2"
        />
        <button
          type="submit"
          disabled={pending || !draft.trim()}
          className="shrink-0 rounded-lg bg-neutral-900 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-indigo-600 disabled:opacity-40"
        >
          추가
        </button>
      </form>

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
              className={`flex items-center gap-2 bg-white pr-3 transition ${
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
                  </div>

                  <div className="flex shrink-0 gap-1.5">
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
                        if (!confirm(`'${s.name}' 분야를 지울까요?`)) return
                        act(() => deleteSpecialty(s.id), '지웠습니다.')
                      }}
                      disabled={pending}
                      className="rounded-md border border-red-200 px-2 py-1 text-[11px] font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                    >
                      삭제
                    </button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      <p className="mt-3 text-xs text-neutral-400">
        손잡이를 끌어 탐색 화면에 보이는 차례를 바꿉니다. 쓰는 디자이너가 있는 분야는 지울 수
        없으니 노출을 꺼 주세요 — 끄면 필터에서만 빠지고 프로필 표기는 남습니다.
      </p>
    </section>
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
        className="h-8 min-w-0 flex-1 rounded border border-neutral-300 px-2 text-sm outline-none ring-indigo-500 focus:ring-2"
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
