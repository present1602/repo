-- ════════════════════════════════════════════════════════
-- 처음 스키마 — 001 ~ 039 를 하나로 합친 기준점 (2026-11-02)
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 Run
-- 빈 DB 에서 한 번 돌린다. 여러 번 실행해도 안전하다 (멱등).
-- ════════════════════════════════════════════════════════
--
-- 001 ~ 039 를 차례로 돌린 결과와 같은 스키마다(로컬 Postgres 두 대에 각각 돌려
-- pg_dump 로 비교했다). 다음 변경부터는 0002_… 로 이어 쓴다.
--
-- 모든 표는 RLS 를 켜고 정책을 두지 않는다 — anon·authenticated 키로는 아무것도
-- 읽거나 쓸 수 없고, 서버의 service_role 만 쓴다. 공개 화면도 서버를 거친다.
--
-- 어드민 계정은 auth 스키마(Supabase Auth)에 있어 여기서 만들지 않는다.

-- ─────────────────────────────────────────
-- 0. 공통 — updated_at 갱신 트리거 함수
-- ─────────────────────────────────────────

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ─────────────────────────────────────────
-- 1. 디자이너
-- ─────────────────────────────────────────
-- 어드민이 등록하거나 초대코드로 가입한다. 로그인은 이메일 + 비밀번호(해시).
-- 칸 순서는 001 ~ 039 에서 더해진 차례 그대로다.

create table if not exists public.designers (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  email           text not null unique,
  name            text,
  name_locked     boolean not null default false,
  avatar_url      text,
  one_liner       text,
  tags            text[] not null default '{}',
  password_hash   text,
  temp_password   text,
  password_changed_at timestamptz,
  last_login_at   timestamptz,
  visible         boolean not null default true,
  profile_public  boolean not null default false,
  bio             text,

  -- 가격(원). 시안은 '시작가 ~ 상한' 범위로 보여준다
  design_price    integer not null default 29000,
  premium_price   integer not null default 79000,
  premium_enabled boolean not null default false,
  price_max       integer not null default 99000,

  -- 받을 의뢰 유형
  scope_full_design boolean not null default false,
  scope_with_dev    boolean not null default false,
  scope_sample      boolean not null default true,

  contract_price    integer not null default 189000,
  scope_logo        boolean not null default false,
  logo_price        integer not null default 19900,
  full_design_price integer not null default 179000,
  project_price     integer not null default 349000,

  constraint designers_bio_len check (char_length(coalesce(bio, '')) <= 2000),
  constraint designers_premium_price_allowed check (premium_price in (79000, 109000, 169000)),
  constraint designers_price_max_range check (price_max between 29000 and 1000000),
  constraint designers_design_price_allowed
    check (design_price in (29000, 39000, 49000, 59000, 79000, 99000)),
  constraint designers_price_order check (design_price <= price_max),
  constraint designers_contract_price_range check (contract_price between 10000 and 100000000),
  constraint designers_logo_price_allowed
    check (logo_price in (19900, 29000, 39000, 49000, 59000, 79000, 99000)),
  constraint designers_full_design_price_range check (full_design_price between 10000 and 100000000),
  constraint designers_project_price_range check (project_price between 10000 and 100000000)
);

comment on table  public.designers is '디자이너 계정 · 프로필';
comment on column public.designers.temp_password is '발급한 임시 비밀번호(평문). 본인이 변경하면 null이 되어 더는 확인할 수 없다.';
comment on column public.designers.name_locked is 'true면 디자이너 본인은 이름을 바꿀 수 없다(관리자에게 요청).';
comment on column public.designers.visible is 'false면 탐색 화면에서 숨고 로그인도 거부된다.';
comment on column public.designers.name is
  '표시 이름. 선택값 — 비어 있으면 화면에서 이메일 앞부분을 대신 쓴다.';
comment on column public.designers.profile_public is
  '디자이너 본인이 정하는 프로필 공개 여부. 신규 가입은 비공개로 시작한다. 계정 정지는 visible 을 쓴다.';
comment on column public.designers.bio is
  '상세 화면용 긴 소개글. 목록 카드의 한 줄 소개는 one_liner 를 쓴다.';
comment on column public.designers.design_price is
  '디자인 플랜 금액(원).';
comment on column public.designers.premium_price is
  '프리미엄 플랜 금액(원).';
comment on column public.designers.premium_enabled is
  'false면 공개 화면에 프리미엄 플랜을 보여주지 않는다. 디자인 플랜은 항상 보인다.';
comment on column public.designers.price_max is
  '시안 가격 상한(원). 어드민이 디자이너마다 정한다. 공개 화면은 design_price ~ price_max 로 보여준다.';
comment on column public.designers.scope_full_design is
  '디자인 전체 의뢰를 받는지. 메인 시안은 모두가 받으므로 따로 두지 않는다.';
