'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useActionTransition } from '@/lib/use-action-transition'
import { MAX_FAQ_ANSWER, MAX_FAQ_QUESTION, type Faq } from '@/lib/faq-shape'
import { addFaq, updateFaq, setFaqVisible, reorderFaqs, deleteFaq } from '@/app/admin/settings/actions'
import { Flash } from '@/components/flash'

type Notice = { kind: 'ok' | 'error'; text: string } | null

/* 자주 묻는 질문 관리(0015_faqs.sql).

   공개 화면과 같은 모양으로 보여 준다 — 제목만 한 줄로 두고, 누르면 내용이 펼쳐진다.
   순서는 손잡이를 끌어 바꾸고(SpecialtyManager 와 같은 방식), 숨긴 질문은
   목록에 '숨김' 으로 남아 공개 화면에서만 빠진다. */
export function FaqManager({ faqs }: { faqs: Faq[] }) {
  const [notice, setNotice] = useState<Notice>(null)
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  /* 펼쳐 둔 질문 — 어드민에서도 공개 화면처럼 눌러 열어 본다 */
  const [open, setOpen] = useState<Set<string>>(new Set())
  const [pending, start] = useActionTransition()
  const router = useRouter()

  /* 끄는 동안에만 쓰는 순서 — 평소에는 서버가 준 목록을 그대로 그린다 */
  const [dragging, setDragging] = useState<{ id: string; ids: string[] } | null>(null)
  const [savingOrder, startOrder] = useActionTransition()

  const dragId = dragging?.id ?? null

  const order = (() => {
    if (!dragging) return faqs
    const byId = new Map(faqs.map((f) => [f.id, f]))
    const kept = dragging.ids.map((id) => byId.get(id)).filter((f) => f != null)
    const known = new Set(kept.map((f) => f.id))
    return [...kept, ...faqs.filter((f) => !known.has(f.id))]
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
      const from = order.findIndex((f) => f.id === cur.id)
      if (from === -1 || from === i) return cur
      const next = order.map((f) => f.id)
      const [id] = next.splice(from, 1)
      next.splice(i, 0, id)
      return { ...cur, ids: next }
    })
  }

  const commitOrder = () => {
    const moved = dragging
    setDragging(null)
    if (!moved) return
    if (faqs.map((f) => f.id).join() === moved.ids.join()) return

    startOrder(async () => {
      const r = await reorderFaqs(moved.ids)
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
        <h2 className="text-sm font-semibold">자주 묻는 질문</h2>
        <p className="text-xs text-neutral-500">
          제목을 누르면 내용이 펼쳐집니다
          {savingOrder && <span className="ml-1.5 text-neutral-400">· 순서 저장 중…</span>}
        </p>
      </div>

      <Flash msg={notice} onDone={() => setNotice(null)} className="mt-3" />

      {/* 추가 — 제목과 내용이 두 줄이라 버튼을 눌러 폼을 연다 */}
      {adding ? (
        <div className="mt-4 rounded-xl bg-neutral-50 p-3.5 ring-1 ring-neutral-200">
          <FaqForm
            pending={pending}
            submitLabel="추가"
            onCancel={() => setAdding(false)}
            onSubmit={(question, answer) =>
              act(async () => {
                const r = await addFaq(question, answer)
                if (r.ok) setAdding(false)
                return r
              }, '질문을 추가했습니다.')
            }
          />
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          disabled={pending}
          className="mt-4 w-full rounded-lg border border-dashed border-neutral-300 py-2.5 text-sm font-medium text-neutral-600 transition hover:border-violet-400 hover:text-violet-700 disabled:opacity-50"
        >
          + 질문 추가
        </button>
      )}

      {faqs.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-neutral-300 py-12 text-center text-sm text-neutral-500">
          아직 등록된 질문이 없습니다.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-neutral-200 overflow-hidden rounded-xl ring-1 ring-neutral-200">
          {order.map((f, i) => (
            <li
              key={f.id}
              onDragOver={(e) => {
                if (dragId == null) return
                e.preventDefault()
                moveTo(i)
              }}
              className={`transition ${dragId === f.id ? 'opacity-40' : ''} ${
                f.visible ? 'bg-white' : 'bg-neutral-50'
              }`}
            >
              {editing === f.id ? (
                <div className="p-3.5">
                  <FaqForm
                    faq={f}
                    pending={pending}
                    submitLabel="저장"
                    onCancel={() => setEditing(null)}
                    onSubmit={(question, answer) =>
                      act(async () => {
                        const r = await updateFaq(f.id, question, answer)
                        if (r.ok) setEditing(null)
                        return r
                      }, '질문을 저장했습니다.')
                    }
                  />
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-x-2 pr-3">
                  {/* 끌기 손잡이 — 여기서만 끌 수 있다 */}
                  <span
                    draggable
                    onDragStart={(e) => {
                      setDragging({ id: f.id, ids: faqs.map((x) => x.id) })
                      e.dataTransfer.effectAllowed = 'move'
                      /* Firefox 는 데이터가 없으면 드래그를 시작하지 않는다 */
                      e.dataTransfer.setData('text/plain', f.id)
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

                  {/* 제목 — 공개 화면처럼 눌러 내용을 펼친다 */}
                  <button
                    onClick={() => toggleOpen(f.id)}
                    aria-expanded={open.has(f.id)}
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
                        open.has(f.id) ? 'rotate-90' : ''
                      }`}
                    >
                      <path d="M6 3l5 5-5 5" />
                    </svg>
                    <span className="min-w-0">
                      <span
                        className={`text-sm font-medium ${f.visible ? '' : 'text-neutral-400 line-through'}`}
                      >
                        {f.question}
                      </span>
                      {!f.visible && <span className="ml-1.5 text-xs text-neutral-500">· 숨김</span>}
                      {!f.answer && (
                        <span className="ml-1.5 text-xs text-amber-700">내용 없음</span>
                      )}
                    </span>
                  </button>

                  {/* 좁은 화면에서는 제목 아래로 내려 접히게 하고(손잡이 폭만큼 들여),
                      넓은 화면에서는 오른쪽 한 줄 — SpecialtyManager 와 같은 방식 */}
                  <div className="flex basis-full flex-wrap items-center gap-1.5 pb-3 pl-8 md:basis-auto md:shrink-0 md:flex-nowrap md:pb-0 md:pl-0">
                    <button onClick={() => setEditing(f.id)} disabled={pending} className={ghost}>
                      수정
                    </button>
                    <button
                      onClick={() => act(() => setFaqVisible(f.id, !f.visible))}
                      disabled={pending}
                      className={ghost}
                    >
                      {f.visible ? '숨기기' : '노출'}
                    </button>
                    <button
                      onClick={() => {
                        if (!confirm(`'${f.question}' 질문을 지울까요?`)) return
                        act(() => deleteFaq(f.id), '지웠습니다.')
                      }}
                      disabled={pending}
                      className="rounded-md border border-red-200 px-2 py-1 text-[11px] font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                    >
                      삭제
                    </button>
                  </div>

                  {/* 펼친 내용 — 줄바꿈을 그대로 살려 공개 화면과 같이 보여 준다 */}
                  {open.has(f.id) && (
                    <p className="basis-full whitespace-pre-wrap pb-3.5 pl-8 pr-1 text-sm leading-relaxed text-neutral-600">
                      {f.answer || <span className="text-neutral-400">내용이 비어 있습니다.</span>}
                    </p>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <p className="mt-3 text-xs text-neutral-400">
        손잡이를 끌어 공개 화면에 보이는 차례를 바꿉니다. 숨긴 질문은 공개 화면에서만 빠지고 이
        목록에는 남습니다. 내용은 줄바꿈을 적은 그대로 나갑니다.
      </p>
    </section>
  )
}

/* 질문 한 쌍을 적는 폼 — 추가와 수정이 같은 모양을 쓴다 */
function FaqForm({
  faq,
  pending,
  submitLabel,
  onCancel,
  onSubmit,
}: {
  faq?: Faq
  pending: boolean
  submitLabel: string
  onCancel: () => void
  onSubmit: (question: string, answer: string) => void
}) {
  const [question, setQuestion] = useState(faq?.question ?? '')
  const [answer, setAnswer] = useState(faq?.answer ?? '')

  const unchanged = faq != null && question === faq.question && answer === faq.answer

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (question.trim()) onSubmit(question, answer)
      }}
      className="space-y-2"
    >
      <input
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder="질문 — 예: 작업 기간은 얼마나 걸리나요?"
        maxLength={MAX_FAQ_QUESTION}
        autoFocus
        className="h-9 w-full min-w-0 rounded-lg border border-neutral-300 bg-white px-3 text-sm outline-none ring-violet-500 placeholder:text-neutral-400 focus:ring-2"
      />
      <textarea
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        placeholder="답변 — 제목을 누르면 펼쳐지는 내용. 줄바꿈은 그대로 나갑니다"
        maxLength={MAX_FAQ_ANSWER}
        rows={4}
        className="w-full min-w-0 resize-y rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm leading-relaxed outline-none ring-violet-500 placeholder:text-neutral-400 focus:ring-2"
      />
      <div className="flex items-center justify-end gap-1.5">
        <button type="button" onClick={onCancel} disabled={pending} className={ghost}>
          취소
        </button>
        <button
          type="submit"
          disabled={pending || !question.trim() || unchanged}
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
