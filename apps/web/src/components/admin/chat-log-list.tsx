'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useActionTransition } from '@/lib/use-action-transition'
import { MAX_KNOWLEDGE_BODY, type ChatLog } from '@/lib/chat-shape'
import { addKnowledgeFromLog, resolveLog } from '@/app/admin/chat/actions'
import { Flash } from '@/components/flash'
import { dateTime } from '@/lib/format-date'

type Notice = { kind: 'ok' | 'error'; text: string } | null

/* 대화 기록(0023_chat.sql).

   챗봇을 정확하게 만드는 일은 모델을 길들이는 것이 아니라 이 목록을 읽는 것이다.
   '답변 필요' 는 모델이 모른다고 답한 줄이다 — 그 질문이 곧 다음에 적을 지식이다.
   그래서 줄 안에서 바로 지식을 적고, 적으면 그 줄이 목록에서 내려간다.

   추측으로 프롬프트를 고치지 않는다 — 실제로 들어온 질문을 보고 고친다. */
export function ChatLogList({ logs, todoOnly }: { logs: ChatLog[]; todoOnly: boolean }) {
  const [notice, setNotice] = useState<Notice>(null)
  /* 지금 지식을 적고 있는 줄 */
  const [writing, setWriting] = useState<string | null>(null)
  const [open, setOpen] = useState<Set<string>>(new Set())
  const [pending, start] = useActionTransition()
  const router = useRouter()

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

  if (logs.length === 0) {
    return (
      <section className="rounded-xl bg-white p-5 ring-1 ring-neutral-200 md:p-6">
        <Flash msg={notice} onDone={() => setNotice(null)} className="mb-3" />
        <p className="rounded-xl border border-dashed border-neutral-300 py-12 text-center text-sm text-neutral-500">
          {todoOnly ? (
            <>
              답변 필요한 질문이 없습니다.
              <br />
              <span className="text-xs text-neutral-400">
                챗봇이 모른다고 답한 질문이 여기에 모입니다.
              </span>
            </>
          ) : (
            <>
              아직 대화가 없습니다.
              <br />
              <span className="text-xs text-neutral-400">
                우하단 단추를 눌러 직접 물어보면 여기에 쌓입니다.
              </span>
            </>
          )}
        </p>
      </section>
    )
  }

  return (
    <section className="rounded-xl bg-white p-5 ring-1 ring-neutral-200 md:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold">
          {todoOnly ? `답변 필요 ${logs.length}건` : `대화 ${logs.length}건`}
        </h2>
        <p className="text-xs text-neutral-500">질문을 누르면 답과 함께 펼쳐집니다</p>
      </div>

      <Flash msg={notice} onDone={() => setNotice(null)} className="mt-3" />

      <ul className="mt-4 divide-y divide-neutral-200 overflow-hidden rounded-xl ring-1 ring-neutral-200">
        {logs.map((l) => (
          <li key={l.id} className={l.error ? 'bg-red-50/40' : 'bg-white'}>
            <div className="flex flex-wrap items-center gap-x-2 px-3">
              <button
                onClick={() => toggleOpen(l.id)}
                aria-expanded={open.has(l.id)}
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
                    open.has(l.id) ? 'rotate-90' : ''
                  }`}
                >
                  <path d="M6 3l5 5-5 5" />
                </svg>
                <span className="min-w-0">
                  <span className="text-sm font-medium">{l.question || '(빈 질문)'}</span>
                  {l.unanswered && !l.resolved && (
                    <span className="ml-1.5 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                      답변 필요
                    </span>
                  )}
                  {l.resolved && <span className="ml-1.5 text-xs text-neutral-400">· 처리됨</span>}
                  {l.error && (
                    <span className="ml-1.5 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">
                      실패
                    </span>
                  )}
                  <span className="ml-1.5 text-[11px] text-neutral-400">
                    {dateTime(l.created_at)}
                  </span>
                </span>
              </button>

              <div className="flex basis-full flex-wrap items-center gap-1.5 pb-3 pl-6 md:basis-auto md:shrink-0 md:flex-nowrap md:pb-0 md:pl-0">
                {/* 이 질문으로 지식을 적는다 — 적으면 줄이 목록에서 내려간다 */}
                <button
                  onClick={() => setWriting(writing === l.id ? null : l.id)}
                  disabled={pending}
                  className={ghost}
                >
                  {writing === l.id ? '접기' : '지식 적기'}
                </button>
                {l.resolved ? (
                  <button
                    onClick={() => act(() => resolveLog(l.id, false), '목록으로 올렸습니다.')}
                    disabled={pending}
                    className={ghost}
                  >
                    되돌리기
                  </button>
                ) : (
                  <button
                    onClick={() => act(() => resolveLog(l.id), '목록에서 내렸습니다.')}
                    disabled={pending}
                    className={ghost}
                    title="지식을 적지 않고 목록에서만 내립니다 — 장난글이나 주제와 먼 질문"
                  >
                    내리기
                  </button>
                )}
              </div>

              {open.has(l.id) && (
                <div className="basis-full space-y-2 pb-3.5 pl-6 pr-1">
                  <p className="whitespace-pre-wrap rounded-lg bg-neutral-50 px-3 py-2.5 text-sm leading-relaxed text-neutral-700">
                    {l.answer || <span className="text-neutral-400">답이 비어 있습니다.</span>}
                  </p>
                  {l.error && (
                    <p className="rounded-lg bg-red-50 px-3 py-2.5 text-xs text-red-700">
                      실패한 까닭: {l.error}
                    </p>
                  )}
                  <p className="text-[11px] text-neutral-400">
                    토큰 입력 {l.tokens_in.toLocaleString('ko-KR')} · 출력{' '}
                    {l.tokens_out.toLocaleString('ko-KR')}
                    {l.session_id && ` · 대화 ${l.session_id.slice(0, 8)}`}
                  </p>
                </div>
              )}

              {/* 지식 적기 — 이 질문을 제목으로 깔아 두고 답만 적게 한다 */}
              {writing === l.id && (
                <div className="basis-full pb-3.5 pl-6 pr-1">
                  <KnowledgeFromLog
                    question={l.question}
                    pending={pending}
                    onCancel={() => setWriting(null)}
                    onSubmit={(title, body) =>
                      act(async () => {
                        const r = await addKnowledgeFromLog(l.id, title, body)
                        if (r.ok) setWriting(null)
                        return r
                      }, '지식을 추가하고 목록에서 내렸습니다.')
                    }
                  />
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

/* 들어온 질문을 제목으로 두고 답을 적는 폼 — 그대로 지식 카드가 된다 */
function KnowledgeFromLog({
  question,
  pending,
  onCancel,
  onSubmit,
}: {
  question: string
  pending: boolean
  onCancel: () => void
  onSubmit: (title: string, body: string) => void
}) {
  const [title, setTitle] = useState(question)
  const [body, setBody] = useState('')

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (title.trim() && body.trim()) onSubmit(title, body)
      }}
      className="space-y-2 rounded-xl bg-neutral-50 p-3 ring-1 ring-neutral-200"
    >
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="제목 — 들어온 질문을 그대로 두거나 다듬습니다"
        className="h-9 w-full min-w-0 rounded-lg border border-neutral-300 bg-white px-3 text-sm outline-none ring-violet-500 focus:ring-2"
      />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="이 질문에 어떻게 답해야 하는지 적습니다. 다음부터 챗봇이 이 글로 답합니다"
        maxLength={MAX_KNOWLEDGE_BODY}
        rows={4}
        autoFocus
        className="w-full min-w-0 resize-y rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm leading-relaxed outline-none ring-violet-500 focus:ring-2"
      />
      <div className="flex items-center justify-end gap-1.5">
        <button type="button" onClick={onCancel} disabled={pending} className={ghost}>
          취소
        </button>
        <button
          type="submit"
          disabled={pending || !title.trim() || !body.trim()}
          className="rounded-lg bg-neutral-900 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-violet-600 disabled:opacity-40"
        >
          지식으로 추가
        </button>
      </div>
    </form>
  )
}

const ghost =
  'rounded-md border border-neutral-300 px-2 py-1 text-[11px] font-medium text-neutral-700 transition hover:bg-neutral-100 disabled:opacity-50'