comment on column public.designers.scope_with_dev is
  '디자인 + 개발 의뢰를 받는지. 어드민만 켜고 끈다 — 오프라인 미팅·상주 근무
   요청이 따를 수 있어 디자이너를 보고 열어 준다. 본인은 보기만 한다.';
comment on column public.designers.scope_sample is
  '메인 시안 의뢰를 받는지. 디자이너 본인이 켜고 끈다. 기본 켜짐.';
comment on column public.designers.contract_price is
  '본 계약 시작가(원). 어드민이 디자이너마다 정한다. 상세 화면에 "본 계약 의뢰는 전부 N원~" 으로 나간다.';
comment on column public.designers.scope_logo is
  '로고 디자인 의뢰를 받는지. 디자이너 본인이 켜고 끈다. 기본 꺼짐.';
comment on column public.designers.logo_price is
  '로고 디자인 시작가(원). 디자이너가 고른다. 공개 화면은 logo_price ~ 99,000원 으로 보여준다.';
comment on column public.designers.full_design_price is
  '디자인 전체 의뢰 최소가(원). 어드민이 디자이너마다 정한다.';
comment on column public.designers.project_price is
  '프로젝트 의뢰 최소가(원). 어드민이 디자이너마다 정한다.';

create index if not exists designers_visible_idx on public.designers (visible, created_at desc);
create index if not exists designers_public_idx
  on public.designers (visible, profile_public, created_at desc);
create index if not exists designers_scope_idx
  on public.designers (scope_full_design, scope_with_dev)
  where visible and profile_public;

drop trigger if exists designers_touch_updated_at on public.designers;
create trigger designers_touch_updated_at
  before update on public.designers
  for each row execute function public.touch_updated_at();

-- ─────────────────────────────────────────
-- 2. 포트폴리오 작업
-- ─────────────────────────────────────────

create table if not exists public.designer_works (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  designer_id   uuid not null references public.designers(id) on delete cascade,
  image_url     text not null,
  width         integer,
  height        integer,
  title         text,
  description   text,
  row_span      integer not null default 1,
  visible       boolean not null default true,
  sort_order    integer not null default 0,
  client        text,
  year          integer,
  featured      boolean not null default false,
  featured_at   timestamptz,
  ai_used       boolean,
  crop_x        real,
  crop_y        real,
  crop_w        real,
  crop_h        real,
  thumb_url     text,
  soom_work     boolean not null default false,

  constraint designer_works_description_len check (char_length(coalesce(description, '')) <= 1000),
  constraint designer_works_row_span_range  check (row_span between 1 and 3),
  constraint designer_works_year_range check (year is null or year between 1900 and 2200),
  constraint designer_works_crop_range check (
    (crop_x is null and crop_y is null and crop_w is null and crop_h is null)
    or (
      crop_x >= 0 and crop_y >= 0
      and crop_w > 0 and crop_h > 0
      and crop_x + crop_w <= 1.0001   -- 부동소수 오차만큼 여유를 둔다
      and crop_y + crop_h <= 1.0001
    )
  )
);

comment on table  public.designer_works is '디자이너별 포트폴리오 이미지';
comment on column public.designer_works.row_span is
  'masonry 에서 차지할 세로 칸 수(1~3). 가로는 그리드가 정한다.';
comment on column public.designer_works.client is
  '클라이언트명 또는 작업 성격(예: 개인 작업). 선택 입력.';
comment on column public.designer_works.year is
  '작업 연도. 선택 입력.';
comment on column public.designer_works.featured is
  '어드민이 메인 화면에 노출하려고 고른 작업. 디자이너의 visible 과 별개다 —
   메인에 뜨려면 둘 다 참이어야 한다.';
comment on column public.designer_works.featured_at is
  '메인 노출로 고른 시각. featured 가 거짓이면 의미 없다.';
comment on column public.designer_works.ai_used is
  '작업에 AI 를 썼는지 본인이 체크한 값. null 은 묻기 전에 올라간 작업 —
   false(쓰지 않았다고 밝힘)와 섞지 않는다. 공개 화면은 true 만 표기한다.';
comment on column public.designer_works.crop_x is
  '썸네일 영역 좌상단 x — 원본 너비에 대한 0~1 비율. 넷 다 null 이면 영역 미지정.';
comment on column public.designer_works.crop_y is
  '썸네일 영역 좌상단 y — 원본 높이에 대한 0~1 비율.';
comment on column public.designer_works.crop_w is
  '썸네일 영역 너비 — 원본 너비에 대한 0~1 비율.';
comment on column public.designer_works.crop_h is
  '썸네일 영역 높이 — 원본 높이에 대한 0~1 비율.';
comment on column public.designer_works.thumb_url is
  '목록·피드에서 쓰는 작은 이미지. 상세 모달은 image_url(원본)을 쓴다.
   crop_* 영역이 있으면 그 영역만 잘라 만든다.';
comment on column public.designer_works.soom_work is
  'SOOM 에서 수행한 의뢰의 결과물인지. 디자이너 본인 또는 어드민이 체크한다.';

