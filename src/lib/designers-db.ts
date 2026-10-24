import 'server-only'
import { supabaseAdmin } from './supabase-admin'
import { MAX_WORKS, type WorkRow, type FeaturedCandidate } from './portfolio-limits'
import type { DesignerRow, DesignerActivity, AdminDesignerListRow } from './designer-shape'

/* 행·제한값의 모양은 designer-shape / portfolio-limits 에 있다 —
   클라이언트 컴포넌트가 service_role 클라이언트를 끌어오지 않도록 떼어두었다. */
export type {
  DesignerRow,
  AdminDesigner,
  DesignerActivity,
  AdminDesignerListRow,
} from './designer-shape'
export type { WorkRow, FeaturedCandidate } from './portfolio-limits'

/* 한 디자이너의 작업 전부 — 숨긴 것까지. 본인 관리 화면과 어드민이 쓴다. */
export async function listWorks(designerId: string): Promise<WorkRow[]> {
  if (!supabaseAdmin) return []

  const { data, error } = await supabaseAdmin
    .from('designer_works')
    .select('*')
    .eq('designer_id', designerId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(MAX_WORKS)

  if (error) {
    console.error('[works] 목록 조회 실패:', error.message)
    return []
  }
  return (data ?? []) as WorkRow[]
}

/* 메인 노출 설정 화면이 쓰는 목록 — 모든 디자이너의 작업을 한 줄로.

   listWorks 는 한 사람의 작업만 돌려준다. 이 화면은 "누구 작업이든
   메인에 걸 것"을 고르는 자리라 디자이너를 가로지른다.

   디자이너가 숨긴 작업(visible=false)은 빼지 않고 함께 싣는다 —
   어드민이 왜 메인에 안 뜨는지 알 수 있어야 하기 때문이다(화면에서 '숨김'으로 표시). */
export async function listWorksForFeature(): Promise<FeaturedCandidate[]> {
  if (!supabaseAdmin) return []

  const { data, error } = await supabaseAdmin
    .from('designer_works')
    .select('*, designer:designers!inner(id, name, email, avatar_url, visible, profile_public)')
    /* 고른 것을 위로 — 어드민이 방금 고른 구성을 바로 확인한다 */
    .order('featured', { ascending: false })
    .order('featured_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    /* 검색은 브라우저에서 거른다(입력마다 왕복하지 않게) —
       그래서 한 번에 받아 둘 수 있는 양으로 끊는다. */
    .limit(500)

  if (error) {
    console.error('[works] 메인 노출 후보 조회 실패:', error.message)
    return []
  }
  return (data ?? []) as FeaturedCandidate[]
}

/* 관리 화면 목록 — 숨긴 계정까지 전부 */
export async function listAllDesigners(): Promise<DesignerRow[]> {
  if (!supabaseAdmin) return []

  const { data, error } = await supabaseAdmin
    .from('designers')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) {
    console.error('[designers] 관리 목록 조회 실패:', error.message)
    return []
  }
  return (data ?? []) as DesignerRow[]
}

/* 집계가 없는 계정(아직 로그인·업로드가 없음)에 쓰는 기본값 */
const EMPTY_ACTIVITY: DesignerActivity = {
  last_login_at: null,
  logins_30d: 0,
  last_work_at: null,
  works_visible: 0,
  works_total: 0,
}

/* 관리 화면 목록 + 활동 집계.

   집계는 designer_activity 뷰에서 한 번에 받아 메모리에서 붙인다 —
   행마다 조회하면 N+1 이 된다. */
export async function listAllDesignersWithActivity(): Promise<AdminDesignerListRow[]> {
  const designers = await listAllDesigners()
  if (designers.length === 0 || !supabaseAdmin) {
    return designers.map((d) => ({ ...strip(d), activity: EMPTY_ACTIVITY }))
  }

  const { data, error } = await supabaseAdmin
    .from('designer_activity')
    .select('*')
    .in(
      'designer_id',
      designers.map((d) => d.id),
    )

  if (error) {
    /* 뷰가 아직 없거나(마이그레이션 미적용) 조회가 실패한 경우.
       목록 자체는 보여주는 쪽이 낫다 — 숫자만 비운다. */
    console.error('[designers] 활동 집계 조회 실패:', error.message)
    return designers.map((d) => ({ ...strip(d), activity: EMPTY_ACTIVITY }))
  }

  const byId = new Map<string, DesignerActivity>()
  for (const row of (data ?? []) as (DesignerActivity & { designer_id: string })[]) {
    byId.set(row.designer_id, {
      last_login_at: row.last_login_at,
      /* count(*) 는 bigint — supabase-js 가 문자열로 줄 수 있다 */
      logins_30d: Number(row.logins_30d ?? 0),
      last_work_at: row.last_work_at,
      works_visible: Number(row.works_visible ?? 0),
      works_total: Number(row.works_total ?? 0),
    })
  }

  return designers.map((d) => ({
    ...strip(d),
    activity: byId.get(d.id) ?? EMPTY_ACTIVITY,
  }))
}

/* 비밀번호 해시는 화면으로 내려보내지 않는다.
   임시 비밀번호(temp_password)는 어드민이 확인해야 하므로 남긴다. */
function strip(d: DesignerRow) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password_hash, ...rest } = d
  return rest
}

export async function getDesignerById(id: string): Promise<DesignerRow | null> {
  if (!supabaseAdmin) return null

  const { data, error } = await supabaseAdmin
    .from('designers')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) {
    console.error('[designers] 조회 실패:', error.message)
    return null
  }
  return (data as DesignerRow) ?? null
}

export async function getDesignerByEmail(email: string): Promise<DesignerRow | null> {
  if (!supabaseAdmin) return null

  const { data, error } = await supabaseAdmin
    .from('designers')
    .select('*')
    .eq('email', email.trim().toLowerCase())
    .maybeSingle()

  if (error) {
    console.error('[designers] 이메일 조회 실패:', error.message)
    return null
  }
  return (data as DesignerRow) ?? null
}
