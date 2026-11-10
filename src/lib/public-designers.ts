import 'server-only'
import { cache } from 'react'
import { supabaseAdmin } from './supabase-admin'
import { MAX_WORKS } from './portfolio-limits'
import {
  DEFAULT_CONTRACT_PRICE,
  DEFAULT_FULL_DESIGN_PRICE,
  DEFAULT_LOGO_PRICE,
  DEFAULT_PROJECT_PRICE,
} from './plans'
import type {
  PublicWork,
  PublicDesignerCard,
  PublicDesignerDetail,
  FeedDesigner,
  FeedWork,
} from './designer-shape'
import { listSampleSpecialties, listSpecialtyNames } from './specialties'
import { readOwnPrices } from './designer-specialty-prices'
import { sampleAllowed } from './specialty-shape'

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
   033(scope_logo·logo_price)도 같다 — 그것만 빠졌으면 그것만 뺀다.
   035(full_design_price·project_price)도 같다.
   017·019·033·035 를 적용하고 나면 이 분기는 지워도 된다. */
const DESIGNER_BASE =
  'id, name, avatar_url, one_liner, bio, tags, design_price, price_max, premium_price, premium_enabled'
const SCOPE_017 = ', scope_full_design, scope_with_dev'
const SCOPE_019 = ', scope_sample'
const LOGO_033 = ', scope_logo, logo_price'
const PRICE_035 = ', full_design_price, project_price'
const DESIGNER_COLS = DESIGNER_BASE + SCOPE_017 + SCOPE_019 + LOGO_033 + PRICE_035

/* 빠진 컬럼의 기본값 — 마이그레이션의 default 와 같다.
   메인 시안은 019 전까지 모두가 받았고, 큰 건과 로고는 켜야 받는다. */
const SCOPE_DEFAULTS = {
  scope_sample: true,
  scope_logo: false,
  logo_price: DEFAULT_LOGO_PRICE,
  scope_full_design: false,
  scope_with_dev: false,
  full_design_price: DEFAULT_FULL_DESIGN_PRICE,
  project_price: DEFAULT_PROJECT_PRICE,
}

/* 실패 메시지에 따라 다시 물을 컬럼 목록 — 원인이 scope_*·가격 칸이 아니면 null */
function scopeFallback(msg: string | undefined): string | null {
  if (!msg) return null
  if (msg.includes('full_design_price') || msg.includes('project_price')) {
    return DESIGNER_BASE + SCOPE_017 + SCOPE_019 + LOGO_033
  }
  if (!(msg.includes('scope_') || msg.includes('logo_price'))) return null
  if (msg.includes('scope_logo') || msg.includes('logo_price')) return DESIGNER_BASE + SCOPE_017 + SCOPE_019
  return msg.includes('scope_sample') ? DESIGNER_BASE + SCOPE_017 : DESIGNER_BASE
}
const CROP_COLS = 'crop_x, crop_y, crop_w, crop_h'
const WORK_COLS =
  `id, designer_id, image_url, thumb_url, pages, video_id, link_url, width, height, title, description, row_span, client, ai_used, soom_work, ${CROP_COLS}, sort_order`

/* 008·009 마이그레이션 전에도 화면이 뜨게 하는 대비책.

   없는 컬럼을 물으면 질의가 통째로 실패한다 — 컬럼 하나 때문에 홈·탐색·
   상세가 전부 비는 건 과하다. 007 이 featured 에 쓴 방침과 같게, 그 컬럼이
   쓰이는 기능만 쉬고 화면은 평소대로 뜨게 한다.
   020(soom_work)·0008(pages)·0019(video_id)·0025(link_url)도 같다 — 빠지면
   undefined 로 와 그 표시만 쉰다.
   008·009·010·020·0008·0019·0025 를 적용하고 나면 이 재시도는 지워도 된다. */
