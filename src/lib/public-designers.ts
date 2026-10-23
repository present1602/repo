import 'server-only'
import { supabaseAdmin } from './supabase-admin'
import { MAX_WORKS } from './portfolio-limits'
import type {
  PublicWork,
  PublicDesignerCard,
  PublicDesignerDetail,
} from './designer-shape'

/* 로그인 없이 보이는 화면(탐색·상세)이 쓰는 조회.

   어드민용 designers-db.ts 와 일부러 나눠 두었다. 그쪽은 숨긴 계정과
   비밀번호 값까지 들고 오므로, 공개 화면이 실수로 그 함수를 쓰면
   숨긴 프로필이 그대로 드러난다.

   여기서는 두 가지를 반드시 함께 건다:
     visible        — 관리자가 정지하지 않은 계정
     profile_public — 디자이너 본인이 공개로 둔 프로필
   작업물도 visible 인 것만 내보낸다. */

/* 공개 화면에 내보낼 컬럼만 적는다 — select('*') 로 두면
   컬럼이 늘 때 temp_password 같은 값이 조용히 함께 나간다. */
const DESIGNER_COLS = 'id, name, avatar_url, one_liner, bio, tags'
const WORK_COLS =
  'id, designer_id, image_url, width, height, title, description, row_span, client, sort_order'

/* 카드에 미리 보여줄 썸네일 장수 — 나머지는 "+N개 더보기" 로 접는다 */
export const CARD_THUMBS = 4

type WorkWithOwner = PublicWork & { designer_id: string; sort_order: number }

/* 정렬 기준을 한곳에 둔다 — 목록과 상세가 어긋나면 같은 작업이 다른 순서로 보인다 */
function byOrder(a: WorkWithOwner, b: WorkWithOwner) {
  return a.sort_order - b.sort_order
}

/* 탐색 목록 — 공개 디자이너 + 카드용 썸네일.

   디자이너마다 작업을 따로 조회하면 N+1 이 된다.
   한 번에 받아 designer_id 로 묶는다. */
export async function listPublicDesigners(): Promise<PublicDesignerCard[]> {
  if (!supabaseAdmin) return []

  const { data: rows, error } = await supabaseAdmin
    .from('designers')
    .select(DESIGNER_COLS)
    .eq('visible', true)
    .eq('profile_public', true)
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) {
    console.error('[public] 디자이너 목록 조회 실패:', error.message)
    return []
  }

  const designers = (rows ?? []) as PublicDesignerCard[]
  if (designers.length === 0) return []

  const { data: workRows, error: workError } = await supabaseAdmin
    .from('designer_works')
    .select(WORK_COLS)
    .eq('visible', true)
    .in(
      'designer_id',
      designers.map((d) => d.id),
    )

  if (workError) {
    /* 작업을 못 받아도 디자이너 카드는 보여준다 — 썸네일만 비운다 */
    console.error('[public] 작업 목록 조회 실패:', workError.message)
    return designers.map((d) => ({ ...d, works: [], works_total: 0 }))
  }

  const byDesigner = new Map<string, WorkWithOwner[]>()
  for (const w of (workRows ?? []) as WorkWithOwner[]) {
    const list = byDesigner.get(w.designer_id)
    if (list) list.push(w)
    else byDesigner.set(w.designer_id, [w])
  }

  return designers.map((d) => {
    const works = (byDesigner.get(d.id) ?? []).sort(byOrder)
    return {
      ...d,
      /* 총 개수는 자르기 전에 센다 — "+N개" 가 틀리지 않게 */
      works_total: works.length,
      works: works.slice(0, CARD_THUMBS).map(strip),
    }
  })
}

/* 상세 화면 — 프로필 + 공개된 작업 전부.

   숨긴 계정이나 비공개 프로필이면 null 을 돌려준다(호출부에서 notFound). */
export async function getPublicDesigner(id: string): Promise<PublicDesignerDetail | null> {
  if (!supabaseAdmin) return null

  /* id 가 uuid 가 아니면 Postgres 가 22P02 로 떨어진다 —
     잘못된 URL 은 에러가 아니라 404 로 다뤄야 한다. */
  if (!isUuid(id)) return null

  const { data, error } = await supabaseAdmin
    .from('designers')
    .select(DESIGNER_COLS)
    .eq('id', id)
    .eq('visible', true)
    .eq('profile_public', true)
    .maybeSingle()

  if (error) {
    console.error('[public] 디자이너 조회 실패:', error.message)
    return null
  }
  if (!data) return null

  const { data: workRows, error: workError } = await supabaseAdmin
    .from('designer_works')
    .select(WORK_COLS)
    .eq('designer_id', id)
    .eq('visible', true)
    .limit(MAX_WORKS)

  if (workError) {
    console.error('[public] 작업 조회 실패:', workError.message)
  }

  const works = ((workRows ?? []) as WorkWithOwner[]).sort(byOrder).map(strip)

  return { ...(data as PublicDesignerDetail), works }
}

/* 공개 화면에 보낼 모양으로 — 묶는 데만 쓴 두 값을 떼어낸다 */
function strip(w: WorkWithOwner): PublicWork {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { designer_id, sort_order, ...rest } = w
  return rest
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isUuid(s: string): boolean {
  return UUID_RE.test(s)
}

/* 탐색 사이드바의 분야 목록 — 공개 디자이너가 실제로 쓰는 태그만 모은다 */
export function collectTags(designers: PublicDesignerCard[]): string[] {
  const seen = new Set<string>()
  for (const d of designers) for (const t of d.tags) seen.add(t)
  return Array.from(seen).sort((a, b) => a.localeCompare(b, 'ko'))
}
