/* 문의 챗봇의 모양과 한계값(0023_chat.sql).

   클라이언트 컴포넌트(위젯·어드민 관리)도 이 타입을 쓰므로 server-only 모듈에
   두지 않는다 — chat-knowledge.ts 에서 가져오면 supabase-admin(service_role) 이
   브라우저 번들로 끌려온다(faq-shape.ts 와 같은 방침). */

export type ChatKnowledge = {
  id: string
  /* 무엇에 대한 지식인지 — 모델이 고르는 단서가 된다 */
  title: string
  /* 지식 본문. 줄바꿈을 그대로 살려 프롬프트에 넣는다 */
  body: string
  sort_order: number
  /* 끄면 프롬프트에서 빠진다. 어드민 목록에는 '끔' 으로 남는다 */
  enabled: boolean
}

/* 어드민 대화 기록 한 줄 — 질문 하나와 그 답 */
export type ChatLog = {
  id: string
  created_at: string
  session_id: string
  question: string
  answer: string
  /* 모델이 모른다고 답한 줄 — 어드민의 '답변 필요' 에 모인다 */
  unanswered: boolean
  /* 그 질문으로 지식 카드를 만들었으면 true */
  resolved: boolean
  tokens_in: number
  tokens_out: number
  error: string
}

/* 0023 의 check 제약과 같은 길이 — 함께 고쳐야 한다 */
export const MAX_KNOWLEDGE_TITLE = 200
export const MAX_KNOWLEDGE_BODY = 8000

/* ─────────── 대화 한계 ───────────

   로그인 없이 누구나 치는 입구다(공개로 켠 뒤). 상한을 서버에서 센다 —
   화면에서만 막으면 직접 보낸 요청에는 아무 효력이 없다. */

/* 한 번에 적을 수 있는 길이. 이보다 길면 문의 폼으로 보낸다 */
export const MAX_CHAT_INPUT = 1000

/* 한 대화에서 주고받을 수 있는 횟수 — 넘으면 문의 폼을 권한다 */
export const MAX_CHAT_TURNS = 30

/* 모델에 함께 보내는 지난 대화 — 너무 길면 캐시가 깨지고 비용만 는다.
   최근 주고받기 8쌍이면 맥락은 충분히 이어진다. */
export const CHAT_HISTORY_TURNS = 8

/* 모델이 모를 때 답 앞에 붙이는 표시 — 이 글자로 '답변 필요' 를 가린다.
   사용자 화면에서는 떼고 보여 준다. */
export const UNKNOWN_MARK = '[모름]'

/* 위젯이 보내는 대화 한 줄 */
export type ChatTurn = {
  role: 'user' | 'assistant'
  text: string
}

export function isChatTurn(v: unknown): v is ChatTurn {
  if (typeof v !== 'object' || v == null) return false
  const t = v as Record<string, unknown>
  return (t.role === 'user' || t.role === 'assistant') && typeof t.text === 'string'
}