create index if not exists designer_works_designer_idx
  on public.designer_works (designer_id, sort_order, created_at);
create index if not exists designer_works_featured_idx
  on public.designer_works (featured_at desc)
  where featured;

-- 한 디자이너당 최대 30개 — 서버에서도 막지만 여기가 최종 방어선이다
create or replace function public.designer_works_guard()
returns trigger
language plpgsql
as $$
declare
  total integer;
begin
  if tg_op = 'INSERT' then
    select count(*) into total
      from public.designer_works
     where designer_id = new.designer_id;

    if total >= 30 then
      raise exception '포트폴리오는 최대 30개까지 올릴 수 있습니다.'
        using errcode = 'check_violation';
    end if;
  end if;

  return new;
end $$;

drop trigger if exists designer_works_guard_trg on public.designer_works;
create trigger designer_works_guard_trg
  before insert on public.designer_works
  for each row execute function public.designer_works_guard();

drop trigger if exists designer_works_touch_updated_at on public.designer_works;
create trigger designer_works_touch_updated_at
  before update on public.designer_works
  for each row execute function public.touch_updated_at();

-- ─────────────────────────────────────────
-- 3. 로그인 기록 · 활동 집계 뷰
-- ─────────────────────────────────────────

create table if not exists public.designer_logins (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  designer_id   uuid not null references public.designers(id) on delete cascade
);

comment on table public.designer_logins is
  '디자이너 로그인 1회 = 1행. 최근 30일 횟수 집계에 쓴다.';

create index if not exists designer_logins_designer_idx
  on public.designer_logins (designer_id, created_at desc);

create or replace view public.designer_activity
with (security_invoker = true)
as
select
  d.id as designer_id,
  greatest(
    d.last_login_at,
    (select max(l.created_at) from public.designer_logins l where l.designer_id = d.id)
  ) as last_login_at,
  coalesce((
    select count(*) from public.designer_logins l
     where l.designer_id = d.id
       and l.created_at >= now() - interval '30 days'
  ), 0) as logins_30d,
  (select max(w.created_at) from public.designer_works w where w.designer_id = d.id)
    as last_work_at,
  coalesce((
    select count(*) from public.designer_works w
     where w.designer_id = d.id and w.visible
  ), 0) as works_visible,
  coalesce((
    select count(*) from public.designer_works w where w.designer_id = d.id
  ), 0) as works_total
from public.designers d;

comment on view public.designer_activity is
  '어드민 목록용 집계 — 마지막 로그인·최근 30일 로그인 수·최근 업로드·포트폴리오(노출/전체).';

-- ─────────────────────────────────────────
-- 4. 사이트 설정 (한 줄)
-- ─────────────────────────────────────────
-- design_plan_* · premium_plan_* 는 plan_copy 로 옮겨 가 더 쓰지 않는다 — 남겨만 둔다.

create table if not exists public.site_settings (
  id          boolean primary key default true,
  updated_at  timestamptz not null default now(),
  design_plan_name  text not null default '디자인 플랜',
  design_plan_desc  text not null default '',
  premium_plan_name text not null default '프리미엄 플랜',
  premium_plan_desc text not null default '',
  scope_prompt      boolean not null default true,
  show_duration     boolean not null default false,

  constraint site_settings_single_row check (id),
  constraint site_settings_desc_len check (
    char_length(design_plan_desc)  <= 500 and
    char_length(premium_plan_desc) <= 500
  )
);

comment on table public.site_settings is
  '사이트 전역 설정. 한 줄만 존재한다(id = true).';
comment on column public.site_settings.scope_prompt is
  '탐색에서 의뢰유형을 묻는지. 끄면 묻는 창과 제목 옆 의뢰유형 표시가 모두 빠진다.';
comment on column public.site_settings.show_duration is
  '작업 기간을 공개 화면에 보여주는지. 꺼져 있으면 넣어 둔 기간이 모두 나가지 않는다.';

insert into public.site_settings (id) values (true)
on conflict (id) do nothing;

drop trigger if exists site_settings_touch_updated_at on public.site_settings;
create trigger site_settings_touch_updated_at
  before update on public.site_settings
  for each row execute function public.touch_updated_at();

-- ─────────────────────────────────────────
-- 5. 전문 분야
-- ─────────────────────────────────────────

create table if not exists public.specialties (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  name        text not null unique,
  sort_order  integer not null default 0,
  visible     boolean not null default true,
  scope_mode  text not null default 'choice',
  allow_sample boolean not null default false,

  constraint specialties_name_len check (char_length(trim(name)) between 1 and 40),
  constraint specialties_scope_mode_allowed check (scope_mode in ('choice', 'design', 'design_dev'))
);

