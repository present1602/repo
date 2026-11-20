import 'server-only'
import { supabaseAdmin } from './supabase-admin'
import type { GuideBlock, GuideChapter } from './guide-shape'

/* 설정 가이드 챕터 조회(0024_setup_guide.sql).

   어드민 '설정 가이드' 에서 등록하고, 디자이너 화면은 켜 둔 것만 차례대로 쓴다. */

const COLS = 'id, title, summary, body, sort_order, visible'

/* 표에 든 본문을 믿지 않는다 — 블록 모양이 아닌 값이 섞여 있으면 버린다.
   jsonb 라 제약으로 막는 것은 배열까지다(0024) */
function cleanBody(raw: unknown): GuideBlock[] {
  if (!Array.isArray(raw)) return []
  return raw.flatMap((b): GuideBlock[] => {
    if (b?.type === 'image' && typeof b.path === 'string' && b.path) return [{ type: 'image', path: b.path }]
    if (b?.type === 'text' && typeof b.text === 'string') return [{ type: 'text', text: b.text }]
    return []
  })
}

/* 차례대로 정렬한다 — sort_order 가 같으면 먼저 등록한 것이 앞.
   Postgres 의 정렬은 로케일 설정에 기대므로 코드에서 맞춘다(faqs.ts 와 같은 방침). */
async function readChapters(visibleOnly: boolean): Promise<GuideChapter[]> {
  if (!supabaseAdmin) return []

  const q = supabaseAdmin
    .from('setup_guide_chapters')
    .select(COLS)
    .order('sort_order')
    .order('created_at')
  const { data, error } = await (visibleOnly ? q.eq('visible', true) : q)

  if (error) {
    /* 마이그레이션 전이면 표가 없다 — 조용히 비워 돌려준다 */
    if (!/setup_guide_chapters/i.test(error.message)) {
      console.error('[guide] 조회 실패:', error.message)
    }
    return []
  }

  return (data ?? []).map((r) => ({
    id: r.id as string,
    title: (r.title as string) ?? '',
    summary: (r.summary as string) ?? '',
    body: cleanBody(r.body),
    sort_order: (r.sort_order as number) ?? 0,
    visible: (r.visible as boolean) ?? true,
  }))
}

/* 디자이너 화면용 — 켜 둔 것만, 차례대로 */
export function listVisibleGuideChapters(): Promise<GuideChapter[]> {
  return readChapters(true)
}

/* 어드민용 — 숨긴 것까지 전부, 차례대로 */
export function listAllGuideChapters(): Promise<GuideChapter[]> {
  return readChapters(false)
}
