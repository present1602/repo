/* 디자이너 행의 모양.

   클라이언트 컴포넌트도 이 타입을 쓰므로 server-only 모듈에 두지 않는다 —
   designers-db.ts 에서 가져오면 supabase-admin(service_role) 이 브라우저 번들로 끌려온다. */

import type { WorkPage } from './portfolio-limits'
import type { DesignerSpecialtyPrices } from './specialty-shape'

export type DesignerRow = {
  id: string
  created_at: string
  updated_at: string
  email: string
  /* 선택값 — 어드민은 이메일만으로 등록할 수 있다.
     비어 있으면 displayName() 이 이메일 앞부분을 대신 쓴다. */
  name: string | null
  name_locked: boolean
  avatar_url: string | null
  /* 목록 카드에 한 줄로 들어가는 짧은 소개 */
  one_liner: string | null
  /* 상세 화면 이름 밑에 들어가는 문단 — 줄바꿈을 살려 보여준다 */
  bio: string | null
  tags: string[]
  /* 아래 넷은 서버 전용 — 공개 페이지로 내보내지 않는다.
     password_hash 는 로그인 확인에만 쓰고 화면으로 넘기지 않는다. */
  password_hash: string | null
  temp_password: string | null
  password_changed_at: string | null
  last_login_at: string | null
  /* 관리자용 계정 스위치 — false면 로그인까지 거부된다 */
  visible: boolean
  /* 디자이너 본인이 정하는 공개 여부 — false면 탐색 화면에서만 숨는다.
     visible 과 섞지 않는다(004_designer_activity.sql 주석 참고). */
  profile_public: boolean
  /* 포트폴리오에 이동 링크를 붙일 수 있는지 — 어드민만 켜고 끈다
     (0025_work_link.sql). 꺼져 있으면 스튜디오에 링크 칸이 뜨지 않는다.
     0025 전에는 select('*') 에 없어 undefined 로 온다 — 꺼짐으로 읽힌다. */
  portfolio_link_allowed?: boolean
  /* 탐색 목록에서의 차례 — 작은 수가 앞, 같으면 등록 역순
     (0026_designer_sort_order.sql). 어드민 노출 관리에서 끌어 정한다.
     0026 전에는 select('*') 에 없어 undefined 로 온다 — 0 으로 읽힌다. */
  sort_order?: number
  /* 가격 플랜 — 공개 화면에는 design_price ~ price_max 범위로 나간다.
     시작가는 디자이너가 보기 중에서 고르고(plans.ts),
     상한은 어드민이 직접 적는다(016_price_range.sql).
     디자인 플랜은 필수라 끄는 스위치가 없고, 프리미엄만 켜고 끌 수 있다. */
  design_price: number
  price_max: number
  premium_price: number
  premium_enabled: boolean
  /* 본 계약 시작가 — 어드민만 정한다(030_contract_price.sql).
     030 전에는 select('*') 에 없어 undefined 로 온다. */
  contract_price?: number
  /* 받을 의뢰 유형(017_designer_scopes.sql, 019_scope_sample_optional.sql).
     메인 시안·디자인 전체는 본인이, 디자인 + 개발은 어드민이 켜고 끈다.
     로고(033_logo_design.sql)도 본인이 — 033 전에는 select('*') 에 없어 undefined 로 온다. */
  scope_sample: boolean
  scope_logo?: boolean
  /* 로고 시작가(033_logo_design.sql) — 상한은 99,000원 고정. 033 전에는 undefined. */
  logo_price?: number
  scope_full_design: boolean
  scope_with_dev: boolean
  /* 디자인 전체·프로젝트 의뢰 최소가 — 어드민만 정한다(035_full_design_project_price.sql).
     035 전에는 select('*') 에 없어 undefined 로 온다. */
  full_design_price?: number
  project_price?: number
  /* 고객 초대 링크 코드(0006_invite_link.sql) — 0006 전에는 undefined */
  ref_code?: string
}

/* 화면으로 내려보내는 모양 — 비밀번호 해시를 뺀 나머지 전부 */
export type AdminDesigner = Omit<DesignerRow, 'password_hash'>

/* ─────────── 공개 화면용 ───────────

   탐색·상세는 로그인 없이 누구나 본다. 계정 관련 값(temp_password·
   password_hash·last_login_at·email …)이 섞이면 그대로 노출되므로
   내보낼 항목만 따로 적는다 — Omit 으로 빼면 컬럼이 늘 때마다 새어 나간다. */

