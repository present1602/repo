'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { InquiryModal } from '@/components/inquiry/inquiry-modal'
import {
  MAX_CHAT_INPUT,
  MAX_CHAT_TURNS,
  type ChatIntentNode,
  type ChatTurn,
} from '@/lib/chat-shape'

/* 우하단 문의 챗봇.

   실패를 말풍선 자리에 그린다 — 이 패널은 `fixed z-40` 안에 있어서, 바깥
   본문에 알림을 그리면 패널 뒤로 깔려 보이지 않는다(AGENTS.md). 그래서
   Flash 를 쓰지 않고 대화 줄 안에 에러 버블로 남긴다: 사용자는 무엇이
   잘못됐는지 읽고, 적어 둔 말은 입력칸에 그대로 남는다.

   답은 토막토막 받아 그린다 — 통째로 기다리면 몇 초간 아무 일도 없는 화면이다.

   관리 화면(/admin, /studio)과 제안서에는 붙이지 않는다 — 푸터와 같은 방침. */
const HIDDEN = ['/admin', '/studio', '/designers/proposal']

/* 여는 단추 자리.

   본문(max-w-7xl)을 따라간다. 화면이 넓어지면 본문은 가운데로 모이는데
   단추만 화면 끝에 남으면 포트폴리오 카드에서 멀찍이 떨어져 혼자 구석에 선다.

   바깥 흰 여백이 단추를 통째로 담을 만큼 넓으면 그 여백 안에 둔다 —
   카드를 한 조각도 가리지 않는다. 여백이 모자라면 화면 가장자리로 물러나
   카드 위에 겹친다. 좁은 화면에서는 가리더라도 손이 닿는 자리가 먼저다. */
const CONTENT_MAX = 1280 /* max-w-7xl */
const FAB_GAP = 16 /* 본문 좌우 여백(px-4)과 같은 값 — 아래쪽에도 쓴다 */
const FAB_SIZE = 56 /* size-14 */

/* 단추를 흰 여백 안에 온전히 두려면 필요한 폭 — 양옆 간격까지 친다 */
const FAB_CLEAR = FAB_SIZE + FAB_GAP * 2

/* 화면 너비에서 단추의 오른쪽 여백을 구한다.

   여백이 넉넉하면 카드 바깥선에서 FAB_GAP 만큼 더 띄운다(겹치지 않는다).
   모자라면 화면 가장자리 기준으로 물러난다. */
function fabRight(viewportWidth: number): number {
  const sideSpace = Math.max(0, (viewportWidth - CONTENT_MAX) / 2)
  /* 여백에 단추가 통째로 들어가면 카드 바깥에 세운다 */
  if (sideSpace >= FAB_CLEAR) return sideSpace - FAB_SIZE - FAB_GAP
  return FAB_GAP
}

type Line =
  | { kind: 'user' | 'bot'; text: string }
  /* 실패 — 대화 줄 안에 남긴다. 다시 묻게 하려고 지우지 않는다 */
  | { kind: 'error'; text: string }

