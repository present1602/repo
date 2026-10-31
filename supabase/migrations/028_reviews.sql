-- ════════════════════════════════════════════════════════
-- 의뢰 후기 — 작성 링크(토큰) · 후기
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 Run
-- 여러 번 실행해도 안전합니다 (멱등).
-- ════════════════════════════════════════════════════════
--
-- 후기는 로그인 없이 쓴다. 의뢰가 끝나면 그 의뢰에만 쓸 수 있는 링크를
-- 만들어 메일·카카오 등으로 보내고, 링크를 연 사람을 그 의뢰의 당사자로 본다.
-- 계정이 아니라 '의뢰'가 신원을 보증하는 구조다.
--
-- 지금은 클라이언트 회원가입이 없지만, 나중에 생겼을 때 이미 쌓인 후기를
-- 그 계정에 그대로 이어 붙일 수 있도록 자리를 비워 두었다(client_id).

-- ─────────────────────────────────────────
-- 1. 후기 상태 enum
-- ─────────────────────────────────────────
--   pending  — 작성됨. 어드민이 아직 보지 않았다. 공개 화면에 뜨지 않는다.
--   approved — 어드민이 승인했다. 이때부터 공개된다.
--   rejected — 어드민이 내렸다. 욕설·분쟁·광고 등.
--
-- 승인 전에는 보이지 않으므로, 작성자에게는 "검토 후 공개됩니다"를
-- 알려 주어야 한다 — 그러지 않으면 자기 글이 사라진 줄 안다.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'review_status') then
    create type public.review_status as enum ('pending', 'approved', 'rejected');
  end if;
end $$;

-- ─────────────────────────────────────────
-- 2. 후기 작성 링크
-- ─────────────────────────────────────────
-- 후기 행과 따로 둔다. 작업이 끝난 시점에는 아직 후기가 없으므로
-- 후기 테이블에 토큰을 둘 수 없다. 재발송("링크 못 받았어요")도
-- 이 테이블만 건드리면 된다.
--
-- 토큰 자체가 열쇠다. 유추할 수 없어야 하므로 uuid 를 쓰고, 주소줄에
-- 그대로 실린다(/review/<token>).

create table if not exists public.review_tokens (
  token        uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),

  -- 어떤 의뢰에 대한 링크인가. 의뢰가 지워지면 링크도 함께 지운다 —
  -- 남겨 두면 어디에도 닿지 않는 죽은 링크가 된다.
  inquiry_id   uuid not null references public.inquiries(id) on delete cascade,

  -- 이 시각이 지나면 쓸 수 없다. 발급할 때 정한다(기본 30일).
  expires_at   timestamptz not null,

  -- 후기를 쓴 시각. 채워져 있으면 다시 쓸 수 없다 —
  -- 한 의뢰에 후기 하나라는 규칙을 링크 쪽에서도 막는다.
  used_at      timestamptz,

  -- 몇 번 보냈는지. 다시 보내 달라는 요청이 잦으면 메일이 스팸함에
  -- 들어가고 있다는 뜻이라, 운영에서 보고 판단할 수 있게 센다.
  sent_count   integer not null default 0,
  last_sent_at timestamptz
);

comment on table  public.review_tokens is '후기 작성용 1회성 링크. 토큰이 곧 열쇠다.';
comment on column public.review_tokens.used_at is '후기를 쓴 시각. 채워지면 그 링크는 끝난다.';
comment on column public.review_tokens.sent_count is '발송 횟수. 재발송이 잦으면 전달 경로를 의심한다.';

-- 한 의뢰에 살아 있는 링크는 하나만 둔다.
-- 여러 번 보내더라도 같은 토큰을 다시 보내야 한다 — 새로 만들면
-- 먼저 받은 링크가 조용히 죽어 "눌렀더니 안 돼요"가 된다.
create unique index if not exists review_tokens_inquiry_uniq
  on public.review_tokens (inquiry_id);

create index if not exists review_tokens_expires_idx
  on public.review_tokens (expires_at);

-- ─────────────────────────────────────────
-- 3. 후기
-- ─────────────────────────────────────────