comment on table  public.specialties is '어드민이 관리하는 전문 분야 목록. designers.tags 가 이 이름을 담는다.';
comment on column public.specialties.name is '화면에 보이는 이름이자 designers.tags 에 담기는 값. 바꾸면 쓰던 디자이너의 tags 도 함께 고쳐야 한다.';
comment on column public.specialties.visible is 'false 면 탐색 필터와 디자이너 선택지에서 빠진다. 이미 고른 디자이너의 tags 는 건드리지 않는다.';
comment on column public.specialties.scope_mode is
  '의뢰 범위. choice = 탐색에서 디자인/디자인+개발 필터를 보여줌, design = 디자인만, design_dev = 디자인+개발 묶음.';
comment on column public.specialties.allow_sample is
  '이 분야에서 메인 시안만 먼저 의뢰를 받을 수 있는지. 디자이너별 스위치(designers.scope_sample)와 둘 다 켜져야 한다.';

create index if not exists specialties_order_idx
  on public.specialties (sort_order, name)
  where visible;

-- ─────────────────────────────────────────
-- 6. 의뢰 문의
-- ─────────────────────────────────────────
-- inquiry_type 은 화면에 보이는 글자를 그대로 담는다(inquiry-types.ts 와 같은 값).

create table if not exists public.inquiries (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  name          text not null,
  email         text not null,
  message       text not null,
  designer_id   uuid,
  designer_name text,
  files         jsonb not null default '[]'::jsonb,
  submit_key    text unique,
  status        text not null default 'unread',
  memo          text,
  mailed        boolean not null default false,
  status_at     timestamptz,
  phone         text,
  inquiry_type  text,
  plan_tier     text,

  constraint inquiries_name_len    check (char_length(trim(name)) between 1 and 100),
  constraint inquiries_email_len   check (char_length(trim(email)) between 3 and 200),
  constraint inquiries_message_len check (char_length(trim(message)) between 1 and 5000),
  constraint inquiries_phone_len   check (phone is null or char_length(trim(phone)) between 1 and 40),
  constraint inquiries_status_check check (status in ('unread', 'read')),
  constraint inquiries_type_allowed check (
    inquiry_type is null
    or inquiry_type in ('메인화면 시안 먼저 의뢰', '로고 디자인', '디자인', '프로젝트 의뢰')
  ),
  constraint inquiries_plan_tier_allowed check (plan_tier is null or plan_tier in ('basic', 'premium'))
);

comment on table  public.inquiries is '의뢰 문의 접수. 로그인 없이 들어오고 어드민이 처리한다.';
comment on column public.inquiries.submit_key is '중복 제출 차단용. 같은 키로는 한 번만 저장된다.';
comment on column public.inquiries.designer_id is '특정 디자이너에게 보낸 문의면 채워진다. 외래키를 걸지 않아 디자이너가 지워져도 기록이 남는다.';
comment on column public.inquiries.mailed is '알림 메일 발송 성공 여부. 실패해도 접수는 저장된다.';
comment on column public.inquiries.status_at is '상태를 마지막으로 바꾼 시각. 접수 직후에는 null.';
comment on column public.inquiries.phone is
  '연락처. 화면에서는 필수지만, 013 이전에 들어온 문의는 비어 있다.';
comment on column public.inquiries.status is
  '확인 여부. unread = 아직 확인 안 함(기본), read = 확인함.';
comment on column public.inquiries.inquiry_type is
  '의뢰 유형: 메인화면 시안 먼저 의뢰 / 로고 디자인 / 디자인 / 프로젝트 의뢰. 014 이전 문의는 null.';
comment on column public.inquiries.plan_tier is
  '고객이 고른 단계: basic / premium. 프리미엄을 고를 수 없던 문의는 null.';

create index if not exists inquiries_created_idx on public.inquiries (created_at desc);
create index if not exists inquiries_status_idx  on public.inquiries (status, created_at desc);
create index if not exists inquiries_type_idx
  on public.inquiries (inquiry_type, created_at desc);

-- ─────────────────────────────────────────
-- 7. 디자이너 지원서
-- ─────────────────────────────────────────

create table if not exists public.designer_applications (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  name        text not null,
  email       text not null,
  resume      jsonb,
  portfolio   jsonb,
  submit_key  text not null unique,
  status      text not null default 'unread'
              check (status in ('unread', 'read')),
  status_at   timestamptz,
  intro         text,
  portfolio_url text,
  resume_url    text,

  constraint designer_applications_name_len  check (char_length(trim(name)) between 1 and 100),
  constraint designer_applications_email_len check (char_length(trim(email)) between 3 and 200),
  constraint designer_applications_portfolio_or_url
    check (portfolio is not null or nullif(trim(portfolio_url), '') is not null),
  constraint designer_applications_intro_len
    check (intro is null or char_length(intro) <= 500)
);

comment on table public.designer_applications is
  '디자이너 지원서. 제안서에서 로그인 없이 들어오고 어드민이 확인한다.';
comment on column public.designer_applications.intro is
  '이력서 대신 적은 짧은 자기소개(500자 이내). 이력서 파일이 있으면 비어 있다.';