export function ChatWidget({ adminOnly, intents }: { adminOnly: boolean; intents: ChatIntentNode[] }) {
  const pathname = usePathname() ?? ''
  const [open, setOpen] = useState(false)
  const [lines, setLines] = useState<Line[]>([])
  const [draft, setDraft] = useState('')
  /* 지금 깔아 둘 단추 — 처음에는 첫 단계, 하나 누르면 그 아래 단계로 바뀐다.
     비면 단추를 걷고 자유 질문으로 넘어간다(0027_chat_intents.sql). */
  const [options, setOptions] = useState<ChatIntentNode[]>(intents)
  /* 메뉴를 끝까지 따라와 고르기를 마쳤는지 — 그때 한 번만 의뢰 단추를 띄운다.
     평소 문답 뒤에 매번 띄우면 재촉으로 읽힌다. */
  const [picked, setPicked] = useState(false)
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
  const fab = useRef<HTMLButtonElement>(null)

  const session = () => (sessionId.current ||= crypto.randomUUID())

  /* 확대해도 단추가 보이는 자리에 남게 한다.

     position:fixed 는 '지금 보고 있는 화면'이 아니라 레이아웃 뷰포트에 붙는다.
     손가락으로 벌려 확대하면 보이는 범위만 좁아지므로, 오른쪽 아래에 있던
     단추는 화면 밖으로 밀려나 사라진다. 스크롤해도 따라오지 않는다.

     visualViewport 가 '지금 보고 있는 범위'를 알려 준다 — 그 오른쪽 아래에
     맞춰 단추 자리를 다시 적는다. 확대하지 않았을 때는 두 뷰포트가 같아서
     계산값이 원래 자리와 같다.

     이 API 가 없는 브라우저에서는 아무것도 하지 않는다 — 기본 자리가 그대로
     쓰인다(확대 전에는 어차피 같은 자리다). */
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv || open) return

    const place = () => {
      const el = fab.current
      if (!el) return
      /* 보이는 범위의 오른쪽·아래에서 떨어진 만큼 — 확대 배율만큼 여백도 줄여
         화면에 비치는 간격을 일정하게 둔다.

         오른쪽은 본문을 따라간다(fabRight). 확대하면 보이는 범위가 본문보다
         좁아지므로 그때는 화면 가장자리 기준으로 돌아간다 — 확대한 채로
         본문 선을 지키면 단추가 화면 밖에 남는다. */
      const gap = FAB_GAP / vv.scale
      const rightGap = vv.scale > 1 ? gap : fabRight(vv.width)
      const right = window.innerWidth - (vv.offsetLeft + vv.width) + rightGap
      const bottom = window.innerHeight - (vv.offsetTop + vv.height) + gap
      el.style.right = `${right}px`
      el.style.bottom = `${bottom}px`
      /* 확대하면 단추도 함께 커져 화면을 가린다 — 배율만큼 줄여 크기를 지킨다 */
      el.style.transform = `scale(${1 / vv.scale})`
      el.style.transformOrigin = 'bottom right'
    }

    place()
    vv.addEventListener('resize', place)
    vv.addEventListener('scroll', place)
    return () => {
      vv.removeEventListener('resize', place)
      vv.removeEventListener('scroll', place)
    }
  }, [open])

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

  /* 시작 메뉴에서 하나 골랐다.

     모델에 묻지 않는다 — 소개 멘트는 운영자가 적은 글이고, 그대로 보여야
     금액·기술이 바뀌지 않는다. 즉시 뜨고 값도 들지 않는다.

     고른 것과 띄운 멘트를 대화 줄에 남긴다 — 그래야 이어서 묻는 말에
     모델이 맥락을 안다(history 로 함께 보낸다). */
  const pick = (node: ChatIntentNode) => {
    setLines((cur) => {
      const next: Line[] = [...cur, { kind: 'user', text: node.label }]
      if (node.intro.trim()) next.push({ kind: 'bot', text: node.intro.trim() })
      return next
    })
    /* 아래 단계가 있으면 이어서 묻고, 없으면 단추를 걷는다 */
    setOptions(node.children)
    /* 더 고를 것이 없으면 고르기가 끝난 것이다 — 그때 의뢰 단추를 띄운다 */
    if (node.children.length === 0) setPicked(true)
  }

  const send = async () => {
    const message = draft.trim()
    if (!message || sending || tooMany || tooLong) return

    /* 적어서 물었으면 단추는 걷는다 — 고르는 길과 적는 길이 섞이지 않게 */
    setOptions([])
    setPicked(false)

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
      {/* 여는 단추 — 패널이 열려 있으면 숨긴다(좁은 화면에서 겹친다).

          아이콘만 둔다. 글자를 빼면 무엇인지 눈으로만은 덜 분명하지만, 말풍선은
          널리 쓰이는 그림이고 화면을 가리는 넓이를 줄이는 쪽이 낫다 — 대신
          aria-label 로 읽어 주므로 화면 낭독기에는 그대로 '문의 챗봇 열기' 다.

          자리는 style 로 잡는다(bottom-5 right-5 대신) — 확대했을 때 아래
          useEffect 가 이 값을 비주얼 뷰포트에 맞춰 고쳐 쓴다. */}
      {!open && (
        <button
          ref={fab}
          type="button"
          onClick={() => setOpen(true)}
          aria-label={adminOnly ? '문의 챗봇 열기 (공개 전 — 어드민에게만 보임)' : '문의 챗봇 열기'}
          /* 자바스크립트가 붙기 전에도 제자리에 있게 CSS 로 같은 셈을 적는다
             — 그리고 나서 useEffect 가 확대 상태에 맞춰 고쳐 쓴다 */
          /* 자바스크립트가 붙기 전에도 제자리에 있게 CSS 로 같은 셈을 적는다
             — 그러고 나서 useEffect 가 확대 상태에 맞춰 고쳐 쓴다.

             여백(=(100vw - 본문)/2)에서 단추 폭과 간격을 뺀 값이 오른쪽 여백이다.
             여백이 좁으면 그 값이 FAB_GAP 아래로 떨어지므로 max() 가 가장자리로
             붙인다 — 분기 없이 두 경우가 한 줄로 맞아떨어진다. */
          style={{
            bottom: `${FAB_GAP}px`,
            right: `max(${FAB_GAP}px, calc((100vw - ${CONTENT_MAX}px) / 2 - ${FAB_SIZE + FAB_GAP}px))`,
          }}
          className="fixed z-40 grid size-14 place-items-center rounded-full bg-violet-600 text-white shadow-lg transition hover:bg-violet-700"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden className="size-6">
            <path d="M21 12a8 8 0 0 1-8 8H8l-4 3v-4.5A8 8 0 0 1 13 4a8 8 0 0 1 8 8Z" />
          </svg>
          {/* 공개 전이라는 표시 — 글자를 뺐으니 점으로 남긴다(뜻은 aria-label 에) */}
          {adminOnly && (
            <span
              aria-hidden
              className="absolute right-0.5 top-0.5 size-3 rounded-full bg-amber-400 ring-2 ring-white"
            />
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
                {/* 짧게 묻는다 — 첫 화면에서 설명을 늘어놓으면 질문이 묻힌다.
                    카테고리 이름을 적지 않는다: 어드민에서 분야를 바꿔도 이
                    문구는 따라오지 않으므로(chat-prompt.ts 의 표에서 읽는
                    값들과 다르다), 빈칸 없이 포괄하는 말로 둔다. */}
                <Bubble kind="bot">무엇을 만들고 싶으신가요?</Bubble>
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

            {/* 시작 메뉴 — 빈 입력칸 앞에서 멈추지 않게 고를 것을 깔아 둔다.
                어드민 → 문의 챗봇 → 시작 메뉴에서 짠다(0027_chat_intents.sql).
                답을 기다리는 동안에는 감춘다 — 눌러도 끼어들 자리가 없다. */}
            {options.length > 0 && streaming == null && !sending && (
              <div className="flex flex-wrap gap-2 pt-1">
                {options.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => pick(o)}
                    className="rounded-full border border-violet-200 bg-violet-50 px-3.5 py-2 text-sm font-medium text-violet-700 transition hover:border-violet-300 hover:bg-violet-100"
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            )}

            {/* 고르기를 마쳤다 — 다음에 무엇을 하면 되는지만 한 줄로 알린다.
                의뢰로 가는 길은 아래 '바로 의뢰 남기기' 하나로 충분하다. */}
            {picked && streaming == null && !sending && (
              <p className="pt-1 text-[11px] text-neutral-400">
                더 궁금한 점은 아래에 적어 물어보세요.
              </p>
            )}

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

                {/* 의뢰로 가는 유일한 길 — 입력칸과 붙어 있으면 눈에 걸리지
                    않는다. 글자를 진하게 하고 위아래를 띄워 따로 세운다. */}
                <button
                  type="button"
                  onClick={() => setInquiryOpen(true)}
                  className="mb-1 mt-4 w-full text-xs font-medium text-neutral-600 transition hover:text-violet-600"
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
