-- ════════════════════════════════════════════════════════
-- 디자이너별 분야 시작가 — 분야 × 범위 × 단계, 디자이너 한 명에게만
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 Run
-- 여러 번 실행해도 안전합니다 (멱등). 0015_faqs.sql 과는 상관이 없다 — 먼저 돌려도 된다.
-- ════════════════════════════════════════════════════════
--
-- 지금까지 시작가는 두 층이었다.
--   1층  분야 전체      specialty_plan_prices (0011) — 그 분야를 고른 모든 디자이너에게 같은 금액
--   2층  디자이너 한 명  designers.full_design_price · project_price — 분야 구분 없이 한 금액
-- "디자이너 A 의 상세페이지만 더 비싸게" 를 둘 칸이 없었다.
--
-- 이 표가 그 사이에 들어간다 — 같은 분야·범위라도 이 디자이너에게만 다른 금액.
--   specialty_plan_prices 와 같은 모양에 designer_id 만 붙였다.
--   price 가 null 인 줄은 두지 않는다 — 덮지 않겠다는 뜻이면 줄을 지운다.
--
-- 읽는 차례(categoryPrice): 디자이너·분야 → 분야 → 디자이너 기본가
-- 메인 시안(sample)은 늘 디자이너 가격이라 여기에도 없다.

create table if not exists public.designer_specialty_prices (
  designer_id  uuid not null references public.designers (id) on delete cascade,
  specialty_id uuid not null references public.specialties (id) on delete cascade,
  scope        text not null,
  tier         text not null,
  price        integer not null,
  updated_at   timestamptz not null default now(),
  primary key (designer_id, specialty_id, scope, tier)
);

alter table public.designer_specialty_prices
  drop constraint if exists designer_specialty_prices_scope_allowed;
alter table public.designer_specialty_prices
  add constraint designer_specialty_prices_scope_allowed check (scope in ('design', 'design_dev'));

alter table public.designer_specialty_prices
  drop constraint if exists designer_specialty_prices_tier_allowed;
alter table public.designer_specialty_prices
  add constraint designer_specialty_prices_tier_allowed check (tier in ('basic', 'premium'));

-- 본 계약 시작가와 같은 범위로 막는다(isContractPrice)
alter table public.designer_specialty_prices
  drop constraint if exists designer_specialty_prices_price_range;
alter table public.designer_specialty_prices
  add constraint designer_specialty_prices_price_range check (price between 10000 and 100000000);

comment on table public.designer_specialty_prices is
  '디자이너 한 명에게만 적용되는 분야별 시작가. 분야 전체 금액(specialty_plan_prices)보다 우선한다.';
comment on column public.designer_specialty_prices.price is
  '시작가(원). 덮지 않으려면 줄을 지운다 — null 줄은 두지 않는다.';

create index if not exists designer_specialty_prices_designer_idx
  on public.designer_specialty_prices (designer_id);

-- 서버(service_role)만 읽고 쓴다
alter table public.designer_specialty_prices enable row level security;
alter table public.designer_specialty_prices force row level security;

-- 확인용 조회
select '디자이너별 분야 시작가 표' as 항목,
       case when count(*) = 1 then '있음 ✓' else '없음 ✗' end as 상태
  from information_schema.tables
 where table_schema = 'public' and table_name = 'designer_specialty_prices';
