'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useActionTransition } from '@/lib/use-action-transition'
import {
  MAX_KNOWLEDGE_BODY,
  MAX_KNOWLEDGE_TITLE,
  type ChatKnowledge,
} from '@/lib/chat-shape'
import {
  addKnowledge,
  updateKnowledge,
  setKnowledgeEnabled,
  reorderKnowledge,
  deleteKnowledge,
} from '@/app/admin/chat/actions'
import { Flash } from '@/components/flash'

type Notice = { kind: 'ok' | 'error'; text: string } | null

/* 챗봇 지식 카드 관리(0023_chat.sql).

   FaqManager 와 같은 짜임이다 — 제목만 한 줄로 두고, 누르면 내용이 펼쳐지고,
   손잡이를 끌어 차례를 바꾼다. 다른 것은 쓰임이다: 이 글은 공개 화면에
   나가지 않고 챗봇이 답을 만들 때 읽는다.

   차례는 모델이 먼저 읽는 순서다 — 자주 묻는 것을 위로 올린다. */
export function KnowledgeManager({
  knowledge,
  /* 처음 열 때 폼을 펼친 채 둘지 — '답변 필요' 에서 넘어왔을 때 쓴다 */
  initialTitle = '',
}: {
  knowledge: ChatKnowledge[]
  initialTitle?: string
}) {
  const [notice, setNotice] = useState<Notice>(null)
  const [adding, setAdding] = useState(Boolean(initialTitle))
  const [editing, setEditing] = useState<string | null>(null)
  const [open, setOpen] = useState<Set<string>>(new Set())
  const [pending, start] = useActionTransition()
  const router = useRouter()

  /* 끄는 동안에만 쓰는 차례 — 평소에는 서버가 준 목록을 그대로 그린다 */
  const [dragging, setDragging] = useState<{ id: string; ids: string[] } | null>(null)
  const [savingOrder, startOrder] = useActionTransition()

  const dragId = dragging?.id ?? null

  const order = (() => {
    if (!dragging) return knowledge
    const byId = new Map(knowledge.map((k) => [k.id, k]))
    const kept = dragging.ids.map((id) => byId.get(id)).filter((k) => k != null)
    const known = new Set(kept.map((k) => k.id))
    return [...kept, ...knowledge.filter((k) => !known.has(k.id))]
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

  const toggleOpen = (id: string) =>
    setOpen((cur) => {
      const next = new Set(cur)
      if (!next.delete(id)) next.add(id)
      return next
    })

  const moveTo = (i: number) => {
    setDragging((cur) => {
      if (!cur) return cur
      const from = order.findIndex((k) => k.id === cur.id)
      if (from === -1 || from === i) return cur
      const next = order.map((k) => k.id)
      const [id] = next.splice(from, 1)
      next.splice(i, 0, id)
      return { ...cur, ids: next }
    })
  }

  const commitOrder = () => {
    const moved = dragging
    setDragging(null)
    if (!moved) return
    if (knowledge.map((k) => k.id).join() === moved.ids.join()) return

    startOrder(async () => {
      const r = await reorderKnowledge(moved.ids)
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
        <h2 className="text-sm font-semibold">지식 카드 {knowledge.length}개</h2>
        <p className="text-xs text-neutral-500">
          제목을 누르면 내용이 펼쳐집니다
          {savingOrder && <span className="ml-1.5 text-neutral-400">· 차례 저장 중…</span>}
        </p>
      </div>

      <Flash msg={notice} onDone={() => setNotice(null)} className="mt-3" />

      {adding ? (
        <div className="mt-4 rounded-xl bg-neutral-50 p-3.5 ring-1 ring-neutral-200">
          <KnowledgeForm
            initialTitle={initialTitle}
            pending={pending}
            submitLabel="추가"
            onCancel={() => setAdding(false)}
            onSubmit={(title, body) =>
              act(async () => {
                const r = await addKnowledge(title, body)
                if (r.ok) setAdding(false)
                return r
              }, '지식을 추가했습니다.')
            }
          />
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          disabled={pending}
          className="mt-4 w-full rounded-lg border border-dashed border-neutral-300 py-2.5 text-sm font-medium text-neutral-600 transition hover:border-violet-400 hover:text-violet-700 disabled:opacity-50"
        >
          + 지식 추가
        </button>
      )}

      {knowledge.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-neutral-300 py-12 text-center text-sm text-neutral-500">
          아직 등록된 지식이 없습니다.
          <br />
          <span className="text-xs text-neutral-400">
            분야·가격·플랜 문구와 FAQ 는 이미 챗봇이 읽습니다. 여기에는 그 밖의 지식을 적습니다.
          </span>
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-neutral-200 overflow-hidden rounded-xl ring-1 ring-neutral-200">
          {order.map((k, i) => (
            <li
              key={k.id}
              onDragOver={(e) => {
                if (dragId == null) return
                e.preventDefault()
                moveTo(i)
              }}
              className={`transition ${dragId === k.id ? 'opacity-40' : ''} ${
                k.enabled ? 'bg-white' : 'bg-neutral-50'
              }`}
            >
              {editing === k.id ? (
                <div className="p-3.5">
                  <KnowledgeForm
                    card={k}
                    pending={pending}
                    submitLabel="저장"
                    onCancel={() => setEditing(null)}
                    onSubmit={(title, body) =>
                      act(async () => {
                        const r = await updateKnowledge(k.id, title, body)
                        if (r.ok) setEditing(null)
                        return r
                      }, '지식을 저장했습니다.')
                    }
                  />
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-x-2 pr-3">
                  {/* 끌기 손잡이 — 여기서만 끌 수 있다 */}
                  <span
                    draggable
                    onDragStart={(e) => {
                      setDragging({ id: k.id, ids: knowledge.map((x) => x.id) })
                      e.dataTransfer.effectAllowed = 'move'
                      /* Firefox 는 데이터가 없으면 드래그를 시작하지 않는다 */
                      e.dataTransfer.setData('text/plain', k.id)
                    }}
                    onDragEnd={commitOrder}
                    aria-label="끌어서 차례 바꾸기"
                    title="끌어서 차례 바꾸기 — 위에 둔 것을 모델이 먼저 읽습니다"
                    className="flex w-8 shrink-0 cursor-grab touch-none items-center justify-center self-stretch text-neutral-300 hover:text-neutral-600 active:cursor-grabbing"
                  >
                    <svg viewBox="0 0 16 16" fill="currentColor" className="size-4">
                      {[4, 8, 12].map((cy) =>
                        [6, 10].map((cx) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1.3" />),
                      )}
                    </svg>
                  </span>

                  <button
                    onClick={() => toggleOpen(k.id)}
                    aria-expanded={open.has(k.id)}
                    className="flex min-w-0 flex-1 items-start gap-2 py-3 text-left"
                  >
                    <svg
                      viewBox="0 0 16 16"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1.8}
                      strokeLinecap="round"
                      aria-hidden
                      className={`mt-0.5 size-3.5 shrink-0 text-neutral-400 transition-transform ${
                        open.has(k.id) ? 'rotate-90' : ''
                      }`}
                    >
                      <path d="M6 3l5 5-5 5" />
                    </svg>
                    <span className="min-w-0">
                      <span
                        className={`text-sm font-medium ${k.enabled ? '' : 'text-neutral-400 line-through'}`}
                      >
                        {k.title}
                      </span>
                      {!k.enabled && <span className="ml-1.5 text-xs text-neutral-500">· 끔</span>}
                      {!k.body && <span className="ml-1.5 text-xs text-amber-700">내용 없음</span>}
                    </span>
                  </button>

                  <div className="flex basis-full flex-wrap items-center gap-1.5 pb-3 pl-8 md:basis-auto md:shrink-0 md:flex-nowrap md:pb-0 md:pl-0">
                    <button onClick={() => setEditing(k.id)} disabled={pending} className={ghost}>
                      수정
                    </button>
                    <button
                      onClick={() => act(() => setKnowledgeEnabled(k.id, !k.enabled))}
                      disabled={pending}
                      className={ghost}
                    >
                      {k.enabled ? '끄기' : '켜기'}
                    </button>
                    <button
                      onClick={() => {
                        if (!confirm(`'${k.title}' 지식을 지울까요?`)) return
                        act(() => deleteKnowledge(k.id), '지웠습니다.')
                      }}
                      disabled={pending}
                      className="rounded-md border border-red-200 px-2 py-1 text-[11px] font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                    >
                      삭제
                    </button>
                  </div>

                  {open.has(k.id) && (
                    <p className="basis-full whitespace-pre-wrap pb-3.5 pl-8 pr-1 text-sm leading-relaxed text-neutral-600">
                      {k.body || <span className="text-neutral-400">내용이 비어 있습니다.</span>}
                    </p>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <p className="mt-3 text-xs text-neutral-400">
        끈 지식은 챗봇이 읽지 않고 이 목록에는 남습니다. 손잡이를 끌어 차례를 바꾸면 위에 둔
        것을 모델이 먼저 읽습니다. 금액은 적어 둔 숫자만 그대로 말하므로, 바뀔 금액은 설정의
        분야·플랜에 넣는 편이 안전합니다.
      </p>
    </section>
  )
}

/* 지식 한 장을 적는 폼 — 추가와 수정이 같은 모양을 쓴다 */
function KnowledgeForm({
  card,
  initialTitle = '',
  pending,
  submitLabel,
  onCancel,
  onSubmit,
}: {
  card?: ChatKnowledge
  initialTitle?: string
  pending: boolean
  submitLabel: string
  onCancel: () => void
  onSubmit: (title: string, body: string) => void
}) {
  const [title, setTitle] = useState(card?.title ?? initialTitle)
  const [body, setBody] = useState(card?.body ?? '')

  const unchanged = card != null && title === card.title && body === card.body

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (title.trim()) onSubmit(title, body)
      }}
      className="space-y-2"
    >
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="제목 — 예: 작업 기간이 늘어나는 경우"
        maxLength={MAX_KNOWLEDGE_TITLE}
        autoFocus
        className="h-9 w-full min-w-0 rounded-lg border border-neutral-300 bg-white px-3 text-sm outline-none ring-violet-500 placeholder:text-neutral-400 focus:ring-2"
      />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="내용 — 챗봇이 이 글을 근거로 답합니다. 적지 않은 것은 '모른다'고 답합니다"
        maxLength={MAX_KNOWLEDGE_BODY}
        rows={6}
        className="w-full min-w-0 resize-y rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm leading-relaxed outline-none ring-violet-500 placeholder:text-neutral-400 focus:ring-2"
      />
      <div className="flex items-center justify-end gap-1.5">
        <button type="button" onClick={onCancel} disabled={pending} className={ghost}>
          취소
        </button>
        <button
          type="submit"
          disabled={pending || !title.trim() || unchanged}
          className="rounded-lg bg-neutral-900 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-violet-600 disabled:opacity-40"
        >
          {submitLabel}
        </button>
      </div>
    </form>
  )
}

const ghost =
  'rounded-md border border-neutral-300 px-2 py-1 text-[11px] font-medium text-neutral-700 transition hover:bg-neutral-100 disabled:opacity-50'
