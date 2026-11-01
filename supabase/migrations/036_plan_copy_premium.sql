-- ════════════════════════════════════════════════════════
-- 플랜 문구 · 프리미엄 — 의뢰 유형 넷을 같은 모양으로
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 Run
-- 여러 번 실행해도 안전합니다 (멱등).
-- ════════════════════════════════════════════════════════
--
-- 지금까지 이름·설명을 어드민이 고칠 수 있는 건 메인 시안(site_settings 의
-- design_plan_*)뿐이었고, 로고·디자인 전체·프로젝트는 코드에 박혀 있었다.
-- 넷은 대등한 의뢰 유형이므로 한 표에 같은 모양의 행으로 둔다.
--
-- 유형마다 '기본' 과 '프리미엄' 두 단계가 있다. 프리미엄은 나중을 위해
-- 미리 만들어 두는 것이라 꺼 둔 채로 시작한다. 스위치는 두 겹이다:
--   유형 전체   plan_copy 프리미엄 줄의 enabled — 켜져야 디자이너별로 켤 수 있다
--   디자이너별  designer_premium_prices.enabled + price
-- 공개 화면에는 둘 다 켜지고 금액이 있을 때만 나간다.
--
-- 칸을 늘리지 않고 행으로 두는 이유: 유형이나 단계가 늘 때 행만 넣으면 된다.

-- ─────────────────────────────────────────
-- 1. 플랜 문구 — 유형 × 단계마다 한 줄
-- ─────────────────────────────────────────
-- plan 은 scopes.ts 의 SCOPES 와 같은 값이다.

create table if not exists public.plan_copy (
  plan        text not null,
  tier        text not null,
  updated_at  timestamptz not null default now(),
  name        text not null,
  description text not null default '',
  -- 프리미엄 줄에서만 뜻이 있다 — 이 유형의 프리미엄을 쓰는지. 기본 줄은 늘 쓴다.
  enabled     boolean not null default false,

  primary key (plan, tier),
  constraint plan_copy_plan_allowed check (plan in ('sample', 'logo', 'full_design', 'with_dev')),
  constraint plan_copy_tier_allowed check (tier in ('basic', 'premium')),
  constraint plan_copy_name_len check (char_length(name) between 1 and 40),
  constraint plan_copy_desc_len check (char_length(description) <= 500)
);

-- 표를 먼저 만든 DB(이 파일의 이전 판)에도 칸을 더한다
alter table public.plan_copy
  add column if not exists enabled boolean not null default false;

comment on table public.plan_copy is
  '의뢰 유형(plan)·단계(basic/premium)별 이름과 설명. 모든 디자이너가 함께 쓴다.';

comment on column public.plan_copy.enabled is
  '프리미엄 줄: 이 유형의 프리미엄을 쓰는지(꺼져 있으면 디자이너별로도 켤 수 없다). 기본 줄: 쓰지 않는다.';

drop trigger if exists plan_copy_touch_updated_at on public.plan_copy;
create trigger plan_copy_touch_updated_at
  before update on public.plan_copy
  for each row execute function public.touch_updated_at();

-- 처음 값 — 이미 있으면 건드리지 않는다(다시 실행해도 어드민이 고친 문구가 남는다).
-- 메인 시안의 기본은 지금까지 쓰던 site_settings 의 문구를 옮겨 온다.
-- 옛 '프리미엄 플랜'(premium_plan_*)은 유형에 매이지 않은 임시 문구라 옮기지 않는다.
insert into public.plan_copy (plan, tier, name, description)
select 'sample', 'basic', left(design_plan_name, 40), design_plan_desc
  from public.site_settings where id
on conflict (plan, tier) do nothing;

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

-- ─────────────────────────────────────────
-- 2. 디자이너별 프리미엄 금액 — 어드민만 정한다
-- ─────────────────────────────────────────
-- 줄이 있으면 그 유형에 프리미엄이 있는 것이다. 지우면 없앤 것.
-- 기본 금액은 designers 의 칸(design_price·logo_price·full_design_price·
-- project_price)을 그대로 쓴다.

create table if not exists public.designer_premium_prices (
  designer_id uuid not null references public.designers (id) on delete cascade,
  plan        text not null,
  price       integer not null,
  updated_at  timestamptz not null default now(),

  primary key (designer_id, plan),
  constraint designer_premium_prices_plan_allowed
    check (plan in ('sample', 'logo', 'full_design', 'with_dev')),
  -- plans.ts 의 MIN·MAX_CONTRACT_PRICE 와 같은 범위
  constraint designer_premium_prices_range check (price between 10000 and 100000000)
);

-- 디자이너별 스위치 — 꺼도 금액은 남겨 둔다(다시 켤 때 다시 적지 않게)
alter table public.designer_premium_prices
  add column if not exists enabled boolean not null default true;

comment on table public.designer_premium_prices is
  '디자이너·유형별 프리미엄 스위치와 금액(원). 어드민만 정한다. 유형 전체 스위치(plan_copy.enabled)가 켜져야 나간다.';

drop trigger if exists designer_premium_prices_touch_updated_at on public.designer_premium_prices;
create trigger designer_premium_prices_touch_updated_at
  before update on public.designer_premium_prices
  for each row execute function public.touch_updated_at();

-- ─────────────────────────────────────────
-- 3. 문의에 고른 단계 — 기본 / 프리미엄
-- ─────────────────────────────────────────
-- 프리미엄이 있는 유형을 고른 문의만 값이 있다. 그 밖에는 null(= 기본).

alter table public.inquiries
  add column if not exists plan_tier text;

alter table public.inquiries
  drop constraint if exists inquiries_plan_tier_allowed;

alter table public.inquiries
  add constraint inquiries_plan_tier_allowed
  check (plan_tier is null or plan_tier in ('basic', 'premium'));

comment on column public.inquiries.plan_tier is
  '고객이 고른 단계: basic / premium. 프리미엄을 고를 수 없던 문의는 null.';

-- ─────────────────────────────────────────
-- 4. RLS — 전부 차단
-- ─────────────────────────────────────────
-- 다른 테이블과 같은 방침이다. 공개 화면도 서버에서 읽어 내려보낸다.

alter table public.plan_copy enable row level security;
alter table public.plan_copy force  row level security;
alter table public.designer_premium_prices enable row level security;
alter table public.designer_premium_prices force  row level security;

do $$
declare p record;
begin
  for p in
    select policyname, tablename from pg_policies
     where schemaname = 'public'
       and tablename in ('plan_copy', 'designer_premium_prices')
  loop
    execute format('drop policy if exists %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;

-- ─────────────────────────────────────────
-- 5. 확인용 조회
-- ─────────────────────────────────────────

select '표 plan_copy 행 수 (8이어야 한다)' as 항목, count(*)::text as 상태
  from public.plan_copy

union all
select '표 designer_premium_prices',
       case when to_regclass('public.designer_premium_prices') is not null then '있음 ✓' else '없음 ✗' end

union all
select '켜진 유형별 프리미엄 (처음엔 0)', count(*)::text
  from public.plan_copy where tier = 'premium' and enabled

union all
select '컬럼 designer_premium_prices.enabled',
       case when count(*) > 0 then '있음 ✓' else '없음 ✗' end
  from information_schema.columns
 where table_schema = 'public' and table_name = 'designer_premium_prices'
   and column_name = 'enabled'

union all
select '컬럼 inquiries.plan_tier',
       case when count(*) > 0 then '있음 ✓' else '없음 ✗' end
  from information_schema.columns
 where table_schema = 'public' and table_name = 'inquiries'
   and column_name = 'plan_tier'

order by 1;