create table if not exists public.reviews (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  -- 어떤 의뢰에 대한 후기인가. 의뢰 1건당 후기 1개(unique).
  -- 의뢰가 지워지면 후기도 함께 지운다 — 무엇에 대한 후기인지
  -- 알 수 없는 글만 남기느니 지우는 편이 낫다.
  inquiry_id  uuid not null unique
              references public.inquiries(id) on delete cascade,

  -- 누구의 작업에 대한 후기인가.
  -- 외래키를 걸지 않는다 — designer_works·inquiries 와 같은 방침이다.
  -- 디자이너가 지워져도 후기와 평판 기록은 남아야 한다.
  -- 대신 이름을 함께 박아 두어, 계정이 사라져도 누구 얘기인지 남는다.
  designer_id   uuid,
  designer_name text,

  -- ── 작성 시점의 신원 ──
  -- 의뢰에서 복사해 둔다. 의뢰 쪽 값이 나중에 고쳐져도 후기에 쓰인
  -- 이름은 그대로여야 하므로 참조하지 않고 베낀다.
  -- author_email 은 나중에 계정과 잇는 열쇠이기도 하다(아래 client_id).
  author_name  text not null,
  author_email text not null,

  -- ── 본문 ──
  -- 별점 없이 글만 받는다. rating 은 지금 쓰지 않지만, 나중에 켤 때
  -- 마이그레이션 없이 바로 쓰도록 자리만 비워 둔다. null 이면
  -- "별점을 받기 전에 쓰인 후기"로 구분된다(0 과 뜻이 다르다).
  body        text not null,
  rating      smallint,

  -- ── 공개 ──
  status      public.review_status not null default 'pending',
  status_at   timestamptz,
  -- 내릴 때 사유를 적어 둔다. 나중에 같은 작성자가 문의하면 근거가 된다.
  status_memo text,

  -- ── 나중에 클라이언트 회원가입이 생기면 채운다 ──
  -- null 이면 비회원이 쓴 후기다. 가입 시 같은 이메일을 가진 후기를
  -- 찾아 client_id 를 채우면 "내가 쓴 후기"가 계정에 따라붙는다.
  -- clients 테이블이 아직 없으므로 외래키는 그때 추가한다.
  client_id   uuid,
  linked_at   timestamptz,

  -- ── 나중에 포트폴리오와 이을 자리 ──
  -- 디자이너가 작업을 올릴 때 "SOOM에서 수행한 의뢰"(designer_works.soom_work)
  -- 를 켜면, 그 작업이 어떤 의뢰의 결과물인지 고르게 해서 여기에 담을 수 있다.
  -- 그러면 포트폴리오 카드 밑에 그 일을 맡긴 사람의 후기를 붙일 수 있다.
  -- 지금은 채우지 않는다 — 자리만 둔다.
  -- 작업이 지워져도 후기는 남아야 하므로 외래키를 걸지 않는다.
  work_id     uuid,

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

create index if not exists reviews_designer_idx
  on public.reviews (designer_id, status, created_at desc);

create index if not exists reviews_status_idx
  on public.reviews (status, created_at desc);

-- 가입 시 이메일로 찾아 잇는 조회를 위해. 대소문자를 섞어 적는 사람이
-- 있으므로 소문자로 맞춰 건다.
create index if not exists reviews_author_email_idx
  on public.reviews (lower(author_email));

-- 아직 계정에 붙지 않은 후기만 빠르게 찾는다(가입 시 연결 작업).
create index if not exists reviews_unlinked_idx
  on public.reviews (lower(author_email)) where client_id is null;

-- 나중에 포트폴리오와 이었을 때 그 작업의 후기를 찾기 위해.
create index if not exists reviews_work_idx
  on public.reviews (work_id) where work_id is not null;

-- ─────────────────────────────────────────
-- 4. updated_at 자동 갱신
-- ─────────────────────────────────────────
-- 001_designers.sql 에서 만든 touch_updated_at() 을 재사용한다.

drop trigger if exists reviews_touch_updated_at on public.reviews;
create trigger reviews_touch_updated_at
  before update on public.reviews
  for each row execute function public.touch_updated_at();

-- ─────────────────────────────────────────
-- 5. RLS — 전부 차단
-- ─────────────────────────────────────────
-- 다른 테이블과 같은 방침이다. 정책을 만들지 않으므로 anon·authenticated 는
-- 거부되고, 서버의 service_role 키만 닿는다.
--
-- 후기는 공개 화면에 뜨지만 그 조회도 서버를 거친다 — 승인된 것만
-- 골라 내보내야 하고, author_email 은 절대 브라우저로 내려가면 안 된다.

alter table public.reviews       enable row level security;
alter table public.reviews       force  row level security;
alter table public.review_tokens enable row level security;
alter table public.review_tokens force  row level security;

do $$
declare p record;
begin
  for p in
    select schemaname, tablename, policyname from pg_policies
    where schemaname = 'public' and tablename in ('reviews', 'review_tokens')
  loop
    execute format('drop policy if exists %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;

-- ─────────────────────────────────────────
-- 6. 확인용 조회
-- ─────────────────────────────────────────

select '테이블 reviews' as 항목,
       case when to_regclass('public.reviews') is null then '없음 ✗' else '있음 ✓' end as 상태

union all
select '테이블 review_tokens',
       case when to_regclass('public.review_tokens') is null then '없음 ✗' else '있음 ✓' end

union all
select 'reviews RLS',
       case when rowsecurity then '켜짐 ✓' else '꺼짐 ✗' end
  from pg_tables where schemaname = 'public' and tablename = 'reviews'

union all
select 'review_tokens RLS',
       case when rowsecurity then '켜짐 ✓' else '꺼짐 ✗' end
  from pg_tables where schemaname = 'public' and tablename = 'review_tokens'

union all
select '정책 수 (0이어야 안전)',
       count(*)::text
  from pg_policies
 where schemaname = 'public' and tablename in ('reviews', 'review_tokens')

order by 1;
