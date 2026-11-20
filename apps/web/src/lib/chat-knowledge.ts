import 'server-only'
import { supabaseAdmin } from './supabase-admin'
import type { ChatKnowledge, ChatLog } from './chat-shape'

/* 챗봇 지식 카드와 대화 기록 조회(0023_chat.sql).

   어드민에서 등록하고, 답을 만들 때는 켜 둔 것만 차례대로 쓴다.
   faqs.ts 와 같은 방침 — 마이그레이션 전이면 조용히 비워 돌려주고 화면은 뜬다. */

const COLS = 'id, title, body, sort_order, enabled'

/* 차례대로 정렬한다 — sort_order 가 같으면 먼저 등록한 것이 앞.
   Postgres 의 정렬은 로케일 설정에 기대므로 코드에서 맞춘다(faqs.ts 와 같은 방침). */
async function readKnowledge(enabledOnly: boolean): Promise<ChatKnowledge[]> {
  if (!supabaseAdmin) return []

  const q = supabaseAdmin
    .from('chat_knowledge')
    .select(COLS)
    .order('sort_order')
    .order('created_at')
  const { data, error } = await (enabledOnly ? q.eq('enabled', true) : q)

  if (error) {
    /* 마이그레이션 전이면 표가 없다 — 조용히 비워 돌려준다 */
    if (!/chat_knowledge/i.test(error.message)) {
      console.error('[chat] 지식 조회 실패:', error.message)
    }
    return []
  }

  return (data ?? []) as unknown as ChatKnowledge[]
}

/* 답을 만들 때 — 켜 둔 것만, 차례대로 */
export function listEnabledKnowledge(): Promise<ChatKnowledge[]> {
  return readKnowledge(true)
}

/* 어드민용 — 끈 것까지 전부, 차례대로 */
export function listAllKnowledge(): Promise<ChatKnowledge[]> {
  return readKnowledge(false)
}

const LOG_COLS =
  'id, created_at, session_id, question, answer, unanswered, resolved, tokens_in, tokens_out, error'

/* 대화 기록 — 최근 것부터.

   todoOnly 면 '답변 필요'(모름으로 끝났고 아직 메우지 않은 줄)만 모은다.
   그 줄들이 다음에 쓸 지식 카드의 목록이다. */
export async function listChatLogs({
  todoOnly = false,
  limit = 200,
}: { todoOnly?: boolean; limit?: number } = {}): Promise<ChatLog[]> {
  if (!supabaseAdmin) return []

  let q = supabaseAdmin
    .from('chat_logs')
    .select(LOG_COLS)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (todoOnly) q = q.eq('unanswered', true).eq('resolved', false)

  const { data, error } = await q

  if (error) {
    if (!/chat_logs/i.test(error.message)) {
      console.error('[chat] 대화 기록 조회 실패:', error.message)
    }
    return []
  }

  return (data ?? []) as unknown as ChatLog[]
}

/* 아직 메우지 않은 '답변 필요' 건수 — 어드민 사이드바 배지와 머리글에 쓴다 */
export async function countChatTodo(): Promise<number> {
  if (!supabaseAdmin) return 0

  const { count, error } = await supabaseAdmin
    .from('chat_logs')
    .select('id', { count: 'exact', head: true })
    .eq('unanswered', true)
    .eq('resolved', false)

  if (error) {
    if (!/chat_logs/i.test(error.message)) {
      console.error('[chat] 답변 필요 건수 조회 실패:', error.message)
    }
    return 0
  }

  return count ?? 0
}
