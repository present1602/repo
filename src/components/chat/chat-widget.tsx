'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { InquiryModal } from '@/components/inquiry/inquiry-modal'
import { MAX_CHAT_INPUT, MAX_CHAT_TURNS, type ChatTurn } from '@/lib/chat-shape'

/* 우하단 문의 챗봇.

   실패를 말풍선 자리에 그린다 — 이 패널은 `fixed z-40` 안에 있어서, 바깥
   본문에 알림을 그리면 패널 뒤로 깔려 보이지 않는다(AGENTS.md). 그래서
   Flash 를 쓰지 않고 대화 줄 안에 에러 버블로 남긴다: 사용자는 무엇이
   잘못됐는지 읽고, 적어 둔 말은 입력칸에 그대로 남는다.

   답은 토막토막 받아 그린다 — 통째로 기다리면 몇 초간 아무 일도 없는 화면이다.

   관리 화면(/admin, /studio)과 제안서에는 붙이지 않는다 — 푸터와 같은 방침. */
const HIDDEN = ['/admin', '/studio', '/designers/proposal']

type Line =
  | { kind: 'user' | 'bot'; text: string }
  /* 실패 — 대화 줄 안에 남긴다. 다시 묻게 하려고 지우지 않는다 */
  | { kind: 'error'; text: string }