comment on column public.designer_applications.portfolio_url is
  '포트폴리오 파일 대신 적은 주소. 파일이 있으면 비어 있다.';
comment on column public.designer_applications.resume is
  '기타 자료 파일(이력서·자소서 등). 선택 — 예전 지원서에서는 이력서 파일.';
comment on column public.designer_applications.resume_url is
  '기타 자료 주소. 선택 — 파일을 냈으면 비어 있다.';

create index if not exists designer_applications_created_idx
  on public.designer_applications (created_at desc);

-- ─────────────────────────────────────────
-- 8. 팝업
-- ─────────────────────────────────────────

do $$
begin
  if not exists (select 1 from pg_type where typname = 'popup_status') then
    create type public.popup_status as enum ('visible', 'hidden', 'expired');
  end if;
end $$;

create table if not exists public.popups (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  title       text,
  body        jsonb not null default '[]'::jsonb,
  files       jsonb not null default '[]'::jsonb,
  starts_at   timestamptz,
  ends_at     timestamptz,
  status      public.popup_status not null default 'hidden',
  status_at   timestamptz,

  constraint popups_title_len   check (title is null or char_length(title) <= 100),
  constraint popups_body_array  check (jsonb_typeof(body) = 'array' and jsonb_array_length(body) > 0),
  constraint popups_files_array check (jsonb_typeof(files) = 'array'),
  constraint popups_period      check (starts_at is null or ends_at is null or starts_at < ends_at)
);

comment on table  public.popups is '사이트 팝업. 어드민이 올리고 게시 기간·상태에 따라 공개 화면에 뜬다.';
comment on column public.popups.body is '본문 블록 배열. 글 또는 이미지(path). 비어 있을 수 없다.';
comment on column public.popups.files is '첨부 파일 [{ name, path, size }] — 본문 이미지와 별개.';
comment on column public.popups.status is 'visible 노출 / hidden 숨김 / expired 기간이 지나 자동 만료.';

create index if not exists popups_created_idx on public.popups (created_at desc);
create index if not exists popups_status_idx  on public.popups (status, ends_at);

-- ─────────────────────────────────────────
-- 9. 초대코드 · 이메일 인증
-- ─────────────────────────────────────────

do $$
begin
  if not exists (select 1 from pg_type where typname = 'invite_status') then
    create type public.invite_status as enum ('active', 'verified', 'used', 'expired', 'canceled');
  end if;
end $$;

create table if not exists public.designer_invites (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  code        text not null unique,
  memo        text,
  expires_at  timestamptz not null,
  status      public.invite_status not null default 'active',
  status_at   timestamptz,
  used_at     timestamptz,
  used_by     uuid references public.designers(id) on delete set null,
  used_email  text,
  verified_at timestamptz,

  constraint designer_invites_memo_len check (memo is null or char_length(memo) <= 100),
  constraint designer_invites_max_period check (expires_at <= created_at + interval '15 days'),
  constraint designer_invites_code_fmt check (code ~ '^[A-Z0-9_]{4,15}$')
);

comment on table  public.designer_invites is '디자이너 초대코드. 어드민이 발행하고, 한 코드로 한 명이 가입한다.';
comment on column public.designer_invites.status is
  'active 발행 / verified 인증함(가입 전, 계속 사용 가능) / used 사용됨 / expired 만료(조회 때 전환) / canceled 취소.';
comment on column public.designer_invites.used_email is '가입 당시 이메일. 디자이너가 지워지거나 이메일을 바꿔도 남는다.';
comment on column public.designer_invites.verified_at is
  '가입 화면에서 이 코드로 처음 인증한 시각. 가입 전이어도 남는다.';

create index if not exists designer_invites_created_idx on public.designer_invites (created_at desc);

create table if not exists public.email_verifications (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  email        text not null,
  code_hash    text not null,
  expires_at   timestamptz not null,
  attempts     int not null default 0,
  verified_at  timestamptz,
  consumed_at  timestamptz
);

comment on table public.email_verifications is '가입용 이메일 인증코드. 코드는 해시로만 저장한다.';

create index if not exists email_verifications_email_idx
  on public.email_verifications (email, created_at desc);

-- ─────────────────────────────────────────
-- 10. 후기 · 후기 링크
-- ─────────────────────────────────────────
-- 링크는 문의에서 만들거나(inquiry_id) 어드민이 직접 만든다(author_name).

do $$
begin
  if not exists (select 1 from pg_type where typname = 'review_status') then
    create type public.review_status as enum ('pending', 'approved', 'rejected');
  end if;
end $$;

create table if not exists public.review_tokens (
  token        uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  inquiry_id   uuid references public.inquiries(id) on delete cascade,
  expires_at   timestamptz not null,
  used_at      timestamptz,
  sent_count   integer not null default 0,
  last_sent_at timestamptz,
  designer_id   uuid,
  designer_name text,
  author_name   text,
  author_email  text,
  memo          text,

  constraint review_tokens_origin_chk
    check (inquiry_id is not null or char_length(trim(coalesce(author_name, ''))) > 0)
);