const OPTIONAL_COLS = [
  'ai_used',
  'soom_work',
  'thumb_url',
  'pages',
  'video_id',
  'link_url',
  ...CROP_COLS.split(', '),
]

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

/* 홈 피드가 한 번에 받아 올 최신 작업 수.

   피드는 같은 그림을 한 번만 싣는다(listRecentWorks). 겹치는 만큼 줄어드니
   보여줄 장수보다 넉넉히 받아야 벽이 중간에 끊기지 않는다. 디자이너들이
   같은 샘플을 나눠 쓰는 상황에서는 받은 수의 1/5 도 안 남을 수 있다. */
const FEED_FETCH_MAX = 300

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

  const ids = r.data.map((d) => (d as { id?: string }).id).filter((id) => id != null)
  const [allowed, known, own] = await Promise.all([
    sampleSpecialties(),
    specialtyNames(),
    /* 디자이너별 분야 시작가(0016) — 한 번에 받아 N+1 을 피한다 */
    readOwnPrices(ids),
  ])
  return {
    ...r,
    data: r.data.map((d) =>
      knownTags(
        gateSample(
          { ...SCOPE_DEFAULTS, ...d, own_prices: own.get((d as { id: string }).id) ?? {} },
          allowed,
        ),
        known,
      ),
    ),
  }
}

/* 메인 시안 우선 의뢰는 어드민이 허용한 분야(039)를 고른 디자이너만 받는다.
   본인 스위치(scope_sample)가 켜져 있어도 분야가 없으면 공개 화면에서는 꺼진 것으로 본다 —
   탐색 필터·의뢰 패널·의뢰 폼이 모두 이 값을 보므로 여기서 한 번에 거른다.
   요청 하나에서 여러 번 불려도 한 번만 묻는다. */
const sampleSpecialties = cache(listSampleSpecialties)

/* 공개 화면에는 분야 목록에 있는 태그만 내보낸다(숨긴 분야 포함).
   분야 이름을 DB 에서 직접 바꾸면 디자이너 tags 에 옛 이름이 남는다 — 그 이름이
   카드에 나가면 어느 필터에도 걸리지 않는 낯선 글자가 된다.
   목록이 비어 있으면(011 전이거나 하나도 없으면) 거르지 않는다. */
const specialtyNames = cache(listSpecialtyNames)

function knownTags<D>(d: D, known: string[]): D {
  const tags = (d as { tags?: string[] }).tags
  if (!tags || known.length === 0) return d
  return { ...d, tags: tags.filter((t) => known.includes(t)) }
}

function gateSample<D extends { scope_sample: boolean }>(d: D, allowed: string[] | null): D {
  const tags = (d as { tags?: string[] }).tags ?? []
  return d.scope_sample && !sampleAllowed(tags, allowed) ? { ...d, scope_sample: false } : d
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

  const id = (r.data as { id?: string }).id
  const [allowed, known, own] = await Promise.all([
    sampleSpecialties(),
    specialtyNames(),
    readOwnPrices(id ? [id] : []),
  ])
  return {
    ...r,
    data: knownTags(
      gateSample({ ...SCOPE_DEFAULTS, ...r.data, own_prices: (id && own.get(id)) || {} }, allowed),
      known,
    ),
  }
}

/* 탐색 목록 — 공개 디자이너 + 카드용 썸네일.

   디자이너마다 작업을 따로 조회하면 N+1 이 된다.
   한 번에 받아 designer_id 로 묶는다. */
