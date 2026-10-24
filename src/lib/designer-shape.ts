/* 디자이너 행의 모양.

   클라이언트 컴포넌트도 이 타입을 쓰므로 server-only 모듈에 두지 않는다 —
   designers-db.ts 에서 가져오면 supabase-admin(service_role) 이 브라우저 번들로 끌려온다. */

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
  /* 가격 플랜 — 정해진 보기 중에서 고른다(plans.ts).
     디자인 플랜은 필수라 끄는 스위치가 없고, 프리미엄만 켜고 끌 수 있다. */
  design_price: number
  premium_price: number
  premium_enabled: boolean
}

/* 화면으로 내려보내는 모양 — 비밀번호 해시를 뺀 나머지 전부 */
export type AdminDesigner = Omit<DesignerRow, 'password_hash'>

/* ─────────── 공개 화면용 ───────────

   탐색·상세는 로그인 없이 누구나 본다. 계정 관련 값(temp_password·
   password_hash·last_login_at·email …)이 섞이면 그대로 노출되므로
   내보낼 항목만 따로 적는다 — Omit 으로 빼면 컬럼이 늘 때마다 새어 나간다. */

export type PublicWork = {
  id: string
  image_url: string
  width: number | null
  height: number | null
  title: string | null
  description: string | null
  row_span: number
  client: string | null
  /* AI 사용 여부 — true 일 때만 화면에 표기한다.
     null(묻기 전에 올라간 작업)과 false 를 구분해 보여주지 않는다. */
  ai_used: boolean | null
}

export type PublicDesigner = {
  id: string
  name: string | null
  avatar_url: string | null
  one_liner: string | null
  bio: string | null
  tags: string[]
  /* 가격 — 문구(이름·설명)는 전역 설정에서 따로 받는다 */
  design_price: number
  premium_price: number
  premium_enabled: boolean
}

/* 상세 화면 — 프로필과 작업을 함께 받는다 */
export type PublicDesignerDetail = PublicDesigner & { works: PublicWork[] }

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