comment on table  public.review_tokens is '후기 작성용 1회성 링크. 토큰이 곧 열쇠다.';
comment on column public.review_tokens.used_at is '후기를 쓴 시각. 채워지면 그 링크는 끝난다.';
comment on column public.review_tokens.sent_count is '발송 횟수. 재발송이 잦으면 전달 경로를 의심한다.';
comment on column public.review_tokens.designer_id is
  '직접 만든 링크의 대상 디자이너. 문의에서 만든 링크는 비어 있고 inquiries 를 따른다.';
comment on column public.review_tokens.author_name is
  '직접 만든 링크의 작성자 이름. 문의에서 만든 링크는 비어 있다.';
comment on column public.review_tokens.memo is
  '어드민 메모. 직접 만든 링크를 목록에서 구분하는 데 쓴다.';

create index if not exists review_tokens_expires_idx
  on public.review_tokens (expires_at);
create unique index if not exists review_tokens_inquiry_uniq
  on public.review_tokens (inquiry_id) where inquiry_id is not null;

create table if not exists public.reviews (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  inquiry_id  uuid references public.inquiries(id) on delete cascade,
  designer_id   uuid,
  designer_name text,
  author_name  text not null,
  author_email text not null,
  body        text not null,
  rating      smallint,
  status      public.review_status not null default 'pending',
  status_at   timestamptz,
  status_memo text,
  client_id   uuid,
  linked_at   timestamptz,
  work_id     uuid,
  token       uuid,

  constraint reviews_body_len   check (char_length(trim(body)) between 10 and 2000),
  constraint reviews_rating_rng check (rating is null or rating between 1 and 5)
);

comment on table  public.reviews is '의뢰 후기. 로그인 없이 링크로 쓰고, 어드민 승인 후 공개된다.';
comment on column public.reviews.designer_id is
  '후기 대상 디자이너. 외래키를 걸지 않아 디자이너가 지워져도 후기는 남는다.';
comment on column public.reviews.author_email is
  '작성 시점의 이메일. 나중에 클라이언트 계정과 잇는 열쇠다.';
comment on column public.reviews.rating is
  '별점(1~5). 지금은 받지 않아 늘 null 이다 — 나중에 켤 때 쓰려고 비워 둔 자리.';
comment on column public.reviews.client_id is
  '클라이언트 회원가입 도입 후 연결되는 계정. null 이면 비회원이 쓴 후기다.';
comment on column public.reviews.work_id is
  'SOOM 의뢰로 올린 포트폴리오(designer_works.soom_work)와 이을 자리. 지금은 쓰지 않는다.';
comment on column public.reviews.token is
  '후기를 쓴 링크의 토큰. 문의 없이 만든 링크의 출처를 되짚는 데 쓴다.';

create index if not exists reviews_designer_idx
  on public.reviews (designer_id, status, created_at desc);
create index if not exists reviews_status_idx
  on public.reviews (status, created_at desc);
create index if not exists reviews_author_email_idx
  on public.reviews (lower(author_email));
create index if not exists reviews_unlinked_idx
  on public.reviews (lower(author_email)) where client_id is null;
create index if not exists reviews_work_idx
  on public.reviews (work_id) where work_id is not null;
create unique index if not exists reviews_inquiry_uniq
  on public.reviews (inquiry_id) where inquiry_id is not null;
create index if not exists reviews_token_idx
  on public.reviews (token) where token is not null;

drop trigger if exists reviews_touch_updated_at on public.reviews;
create trigger reviews_touch_updated_at
  before update on public.reviews
  for each row execute function public.touch_updated_at();

-- ─────────────────────────────────────────
-- 11. 탐색 상단 디자이너
-- ─────────────────────────────────────────

create table if not exists public.explore_features (
  designer_id uuid primary key references public.designers (id) on delete cascade,
  created_at  timestamptz not null default now(),
  layout      text not null default 'feature1',
  sort_order  integer not null default 0,
  constraint explore_features_layout check (layout in ('feature1'))
);

comment on table public.explore_features is
  '탐색 상단에 크게 올릴 디자이너. 여기 없는 디자이너는 기본 카드로 아래에 선다.';

create index if not exists explore_features_order_idx
  on public.explore_features (layout, sort_order);

-- ─────────────────────────────────────────
-- 12. 플랜 문구 · 프리미엄 · 작업 기간 · 포함 항목
-- ─────────────────────────────────────────
-- plan 은 scopes.ts 의 SCOPES 와 같은 값, tier 는 basic / premium.