export async function listPublicDesigners(): Promise<PublicDesignerCard[]> {
  if (!supabaseAdmin) return []
  /* 아래 selectWorks 콜백 안에서는 위 가드로 좁힌 타입이 유지되지 않는다 —
     지역 변수로 고정해 호출마다 non-null 단정을 붙이지 않는다. */
  const db = supabaseAdmin

  /* 어드민이 정한 차례가 먼저, 같으면 예전처럼 등록 역순(0026_designer_sort_order.sql).
     0026 전 DB 에는 sort_order 가 없어 질의가 통째로 실패하므로, 그때는
     등록 역순만으로 한 번 더 묻는다 — 차례 기능만 쉬고 탐색은 평소대로 뜬다. */
  let { data: rows, error } = await selectDesigners<PublicDesignerCard>((cols) =>
    db
      .from('designers')
      .select(cols)
      .eq('visible', true)
      .eq('profile_public', true)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false })
      .limit(200)
      .overrideTypes<PublicDesignerCard[]>(),
  )

  if (error?.message.includes('sort_order')) {
    ;({ data: rows, error } = await selectDesigners<PublicDesignerCard>((cols) =>
      db
        .from('designers')
        .select(cols)
        .eq('visible', true)
        .eq('profile_public', true)
        .order('created_at', { ascending: false })
        .limit(200)
        .overrideTypes<PublicDesignerCard[]>(),
    ))
  }

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

  /* 작업은 자르지 않고 다 싣는다 — 카드 썸네일 줄은 화면이 CARD_THUMBS 장으로
     자르고, 눌러 여는 다이얼로그는 그 사람의 작업을 전부(1/9 …) 넘겨 본다.
     디자이너당 MAX_WORKS 가 상한이다. */
  return designers.map((d) => {
    const works = (byDesigner.get(d.id) ?? []).sort(byOrder)
    return {
      ...d,
      works_total: works.length,
      works: works.map(strip),
    }
  })
}

/* 상세 화면 — 프로필 + 공개된 작업 전부.

   숨긴 계정이나 비공개 프로필이면 null 을 돌려준다(호출부에서 notFound).

   cache — generateMetadata 와 본문이 같은 요청에서 각각 부른다.
   감싸지 않으면 같은 질의가 두 번 나간다. */
export const getPublicDesigner = cache(async function getPublicDesigner(
  id: string,
): Promise<PublicDesignerDetail | null> {
  return loadDesignerDetail(id, false)
})

/* 어드민 미리보기 — 공개 여부(계정 활성·프로필 공개)를 묻지 않는다. 공개 전에
   상세 화면이 어떻게 보일지 확인하는 용도다. 작업은 공개 화면과 같게 노출한
   것만 싣는다. 어드민 전용이므로 부르는 쪽에서 권한을 확인한다. */
export async function getDesignerForPreview(id: string): Promise<PublicDesignerDetail | null> {
  return loadDesignerDetail(id, true)
}

async function loadDesignerDetail(id: string, includeHidden: boolean): Promise<PublicDesignerDetail | null> {
  if (!supabaseAdmin) return null
  const db = supabaseAdmin

  /* id 가 uuid 가 아니면 Postgres 가 22P02 로 떨어진다 —
     잘못된 URL 은 에러가 아니라 404 로 다뤄야 한다. */
  if (!isUuid(id)) return null

  /* 디자이너와 작업을 동시에 묻는다 — 작업 질의는 id 만 있으면 되므로
     디자이너 결과를 기다릴 이유가 없다. 비공개로 판명되면 작업은 버린다. */
  const [{ data, error }, { data: workRows, error: workError }, contractPrice] = await Promise.all([
    selectDesigner<PublicDesignerDetail>((cols) =>
      db
        .from('designers')
        .select(cols)
        .eq('id', id)
        .in('visible', includeHidden ? [true, false] : [true])
        .in('profile_public', includeHidden ? [true, false] : [true])
        .maybeSingle()
        .overrideTypes<PublicDesignerDetail>(),
    ),
    selectWorks<WorkWithOwner>((cols) =>
      db
        .from('designer_works')
        .select(cols)
        .eq('designer_id', id)
        .eq('visible', true)
        .limit(MAX_WORKS)
        .overrideTypes<WorkWithOwner[]>(),
    ),
    getContractPrice(id),
  ])

  if (error) {
    console.error('[public] 디자이너 조회 실패:', error.message)
    return null
  }
  if (!data) return null

  if (workError) {
    console.error('[public] 작업 조회 실패:', workError.message)
  }

  const works = ((workRows ?? []) as WorkWithOwner[]).sort(byOrder).map(strip)

  return { ...(data as PublicDesignerDetail), works, contract_price: contractPrice }
}

