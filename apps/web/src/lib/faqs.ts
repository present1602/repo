import 'server-only'
import { supabaseAdmin } from './supabase-admin'
import type { Faq } from './faq-shape'

/* 자주 묻는 질문 조회(0015_faqs.sql).

   어드민 설정에서 등록하고, 공개 화면은 켜 둔 것만 차례대로 쓴다. */

const COLS = 'id, question, answer, sort_order, visible'

/* 차례대로 정렬한다 — sort_order 가 같으면 먼저 등록한 것이 앞.
   Postgres 의 정렬은 로케일 설정에 기대므로 코드에서 맞춘다(specialties.ts 와 같은 방침). */
async function readFaqs(visibleOnly: boolean): Promise<Faq[]> {
  if (!supabaseAdmin) return []

  const q = supabaseAdmin.from('faqs').select(COLS).order('sort_order').order('created_at')
  const { data, error } = await (visibleOnly ? q.eq('visible', true) : q)

  if (error) {
    /* 마이그레이션 전이면 표가 없다 — 조용히 비워 돌려준다 */
    if (!/faqs/i.test(error.message)) {
      console.error('[faqs] 조회 실패:', error.message)
    }
    return []
  }

  return (data ?? []) as unknown as Faq[]
}

/* 공개 화면용 — 켜 둔 것만, 차례대로 */
export function listVisibleFaqs(): Promise<Faq[]> {
  return readFaqs(true)
}

/* 어드민용 — 숨긴 것까지 전부, 차례대로 */
export function listAllFaqs(): Promise<Faq[]> {
  return readFaqs(false)
}