create table if not exists public.plan_copy (
  plan        text not null,
  tier        text not null,
  updated_at  timestamptz not null default now(),
  name        text not null,
  description text not null default '',
  enabled     boolean not null default false,
  duration    text not null default '',
  visible     boolean not null default true,
  primary key (plan, tier),
  constraint plan_copy_plan_allowed check (plan in ('sample', 'logo', 'full_design', 'with_dev')),
  constraint plan_copy_tier_allowed check (tier in ('basic', 'premium')),
  constraint plan_copy_name_len check (char_length(name) between 1 and 40),
  constraint plan_copy_desc_len check (char_length(description) <= 500),
  constraint plan_copy_duration_len check (char_length(duration) <= 40)
);

comment on table public.plan_copy is
  '의뢰 유형(plan)·단계(basic/premium)별 이름과 설명. 모든 디자이너가 함께 쓴다.';
comment on column public.plan_copy.enabled is
  '프리미엄 줄: 이 유형의 프리미엄을 쓰는지(꺼져 있으면 디자이너별로도 켤 수 없다). 기본 줄: 쓰지 않는다.';
comment on column public.plan_copy.duration is
  '작업 기간(전체 공통). 비면 나가지 않는다. 디자이너별 값은 designer_plan_details.duration.';
comment on column public.plan_copy.visible is
  '기본 줄: 이 플랜을 사이트에 보여주는지. 끄면 공개 화면 어디에도 나가지 않는다. 프리미엄 줄: 쓰지 않는다.';

drop trigger if exists plan_copy_touch_updated_at on public.plan_copy;
create trigger plan_copy_touch_updated_at
  before update on public.plan_copy
  for each row execute function public.touch_updated_at();

-- 처음 문구 — 이미 있으면 건드리지 않는다(다시 실행해도 어드민이 고친 문구가 남는다).
-- plans.ts 의 FALLBACK_PLAN_COPIES 와 같은 값이다.
insert into public.plan_copy (plan, tier, name, description) values
  ('sample',      'basic',   '메인화면 우선 의뢰', '메인화면 시안만 먼저 의뢰합니다.'),
  ('sample',      'premium', '메인화면 우선 의뢰 프리미엄', ''),
  ('logo',        'basic',   '로고 디자인', '로고 디자인을 의뢰합니다.'),
  ('logo',        'premium', '로고 디자인 프리미엄', ''),
  ('full_design', 'basic',   '디자인 전체 의뢰', '서비스 전체 디자인을 맡깁니다.'),
  ('full_design', 'premium', '디자인 전체 의뢰 프리미엄', ''),
  ('with_dev',    'basic',   '프로젝트 의뢰', '기획, 개발까지 포함한 프로젝트 전체 의뢰를 맡깁니다.'),
  ('with_dev',    'premium', '프로젝트 의뢰 프리미엄', '')
on conflict (plan, tier) do nothing;

create table if not exists public.designer_premium_prices (
  designer_id uuid not null references public.designers (id) on delete cascade,
  plan        text not null,
  price       integer not null,
  updated_at  timestamptz not null default now(),
  enabled     boolean not null default true,
  primary key (designer_id, plan),
  constraint designer_premium_prices_plan_allowed
    check (plan in ('sample', 'logo', 'full_design', 'with_dev')),
  constraint designer_premium_prices_range check (price between 10000 and 100000000)
);

comment on table public.designer_premium_prices is
  '디자이너·유형별 프리미엄 스위치와 금액(원). 어드민만 정한다. 유형 전체 스위치(plan_copy.enabled)가 켜져야 나간다.';

drop trigger if exists designer_premium_prices_touch_updated_at on public.designer_premium_prices;
create trigger designer_premium_prices_touch_updated_at
  before update on public.designer_premium_prices
  for each row execute function public.touch_updated_at();

create table if not exists public.designer_plan_details (
  designer_id uuid not null references public.designers (id) on delete cascade,
  plan        text not null,
  tier        text not null,
  duration    text,
  updated_at  timestamptz not null default now(),
  primary key (designer_id, plan, tier),
  constraint designer_plan_details_plan_allowed
    check (plan in ('sample', 'logo', 'full_design', 'with_dev')),
  constraint designer_plan_details_tier_allowed check (tier in ('basic', 'premium')),
  constraint designer_plan_details_duration_len check (duration is null or char_length(duration) <= 40)
);

comment on table public.designer_plan_details is
  '디자이너·플랜별 작업 기간. 비운 값은 전체 공통값(plan_copy.duration)을 따른다.';

drop trigger if exists designer_plan_details_touch_updated_at on public.designer_plan_details;
create trigger designer_plan_details_touch_updated_at
  before update on public.designer_plan_details
  for each row execute function public.touch_updated_at();

create table if not exists public.option_templates (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  template    text not null,
  sort_order  integer not null default 0,
  targets     text[],
  designer_id uuid references public.designers (id) on delete cascade,
  constraint option_templates_len check (char_length(template) between 1 and 80),
  constraint option_templates_targets_allowed check (
    targets is null or targets <@ array[
      'sample:basic', 'sample:premium', 'logo:basic', 'logo:premium',
      'full_design:basic', 'full_design:premium', 'with_dev:basic', 'with_dev:premium'
    ]::text[]
  )
);

