import 'server-only'
import { supabaseAdmin } from './supabase-admin'
import { MAX_WORKS, CARD_THUMBS } from './portfolio-limits'
import type {
  PublicWork,
  PublicDesignerCard,
  PublicDesignerDetail,
  FeedDesigner,
  FeedWork,
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
/* 017·019 마이그레이션 전에도 화면이 뜨게 하는 대비책.

   scope_* 가 없는 DB 에서는 이 질의가 통째로 실패해 디자이너 목록이
   빈다 — 컬럼 몇 개 때문에 탐색·홈이 모두 비는 건 과하다. 없는 것만
   빼고 다시 물은 뒤, 아래 selectDesigners 가 기본값으로 메운다.
   019 만 빠졌으면 scope_sample 만 뺀다 — 017 까지 한꺼번에 빼면
   '디자인 전체'를 켜 둔 디자이너가 그동안 필터에서 사라진다.
   017·019 를 적용하고 나면 이 분기는 지워도 된다. */
const DESIGNER_BASE =
  'id, name, avatar_url, one_liner, bio, tags, design_price, price_max, premium_price, premium_enabled'
const SCOPE_017 = ', scope_full_design, scope_with_dev'
const DESIGNER_COLS = DESIGNER_BASE + SCOPE_017 + ', scope_sample'

/* 빠진 컬럼의 기본값 — 마이그레이션의 default 와 같다.
   메인 시안은 019 전까지 모두가 받았고, 큰 건은 켜야 받는다. */
const SCOPE_DEFAULTS = { scope_sample: true, scope_full_design: false, scope_with_dev: false }

/* 실패 메시지에 따라 다시 물을 컬럼 목록 — 원인이 scope_* 가 아니면 null */
function scopeFallback(msg: string | undefined): string | null {
  if (!msg || !msg.includes('scope_')) return null
  return msg.includes('scope_sample') ? DESIGNER_BASE + SCOPE_017 : DESIGNER_BASE
}
const CROP_COLS = 'crop_x, crop_y, crop_w, crop_h'
const WORK_COLS =
  `id, designer_id, image_url, thumb_url, width, height, title, description, row_span, client, ai_used, soom_work, ${CROP_COLS}, sort_order`

/* 008·009 마이그레이션 전에도 화면이 뜨게 하는 대비책.

   없는 컬럼을 물으면 질의가 통째로 실패한다 — 컬럼 하나 때문에 홈·탐색·
   상세가 전부 비는 건 과하다. 007 이 featured 에 쓴 방침과 같게, 그 컬럼이
   쓰이는 기능만 쉬고 화면은 평소대로 뜨게 한다.
   020(soom_work)도 같다 — 빠지면 undefined 로 와 표기만 쉰다.
   008·009·010·020 을 적용하고 나면 이 재시도는 지워도 된다. */
const OPTIONAL_COLS = ['ai_used', 'soom_work', 'thumb_url', ...CROP_COLS.split(', ')]

/* 아직 없는 컬럼 때문에 실패했으면 그것만 빼고 한 번 더 묻는다.

   질의마다 필터 체인이 달라 결과를 공통으로 감쌀 수 없으므로,
   컬럼 목록을 받아 질의를 만드는 함수를 넘겨받는다. 재시도는 위 목록의
   컬럼이 원인일 때만 한다 — 권한·네트워크 실패까지 다시 물으면
   원인이 가려지고 호출만 두 배가 된다.

   한 번에 전부 빼고 다시 묻는다. 하나씩 빼며 되묻으면 008·009 를 둘 다
   건너뛴 DB 에서 질의가 여러 번 왕복한다. */
async function selectWorks<T>(
  build: (cols: string) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  cols: string = WORK_COLS,
) {
  const first = await build(cols)
  const msg = first.error?.message
  if (!msg || !OPTIONAL_COLS.some((c) => msg.includes(c))) return first

  let fallback = cols
  for (const c of OPTIONAL_COLS) fallback = fallback.replace(`, ${c}`, '')
  return build(fallback)
}

/* 홈 피드는 정렬에 featured_at 을 쓰므로 함께 받아야 한다 —
   Postgres 는 select 에 없는 컬럼으로도 정렬하지만, 두 질의를 합칠 때
   어느 것이 "고른 작업"인지 코드에서 구분해야 해서 같이 들고 온다. */
const FEED_WORK_COLS = `${WORK_COLS}, featured, featured_at`

/* 카드에 미리 보여줄 썸네일 장수. 값은 portfolio-limits.ts 에 있다 —
   어드민 미리보기(클라이언트 컴포넌트)도 같은 값을 써야 하는데, 이 모듈은
   server-only 라 거기서 가져갈 수 없다. 기존 import 경로를 지키려고
   여기서 다시 내보낸다. */
export { CARD_THUMBS } from './portfolio-limits'

/* DB 에서 막 읽은 모양 — thumb_url 이 아직 빌 수 있다.
   strip() 이 원본으로 메워 내보내므로, 그 바깥에서는 늘 채워져 있다. */
type WorkWithOwner = Omit<PublicWork, 'thumb_url'> & {
  thumb_url: string | null
  designer_id: string
  sort_order: number
  /* 홈 피드 질의에서만 함께 온다 — 공개 화면으로는 내보내지 않는다 */
  featured?: boolean
  featured_at?: string | null
}

/* 정렬 기준을 한곳에 둔다 — 목록과 상세가 어긋나면 같은 작업이 다른 순서로 보인다 */
function byOrder(a: WorkWithOwner, b: WorkWithOwner) {
  return a.sort_order - b.sort_order
}

/* scope_* 가 없어서 실패했으면 없는 것을 빼고 다시 묻는다.

   selectWorks 와 같은 방침이다 — 질의마다 필터 체인이 달라 결과를
   공통으로 감쌀 수 없으므로, 컬럼 목록을 받아 질의를 만드는 함수를
   넘겨받는다. 빠진 값은 SCOPE_DEFAULTS 로 메운다(받아 온 값이 이긴다).

   한 번 줄여 물은 것이 또 scope_* 로 실패하면(017 도 없는 DB) 한 번 더
   줄인다 — 019 만 빠진 경우와 둘 다 빠진 경우를 메시지로 미리 가를 수
   없다. */
async function selectDesigners<T extends object>(
  build: (cols: string) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
) {
  let r = await build(DESIGNER_COLS)
  for (let cols = scopeFallback(r.error?.message); cols; cols = scopeFallback(r.error?.message)) {
    r = await build(cols)
    if (cols === DESIGNER_BASE) break
  }
  if (r.error || !r.data) return r

  return { ...r, data: r.data.map((d) => ({ ...SCOPE_DEFAULTS, ...d })) }
}

/* 한 명만 받는 질의(maybeSingle)용 — 위와 같은 일을 한다 */
async function selectDesigner<T extends object>(
  build: (cols: string) => PromiseLike<{ data: T | null; error: { message: string } | null }>,
) {
  let r = await build(DESIGNER_COLS)
  for (let cols = scopeFallback(r.error?.message); cols; cols = scopeFallback(r.error?.message)) {
    r = await build(cols)
    if (cols === DESIGNER_BASE) break
  }
  if (r.error || !r.data) return r

  return { ...r, data: { ...SCOPE_DEFAULTS, ...r.data } }
}

/* 탐색 목록 — 공개 디자이너 + 카드용 썸네일.

   디자이너마다 작업을 따로 조회하면 N+1 이 된다.
   한 번에 받아 designer_id 로 묶는다. */
export async function listPublicDesigners(): Promise<PublicDesignerCard[]> {
  if (!supabaseAdmin) return []
  /* 아래 selectWorks 콜백 안에서는 위 가드로 좁힌 타입이 유지되지 않는다 —
     지역 변수로 고정해 호출마다 non-null 단정을 붙이지 않는다. */
  const db = supabaseAdmin

  const { data: rows, error } = await selectDesigners<PublicDesignerCard>((cols) =>
    db
      .from('designers')
      .select(cols)
      .eq('visible', true)
      .eq('profile_public', true)
      .order('created_at', { ascending: false })
      .limit(200)
      .overrideTypes<PublicDesignerCard[]>(),
  )

  if (error) {
    console.error('[public] 디자이너 목록 조회 실패:', error.message)
    return []
  }

  const designers = (rows ?? []) as PublicDesignerCard[]
  if (designers.length === 0) return []

  const { data: workRows, error: workError } = await selectWorks<WorkWithOwner>((cols) =>
    db
      .from('designer_works')
      .select(cols)
      .eq('visible', true)
      .in(
        'designer_id',
        designers.map((d) => d.id),
      )
      .overrideTypes<WorkWithOwner[]>(),
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

/* 어드민 미리보기 — 목록에 어떻게 실릴지 한 명만 카드 모양으로.

   listPublicDesigners 와 달리 공개 여부를 묻지 않는다. 아직 숨겨 둔
   디자이너의 카드도 미리 봐야 하기 때문이다 — 공개 전에 확인하는 것이
   이 화면의 쓰임이다. 어드민 전용이므로 호출부에서 권한을 확인한다.

   작업은 디자이너가 숨긴 것(visible=false)만 뺀다. 공개 목록과 같은
   규칙이라야 "실제로 이렇게 보인다"가 맞는 말이 된다. */
export async function getDesignerCardPreview(id: string): Promise<PublicDesignerCard | null> {
  if (!supabaseAdmin) return null
  const db = supabaseAdmin

  if (!isUuid(id)) return null

  const { data, error } = await selectDesigner<PublicDesignerCard>((cols) =>
    db.from('designers').select(cols).eq('id', id).maybeSingle().overrideTypes<PublicDesignerCard>(),
  )

  if (error) {
    console.error('[admin] 카드 미리보기 조회 실패:', error.message)
    return null
  }
  if (!data) return null

  const { data: workRows, error: workError } = await selectWorks<WorkWithOwner>((cols) =>
    db
      .from('designer_works')
      .select(cols)
      .eq('designer_id', id)
      .eq('visible', true)
      .overrideTypes<WorkWithOwner[]>(),
  )

  if (workError) {
    console.error('[admin] 카드 미리보기 작업 조회 실패:', workError.message)
    return { ...(data as PublicDesignerCard), works: [], works_total: 0 }
  }

  const works = ((workRows ?? []) as WorkWithOwner[]).sort(byOrder)

  return {
    ...(data as PublicDesignerCard),
    /* 총 개수는 자르기 전에 센다 — "+N개" 가 틀리지 않게 */
    works_total: works.length,
    works: works.slice(0, CARD_THUMBS).map(strip),
  }
}

/* 상세 화면 — 프로필 + 공개된 작업 전부.

   숨긴 계정이나 비공개 프로필이면 null 을 돌려준다(호출부에서 notFound). */
export async function getPublicDesigner(id: string): Promise<PublicDesignerDetail | null> {
  if (!supabaseAdmin) return null
  const db = supabaseAdmin

  /* id 가 uuid 가 아니면 Postgres 가 22P02 로 떨어진다 —
     잘못된 URL 은 에러가 아니라 404 로 다뤄야 한다. */
  if (!isUuid(id)) return null

  const { data, error } = await selectDesigner<PublicDesignerDetail>((cols) =>
    db
      .from('designers')
      .select(cols)
      .eq('id', id)
      .eq('visible', true)
      .eq('profile_public', true)
      .maybeSingle()
      .overrideTypes<PublicDesignerDetail>(),
  )

  if (error) {
    console.error('[public] 디자이너 조회 실패:', error.message)
    return null
  }
  if (!data) return null

  const { data: workRows, error: workError } = await selectWorks<WorkWithOwner>((cols) =>
    db
      .from('designer_works')
      .select(cols)
      .eq('designer_id', id)
      .eq('visible', true)
      .limit(MAX_WORKS)
      .overrideTypes<WorkWithOwner[]>(),
  )

  if (workError) {
    console.error('[public] 작업 조회 실패:', workError.message)
  }

  const works = ((workRows ?? []) as WorkWithOwner[]).sort(byOrder).map(strip)

  return { ...(data as PublicDesignerDetail), works }
}

/* 홈 화면 피드 — 어드민이 고른 작업을 앞에, 나머지는 최신순으로.

   탐색 목록과 달리 디자이너가 아니라 작업이 단위다. 작업마다 누가 올렸는지
   함께 보여줘야 하므로 디자이너 요약을 붙여서 내보낸다.

   어드민이 아무것도 고르지 않았으면 전부 최신순으로 채운다 — 처음 열었을 때
   홈이 비어 있으면 설정을 안 한 게 아니라 고장으로 읽힌다. */
export async function listRecentWorks(limit: number): Promise<FeedWork[]> {
  if (!supabaseAdmin) return []
  const db = supabaseAdmin

  /* 공개 디자이너를 먼저 추린다 — 작업에는 visible 만 있고
     "프로필이 공개인지"는 디자이너 행에만 있기 때문이다.
     숨긴 프로필의 작업이 홈에 뜨면 비공개로 둔 의미가 없다. */
  const { data: rows, error } = await supabaseAdmin
    .from('designers')
    .select('id, name, avatar_url, tags')
    .eq('visible', true)
    .eq('profile_public', true)
    .limit(200)

  if (error) {
    console.error('[public] 홈 피드 디자이너 조회 실패:', error.message)
    return []
  }

  const owners = new Map(
    (rows ?? []).map((d) => [d.id, d as FeedDesigner & { id: string }]),
  )
  if (owners.size === 0) return []

  const ids = Array.from(owners.keys())

  const withOwner = (w: WorkWithOwner): FeedWork => {
    const owner = owners.get(w.designer_id)!
    return {
      ...strip(w),
      designer: {
        id: owner.id,
        name: owner.name,
        avatar_url: owner.avatar_url,
        tags: owner.tags,
      },
    }
  }

  /* 1) 어드민이 고른 작업 — 고른 순서대로.
        디자이너가 그 사이 숨겼으면(visible=false) 빠진다. 어드민이 골랐더라도
        본인이 내린 작업을 공개 화면에 올리지는 않는다. */
  const { data: picked, error: pickError } = await selectWorks<WorkWithOwner>(
    (cols) =>
      db
        .from('designer_works')
        .select(cols)
        .eq('visible', true)
        .eq('featured', true)
        .in('designer_id', ids)
        .order('featured_at', { ascending: false })
        .limit(limit)
        .overrideTypes<WorkWithOwner[]>(),
    FEED_WORK_COLS,
  )

  if (pickError) {
    console.error('[public] 홈 피드 선택 작업 조회 실패:', pickError.message)
  }

  const feed = ((picked ?? []) as WorkWithOwner[]).map(withOwner)
  if (feed.length >= limit) return feed.slice(0, limit)

  /* 2) 모자란 만큼 최신순으로 채운다.
        정렬은 작업의 created_at 으로 한다 — sort_order 는 디자이너가
        자기 포트폴리오 안에서 매긴 순서라 디자이너끼리 비교할 수 없다. */
  const chosen = new Set(feed.map((w) => w.id))

  /* 채우기 질의는 featured 를 읽지 않는다 — 정렬에도 쓰지 않으므로
     007 마이그레이션 전에도 홈이 평소대로 뜬다. 고르는 기능만 쉬고
     화면이 비지는 않는다. */
  const { data: workRows, error: workError } = await selectWorks<WorkWithOwner>((cols) =>
    db
      .from('designer_works')
      .select(cols)
      .eq('visible', true)
      .in('designer_id', ids)
      .order('created_at', { ascending: false })
      /* 이미 고른 것이 섞여 들어오므로 그만큼 더 받아 둔다 */
      .limit(limit + chosen.size)
      .overrideTypes<WorkWithOwner[]>(),
  )

  if (workError) {
    console.error('[public] 홈 피드 작업 조회 실패:', workError.message)
    return feed
  }

  for (const row of (workRows ?? []) as WorkWithOwner[]) {
    if (feed.length >= limit) break
    if (chosen.has(row.id)) continue
    feed.push(withOwner(row))
  }

  return feed
}

/* 공개 화면에 보낼 모양으로 — 묶는 데만 쓴 두 값을 떼어낸다.

   thumb_url 이 비는 경우를 여기서 한 번만 메운다. 화면마다 "없으면 원본"
   을 적으면 그 분기가 카드·피드·모달에 흩어져 영영 남는다. 내보내는
   모양(PublicWork)에서 string 으로 보장하면 화면은 그냥 쓰면 된다.

   비는 때는 둘뿐이다 — 010 마이그레이션 전이거나, 썸네일을 만들지 못해
   원본으로 올린 작업. 둘 다 원본을 쓰는 것이 맞는 답이다. */
function strip(w: WorkWithOwner): PublicWork {
  /* eslint-disable-next-line @typescript-eslint/no-unused-vars --
     묶기·정렬에만 쓴 값들을 떼어낸다 */
  const { designer_id, sort_order, featured, featured_at, ...rest } = w
  return { ...rest, thumb_url: rest.thumb_url || rest.image_url }
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
