import 'server-only'
import { supabaseAdmin } from './supabase-admin'

/* 탐색 상단에 크게 올릴 디자이너(032_explore_features.sql).

   공개 탐색과 어드민 노출 관리가 함께 쓴다. 디자이너 id 만 차례대로
   돌려준다 — 프로필·작업은 각 화면이 이미 받아 둔 목록에서 찾는다. */

export type ExploreLayout = 'feature1'

export async function listFeatureIds(layout: ExploreLayout = 'feature1'): Promise<string[]> {
  if (!supabaseAdmin) return []

  const { data, error } = await supabaseAdmin
    .from('explore_features')
    .select('designer_id')
    .eq('layout', layout)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) {
    /* 032 마이그레이션 전이면 테이블이 없다 — 올린 사람 없이 모두 기본 카드로 */
    console.error('[explore] 노출 목록 조회 실패:', error.message)
    return []
  }
  return (data ?? []).map((r) => r.designer_id as string)
}
