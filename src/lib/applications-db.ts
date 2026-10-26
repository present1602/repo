import 'server-only'
import { supabaseAdmin, APPLICATION_FILES_BUCKET } from './supabase-admin'
import {
  APPLICATION_FILE_KINDS,
  type ApplicationRow,
  type ApplicationWithLinks,
} from './application-shape'

/* 지원서 조회 — 어드민 전용(021_designer_applications.sql).

   RLS 로 전부 막아 둔 테이블이라 service_role 로만 닿는다.
   호출부에서 권한을 먼저 확인한다. */

/* 내려받기 링크 유효기간 — 화면을 열어 둔 채 한참 뒤에 눌러도 되도록
   한 시간. 지나면 새로고침하면 새로 만든다. */
const LINK_TTL = 60 * 60

export async function listApplications(): Promise<ApplicationWithLinks[]> {
  if (!supabaseAdmin) return []
  const db = supabaseAdmin

  const { data, error } = await db
    .from('designer_applications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500)

  if (error) {
    /* 021 전이면 테이블이 없다 — 화면은 비우고 넘어간다 */
    console.error('[apply] 목록 조회 실패:', error.message)
    return []
  }

  const rows = (data ?? []) as ApplicationRow[]
  if (rows.length === 0) return []

  /* 파일마다 따로 부르지 않고 한 번에 서명한다 */
  const paths = rows.flatMap((r) => APPLICATION_FILE_KINDS.map((k) => r[k].path))
  const { data: signed, error: signErr } = await db.storage
    .from(APPLICATION_FILES_BUCKET)
    .createSignedUrls(paths, LINK_TTL)

  if (signErr) console.error('[apply] 내려받기 링크 생성 실패:', signErr.message)

  const byPath = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]))

  return rows.map((r) => ({
    ...r,
    links: {
      resume: byPath.get(r.resume.path) ?? null,
      portfolio: byPath.get(r.portfolio.path) ?? null,
    },
  }))
}

/* 미확인 건수 — 사이드바 배지에 쓴다 */
export async function countUnreadApplications(): Promise<number> {
  if (!supabaseAdmin) return 0

  const { count, error } = await supabaseAdmin
    .from('designer_applications')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'unread')

  if (error) return 0
  return count ?? 0
}