/* 본 계약 시작가 — 030 마이그레이션 전에도 상세가 뜨게 따로 묻는다.

   DESIGNER_COLS 에 넣으면 컬럼이 없는 DB 에서 상세 질의가 통째로 실패해
   404 가 된다. 실패하면 기본값으로 메운다 — 어차피 지금은 모두 같은 금액이다.
   030 을 적용하고 나면 DESIGNER_COLS 로 옮겨도 된다. */
async function getContractPrice(id: string): Promise<number> {
  const { data, error } = await supabaseAdmin!
    .from('designers')
    .select('contract_price')
    .eq('id', id)
    .maybeSingle()
  if (error || !data) return DEFAULT_CONTRACT_PRICE
  return (data as { contract_price: number }).contract_price
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

  /* 아래 두 질의는 서로의 결과가 필요 없어 동시에 보낸다.

     1) 어드민이 고른 작업 — 고른 순서대로.
        디자이너가 그 사이 숨겼으면(visible=false) 빠진다. 어드민이 골랐더라도
        본인이 내린 작업을 공개 화면에 올리지는 않는다.

     2) 모자란 만큼 채울 최신 작업.
        정렬은 작업의 created_at 으로 한다 — sort_order 는 디자이너가
        자기 포트폴리오 안에서 매긴 순서라 디자이너끼리 비교할 수 없다.
        featured 를 읽지 않으므로 007 마이그레이션 전에도 홈이 평소대로 뜬다.
        고른 것이 최대 limit 장 섞여 들어오고, 같은 그림이 겹치면 아래에서
        걸러져 더 줄어든다 — 넉넉히 받아 둔다. 안 쓰면 버리면 그만이지만
        모자라면 홈이 중간에 끊긴다. */
  const [{ data: picked, error: pickError }, { data: workRows, error: workError }] =
    await Promise.all([
      selectWorks<WorkWithOwner>(
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
      ),
      selectWorks<WorkWithOwner>((cols) =>
        db
          .from('designer_works')
          .select(cols)
          .eq('visible', true)
          .in('designer_id', ids)
          .order('created_at', { ascending: false })
          .limit(FEED_FETCH_MAX)
          .overrideTypes<WorkWithOwner[]>(),
      ),
    ])

  if (pickError) {
    console.error('[public] 홈 피드 선택 작업 조회 실패:', pickError.message)
  }

  /* 같은 그림은 한 번만 — 디자이너가 달라도 벽에 같은 장면이 두 번 깔리면
     피드가 고장난 것처럼 보인다. 작업 id 가 아니라 이미지 주소로 거른다:
     id 는 행마다 다르지만 그림은 같을 수 있다(샘플 이미지를 여러 디자이너가
     나눠 쓰는 경우). 여기서만 걸러 두면 디자이너 상세에는 영향이 없다 —
     그 화면은 한 사람의 포트폴리오라 본인 작업이 빠지면 안 된다. */
  const seen = new Set<string>()
  const feed: FeedWork[] = []

  const add = (row: WorkWithOwner) => {
    if (seen.has(row.image_url)) return
    seen.add(row.image_url)
    feed.push(withOwner(row))
  }

  for (const row of (picked ?? []) as WorkWithOwner[]) {
    if (feed.length >= limit) break
    add(row)
  }
  if (feed.length >= limit) return feed

  if (workError) {
    console.error('[public] 홈 피드 작업 조회 실패:', workError.message)
    return feed
  }

  for (const row of (workRows ?? []) as WorkWithOwner[]) {
    if (feed.length >= limit) break
    add(row)
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