comment on table public.option_templates is
  '포함 항목 문장 템플릿. {n} 자리에 디자이너가 넣은 숫자. targets 가 null 이면 모든 플랜에서 고를 수 있다. designer_id 가 있으면 그 디자이너 전용.';

create unique index if not exists option_templates_template_uniq
  on public.option_templates (template) where designer_id is null;
create unique index if not exists option_templates_designer_template_uniq
  on public.option_templates (designer_id, template) where designer_id is not null;

drop trigger if exists option_templates_touch_updated_at on public.option_templates;
create trigger option_templates_touch_updated_at
  before update on public.option_templates
  for each row execute function public.touch_updated_at();

insert into public.option_templates (template, sort_order) values
  ('메인 화면 시안 {n}종', 0),
  ('수정 {n}회', 1),
  ('마음에 들면 본 계약으로 전환', 2)
on conflict (template) where designer_id is null do nothing;

create table if not exists public.designer_plan_options (
  designer_id  uuid not null references public.designers (id) on delete cascade,
  plan         text not null,
  tier         text not null,
  template_id  uuid not null references public.option_templates (id) on delete cascade,
  n            integer,
  updated_at   timestamptz not null default now(),
  primary key (designer_id, plan, tier, template_id),
  constraint designer_plan_options_plan_allowed
    check (plan in ('sample', 'logo', 'full_design', 'with_dev')),
  constraint designer_plan_options_tier_allowed check (tier in ('basic', 'premium')),
  constraint designer_plan_options_n_range check (n is null or n between 0 and 999)
);

comment on table public.designer_plan_options is
  '디자이너가 플랜마다 등록한 포함 항목. 템플릿이 그 플랜에서 막히면(targets) 등록돼 있어도 나가지 않는다.';

drop trigger if exists designer_plan_options_touch_updated_at on public.designer_plan_options;
create trigger designer_plan_options_touch_updated_at
  before update on public.designer_plan_options
  for each row execute function public.touch_updated_at();

-- ─────────────────────────────────────────
-- 13. RLS — 모든 표를 켜고 정책은 두지 않는다
-- ─────────────────────────────────────────
-- 남아 있는 정책이 있으면 지운다 — 대시보드에서 실수로 만든 것까지 걷어 낸다.

do $$
declare
  t text;
  p record;
begin
  foreach t in array array[
    'designers', 'designer_works', 'designer_logins', 'site_settings', 'specialties',
    'inquiries', 'designer_applications', 'popups', 'designer_invites', 'email_verifications',
    'review_tokens', 'reviews', 'explore_features', 'plan_copy', 'designer_premium_prices',
    'designer_plan_details', 'option_templates', 'designer_plan_options'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    for p in
      select policyname from pg_policies where schemaname = 'public' and tablename = t
    loop
      execute format('drop policy if exists %I on public.%I', p.policyname, t);
    end loop;
  end loop;
end $$;

-- ─────────────────────────────────────────
-- 14. 스토리지 버킷
-- ─────────────────────────────────────────
-- 쓰기 정책은 두지 않는다 — 업로드는 서버(service_role)만 한다.
--   designer-images        공개 — 프로필·포트폴리오 이미지
--   inquiry-files          비공개 — 메일에는 기한 있는 서명 링크를 넣는다
--   designer-applications  비공개 — 지원서 첨부
--   popup-files            공개 — 팝업 이미지·첨부

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'designer-images',
  'designer-images',
  true,
  10485760,  -- 10MB
  array['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/avif']
)
on conflict (id) do update
  set public = true,
      file_size_limit = 10485760,
      allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public)
values ('inquiry-files', 'inquiry-files', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit)
values ('designer-applications', 'designer-applications', false, 31457280)  -- 30MB
on conflict (id) do update set public = false, file_size_limit = 31457280;

insert into storage.buckets (id, name, public, file_size_limit)
values ('popup-files', 'popup-files', true, 20971520)  -- 20MB
on conflict (id) do update set public = true, file_size_limit = 20971520;

-- ─────────────────────────────────────────
-- 15. 확인용 조회
-- ─────────────────────────────────────────

select '표 수 (18이어야 함)' as 항목, count(*)::text as 상태
  from pg_tables where schemaname = 'public'
union all
select 'RLS 꺼진 표 (0이어야 함)', count(*)::text
  from pg_tables where schemaname = 'public' and not rowsecurity
union all
select '정책 수 (0이어야 안전)', count(*)::text
  from pg_policies where schemaname = 'public'
union all
select '플랜 문구 줄 수 (8이어야 함)', count(*)::text from public.plan_copy
union all
select '버킷 수 (4이어야 함)', count(*)::text
  from storage.buckets
 where id in ('designer-images', 'inquiry-files', 'designer-applications', 'popup-files');