export type PublicWork = {
  id: string
  /* 원본 — 상세 모달처럼 크게 띄우는 자리에 쓴다 */
  image_url: string
  /* 목록·피드용 작은 이미지(010_work_thumbnails.sql).
     조회 계층이 항상 채워 내보내므로 화면은 분기 없이 그냥 쓴다. */
  thumb_url: string
  /* PDF 로 올린 작업의 둘째 장부터(0008_work_pdf_pages.sql) — 모달이 첫 장 아래로
     이어 붙여 스크롤로 보여 준다. 0008 전 DB 에서는 오지 않는다. */
  pages?: WorkPage[] | null
  /* 작업 끝에 붙인 유튜브 영상 id(0019_work_video.sql) — 모달이 마지막 장
     아래에 이어 붙여 보여 준다. 0019 전 DB 에서는 오지 않는다. */
  video_id?: string | null
  /* 작업에 붙인 이동 주소(0025_work_link.sql) — 모달 하단 가운데에
     '프로젝트 보기' 버튼으로 뜬다. 0025 전 DB 에서는 오지 않는다. */
  link_url?: string | null
  width: number | null
  height: number | null
  title: string | null
  description: string | null
  row_span: number
  client: string | null
  /* AI 사용 여부 — true 일 때만 화면에 표기한다.
     null(묻기 전에 올라간 작업)과 false 를 구분해 보여주지 않는다. */
  ai_used: boolean | null
  /* SOOM 에서 수행한 의뢰인지 — true 일 때만 화면에 표기한다 */
  soom_work: boolean
  /* 어드민이 잡아 둔 썸네일 영역 — 원본에 대한 0~1 비율.
     넷 다 null 이면 썸네일 파일의 비율로 자리를 잡는다(work-thumb.tsx). */
  crop_x: number | null
  crop_y: number | null
  crop_w: number | null
  crop_h: number | null
}

export type PublicDesigner = {
  id: string
  name: string | null
  avatar_url: string | null
  one_liner: string | null
  bio: string | null
  tags: string[]
  /* 가격 — 시작가 ~ 상한 범위로 보여준다.
     문구(이름·설명)는 전역 설정에서 따로 받는다. */
  design_price: number
  price_max: number
  premium_price: number
  premium_enabled: boolean
  /* 로고 시작가 ~ LOGO_PRICE_MAX — scope_logo 를 켠 디자이너만 보여준다 */
  logo_price: number
  /* 디자인 전체·프로젝트 최소가 "N원~" — 어드민이 디자이너마다 정한다 */
  full_design_price: number
  project_price: number
  /* 이 디자이너에게만 적어 둔 분야별 시작가(0016_designer_specialty_prices.sql).
     분야 전체 금액(specialty_plan_prices)을 덮는다 — 적어 둔 분야만 담긴다.
     0016 전이거나 적어 둔 것이 없으면 비어 있다. */
  own_prices: DesignerSpecialtyPrices
  /* 탐색 화면이 이 넷으로 거른다(scopes.ts) */
  scope_sample: boolean
  scope_logo: boolean
  scope_full_design: boolean
  scope_with_dev: boolean
}

/* 상세 화면 — 프로필과 작업을 함께 받는다.
   본 계약 시작가는 상세 화면의 플랜 카드에만 나가므로 여기에만 싣는다. */
export type PublicDesignerDetail = PublicDesigner & {
  works: PublicWork[]
  contract_price: number
}

/* 탐색 목록 한 줄 — 카드에 썸네일 몇 장과 총 개수를 함께 보여준다 */
export type PublicDesignerCard = PublicDesigner & {
  works: PublicWork[]
  works_total: number
}

/* 홈 피드 한 장 — 작업에 "누가 올렸는지"를 붙인 모양.

   탐색 카드(PublicDesignerCard)와 방향이 반대다. 저쪽은 디자이너 아래에
   작업이 달리고, 여기서는 작업마다 디자이너가 달린다. 홈은 여러 디자이너의
   작업을 한 피드로 섞어 보여주기 때문이다.

   디자이너 쪽은 피드에 실제로 쓰는 값만 담는다 — 프로필 전체를 실으면
   작업 40장마다 소개글·가격까지 따라 나간다. */
export type FeedDesigner = {
  id: string
  name: string | null
  avatar_url: string | null
  tags: string[]
}

export type FeedWork = PublicWork & { designer: FeedDesigner }

/* 어드민 목록에 함께 싣는 집계. designer_activity 뷰에서 온다. */
export type DesignerActivity = {
  last_login_at: string | null
  logins_30d: number
  last_work_at: string | null
  works_visible: number
  works_total: number
}

/* 목록 한 줄 — 계정 정보와 집계를 합친 모양 */
export type AdminDesignerListRow = AdminDesigner & { activity: DesignerActivity }