export function ChatWidget({ adminOnly }: { adminOnly: boolean }) {
  const pathname = usePathname() ?? ''
  const [open, setOpen] = useState(false)
  const [lines, setLines] = useState<Line[]>([])
  const [draft, setDraft] = useState('')
  /* 지금 흘러들어오는 답 — 다 받으면 lines 로 옮긴다 */
  const [streaming, setStreaming] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [inquiryOpen, setInquiryOpen] = useState(false)

  /* 대화 묶음 — 창을 새로 열면 새 묶음이라 서버의 횟수 상한이 다시 센다.

     그릴 때 만들지 않는다 — crypto.randomUUID() 는 매번 달라지는 값이라
     프리렌더를 막는다(Next 16). 처음 보낼 때 한 번 만든다. */
  const sessionId = useRef<string>('')
  const scroller = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const session = () => (sessionId.current ||= crypto.randomUUID())

  /* 새 줄이 붙으면 아래로 — 답이 길어도 끝이 보이게 */
  useEffect(() => {
    const el = scroller.current
    if (el) el.scrollTop = el.scrollHeight
  }, [lines, streaming])

  /* 열면 바로 적을 수 있게 */
  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  if (HIDDEN.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return null

  /* 주고받은 횟수 — 서버도 세지만 누르기 전에 막아 준다 */
  const turns = lines.filter((l) => l.kind === 'user').length
  const tooMany = turns >= MAX_CHAT_TURNS
  const tooLong = draft.length > MAX_CHAT_INPUT
  const canSend = Boolean(draft.trim()) && !sending && !tooMany && !tooLong

  const send = async () => {
    const message = draft.trim()
    if (!message || sending || tooMany || tooLong) return

    /* 지난 대화 — 에러 줄은 보내지 않는다. 모델에게는 주고받은 말만 맥락이다 */
    const history: ChatTurn[] = lines
      .filter((l): l is { kind: 'user' | 'bot'; text: string } => l.kind !== 'error')
      .map((l) => ({ role: l.kind === 'user' ? 'user' : 'assistant', text: l.text }))

    setLines((cur) => [...cur, { kind: 'user', text: message }])
    /* 입력칸은 보낸 뒤에 비운다 — 실패하면 아래에서 되돌려 적어 둔 말을 잃지 않게 */
    setDraft('')
    setSending(true)
    setStreaming('')

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sessionId: session(), message, history }),
      })

      /* 서버가 거절했다 — { ok:false, error } 를 읽어 그 문구를 그대로 보여 준다.
         삼키면 누른 사람에게는 아무 일도 안 일어난 화면이 된다(AGENTS.md). */
      if (!res.ok || !res.body) {
        let text = '답변을 가져오지 못했습니다. 잠시 후 다시 시도해 주세요.'
        try {
          const j = (await res.json()) as { error?: string }
          if (j.error) text = j.error
        } catch {
          /* 본문이 JSON 이 아니다(프록시 오류 등) — 위 기본 문구를 쓴다 */
        }
        setStreaming(null)
        setLines((cur) => [...cur, { kind: 'error', text }])
        setDraft(message)
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let answer = ''

      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        answer += decoder.decode(value, { stream: true })
        setStreaming(answer)
      }

      setStreaming(null)
      /* 빈 답이면 그것도 실패다 — 빈 말풍선을 두고 끝내지 않는다 */
      if (answer.trim()) {
        setLines((cur) => [...cur, { kind: 'bot', text: answer }])
      } else {
        setLines((cur) => [
          ...cur,
          { kind: 'error', text: '답변이 비어 있습니다. 다시 물어봐 주세요.' },
        ])
        setDraft(message)
      }
    } catch {
      /* 인터넷이 끊겼거나 요청이 서버에 닿지 못했다 */
      setStreaming(null)
      setLines((cur) => [
        ...cur,
        { kind: 'error', text: '연결에 실패했습니다. 잠시 후 다시 시도해 주세요.' },
      ])
      setDraft(message)
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      {/* 여는 단추 — 패널이 열려 있으면 숨긴다(좁은 화면에서 겹친다) */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="문의 챗봇 열기"
          className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-violet-600 px-4 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-violet-700"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden className="size-5">
            <path d="M21 12a8 8 0 0 1-8 8H8l-4 3v-4.5A8 8 0 0 1 13 4a8 8 0 0 1 8 8Z" />
          </svg>
          문의하기
          {adminOnly && (
            <span className="rounded bg-white/20 px-1.5 py-0.5 text-[10px] font-semibold">
              어드민
            </span>
          )}
        </button>
      )}

      {open && (
        <div
          role="dialog"
          aria-label="문의 챗봇"
          className="fixed inset-x-3 bottom-3 z-40 flex max-h-[min(80vh,560px)] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-neutral-200 sm:inset-x-auto sm:right-5 sm:w-[23rem]"
        >
          {/* 머리 */}
          <div className="flex shrink-0 items-center gap-2 border-b border-neutral-200 px-4 py-3">
            <span className="grid size-6 place-items-center rounded-md bg-violet-600 text-[11px] font-bold text-white">
              S
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">무엇이든 물어보세요</p>
              <p className="truncate text-[11px] text-neutral-500">
                {adminOnly ? '공개 전 — 어드민에게만 보입니다' : '의뢰 전 궁금한 점을 답해 드립니다'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="닫기"
              className="grid size-8 shrink-0 place-items-center rounded-md text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden className="size-4">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>

          {/* 대화 */}
          <div ref={scroller} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {lines.length === 0 && streaming == null && (
              <div className="space-y-3">
                <Bubble kind="bot">
                  안녕하세요. 의뢰 전 궁금한 점을 물어보세요 — 분야, 작업 범위, 시작가,
                  진행 방식 같은 것을 알려 드립니다.
                </Bubble>
                <p className="text-[11px] leading-relaxed text-neutral-400">
                  정확한 견적과 일정은 의뢰를 남겨 주시면 안내드립니다.
                </p>
              </div>
            )}

            {lines.map((l, i) => (
              <Bubble key={i} kind={l.kind}>
                {l.text}
              </Bubble>
            ))}

            {/* 흘러들어오는 답 — 아직 한 글자도 안 왔으면 도는 중인 것을 보여준다 */}
            {streaming != null &&
              (streaming ? (
                <Bubble kind="bot">{streaming}</Bubble>
              ) : (
                <p className="flex items-center gap-1.5 text-xs text-neutral-400">
                  <span className="size-1.5 animate-pulse rounded-full bg-neutral-400" />
                  답변을 쓰고 있습니다…
                </p>
              ))}
          </div>

          {/* 적는 자리 */}
          <div className="shrink-0 border-t border-neutral-200 px-3 py-3">
            {tooMany ? (
              <div className="rounded-lg bg-neutral-50 px-3 py-3 text-center">
                <p className="text-xs text-neutral-600">
                  대화가 길어졌습니다. 자세한 내용은 의뢰로 남겨 주세요.
                </p>
                <button
                  type="button"
                  onClick={() => setInquiryOpen(true)}
                  className="mt-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-700"
                >
                  의뢰하기
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-end gap-2">
                  <textarea
                    ref={inputRef}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      /* Enter 로 보내고, Shift+Enter 로 줄을 바꾼다.
                         한글 조합 중(isComposing)에는 Enter 가 글자를 확정하는
                         키다 — 여기서 보내면 마지막 글자가 잘린 채로 나간다. */
                      if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) return
                      e.preventDefault()
                      void send()
                    }}
                    rows={1}
                    placeholder="예: 로고만 따로 의뢰할 수 있나요?"
                    className="max-h-28 min-w-0 flex-1 resize-none rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none ring-violet-500 placeholder:text-neutral-400 focus:ring-2"
                  />
                  <button
                    type="button"
                    onClick={() => void send()}
                    disabled={!canSend}
                    className="shrink-0 rounded-lg bg-neutral-900 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-violet-600 disabled:opacity-40"
                  >
                    {sending ? '…' : '보내기'}
                  </button>
                </div>

                {/* 누르기 전에 막은 까닭을 입력칸 옆에 적는다 */}
                {tooLong && (
                  <p className="mt-1.5 text-[11px] text-red-600">
                    {MAX_CHAT_INPUT}자까지 보낼 수 있습니다. 내용이 길면 의뢰로 남겨 주세요.
                  </p>
                )}

                <button
                  type="button"
                  onClick={() => setInquiryOpen(true)}
                  className="mt-2 w-full text-[11px] text-neutral-400 transition hover:text-violet-600"
                >
                  바로 의뢰 남기기 →
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* 의뢰 폼 — 챗봇의 목적은 답이 아니라 여기까지 오는 것이다.
          폼은 z-50 이라 이 패널(z-40) 위에 뜬다. */}
      {inquiryOpen && <InquiryModal onClose={() => setInquiryOpen(false)} />}
    </>
  )
}

function Bubble({ kind, children }: { kind: Line['kind']; children: React.ReactNode }) {
  if (kind === 'user') {
    return (
      <p className="ml-auto w-fit max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-violet-600 px-3.5 py-2.5 text-sm leading-relaxed text-white">
        {children}
      </p>
    )
  }

  /* 실패 — 대화 줄 안에 빨간 버블로 남긴다. 패널 바깥에 그리면 뒤로 깔려 안 보인다 */
  if (kind === 'error') {
    return (
      <p className="w-fit max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-bl-sm bg-red-50 px-3.5 py-2.5 text-sm leading-relaxed text-red-700">
        {children}
      </p>
    )
  }

  return (
    <p className="w-fit max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-bl-sm bg-neutral-100 px-3.5 py-2.5 text-sm leading-relaxed text-neutral-800">
      {children}
    </p>
  )
}
