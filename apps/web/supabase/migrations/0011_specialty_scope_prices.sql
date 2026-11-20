-- ════════════════════════════════════════════════════════
-- 분야별 시작가 — 범위(디자인만 / 디자인 + 개발) × 단계(기본 / 프리미엄)
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 Run
-- 여러 번 실행해도 안전합니다 (멱등). 0010_sample_plan_name.sql 다음에 돌린다.
-- ════════════════════════════════════════════════════════
--
-- 지금까지는 범위가 정해진 분야만 시작가(specialties.price_from) 한 칸을 가졌고,
-- '고객이 선택' 분야는 디자이너 가격을 그대로 썼다 — 분야마다 금액을 다르게 둘 수 없었다.
--
-- 한 줄 = 분야 × 범위 × 단계.
--   scope    design(디자인만) · design_dev(디자인 + 개발). 메인화면 먼저 의뢰는 디자이너 가격이라 없다
--   tier     basic · premium. 단계가 늘면(standard·premium·enterprise 처럼) 아래 check 만 넓힌다
--   enabled  그 단계를 이 분야·범위에서 내보내는지. 기본 단계는 늘 true —
--            프리미엄을 디자인 + 개발에만 남기려면 design 의 premium 줄만 false 로 둔다
--   price    시작가(원). 비면 디자이너 가격(디자인 전체·프로젝트 최소가, 프리미엄은 디자이너별 프리미엄 금액)
--
-- 줄이 없으면 enabled = true, price = null 로 본다 — 이 파일을 돌려도 화면은 그대로다.
-- 프리미엄이 실제로 나가려면 지금처럼 설정의 유형별 프리미엄과 디자이너별 프리미엄도 켜져 있어야 한다.
--
-- specialties.price_from 은 옮긴 뒤 코드가 읽지 않는다 — 이 파일을 돌리기 전 DB 에서만 쓴다.

create table if not exists public.specialty_plan_prices (
  specialty_id uuid not null references public.specialties (id) on delete cascade,
  scope        text not null,
  tier         text not null,
  enabled      boolean not null default true,
  price        integer,
  updated_at   timestamptz not null default now(),
  primary key (specialty_id, scope, tier)
);

alter table public.specialty_plan_prices
  drop constraint if exists specialty_plan_prices_scope_allowed;
alter table public.specialty_plan_prices
  add constraint specialty_plan_prices_scope_allowed check (scope in ('design', 'design_dev'));

alter table public.specialty_plan_prices
  drop constraint if exists specialty_plan_prices_tier_allowed;
alter table public.specialty_plan_prices
  add constraint specialty_plan_prices_tier_allowed check (tier in ('basic', 'premium'));

alter table public.specialty_plan_prices
  drop constraint if exists specialty_plan_prices_range;
alter table public.specialty_plan_prices
  add constraint specialty_plan_prices_range check (price is null or price between 10000 and 100000000);

comment on table public.specialty_plan_prices is
  '분야 × 범위(design/design_dev) × 단계(basic/premium)의 노출과 시작가(원). 줄이 없으면 노출, 디자이너 가격.';

drop trigger if exists specialty_plan_prices_touch_updated_at on public.specialty_plan_prices;
create trigger specialty_plan_prices_touch_updated_at
  before update on public.specialty_plan_prices
  for each row execute function public.touch_updated_at();

-- 서버(service_role)만 읽고 쓴다
alter table public.specialty_plan_prices enable row level security;
alter table public.specialty_plan_prices force row level security;

-- 예전 한 칸(price_from)을 그 분야 범위의 기본 단계로 옮긴다 — 이미 있는 줄은 덮지 않는다
insert into public.specialty_plan_prices (specialty_id, scope, tier, price)
select id, scope_mode, 'basic', price_from
  from public.specialties
 where scope_mode in ('design', 'design_dev') and price_from is not null
on conflict (specialty_id, scope, tier) do nothing;

-- 이 파일의 예전 판(specialties.design_price_from · dev_price_from 칸)을 돌린 DB 라면
-- 그 칸에 적어 둔 값도 옮긴다. 칸이 없으면 건너뛴다. 이미 있는 줄은 덮지 않는다
do $$
begin
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'specialties'
                and column_name = 'design_price_from') then
    execute $q$
      insert into public.specialty_plan_prices (specialty_id, scope, tier, price)
      select id, 'design', 'basic', design_price_from
        from public.specialties where design_price_from is not null
      on conflict (specialty_id, scope, tier) do nothing
    $q$;
  end if;
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'specialties'
                and column_name = 'dev_price_from') then
    execute $q$
      insert into public.specialty_plan_prices (specialty_id, scope, tier, price)
      select id, 'design_dev', 'basic', dev_price_from
        from public.specialties where dev_price_from is not null
      on conflict (specialty_id, scope, tier) do nothing
    $q$;
  end if;
end
$$;

-- 확인용 조회
select s.name as 분야, p.scope as 범위, p.tier as 단계, p.enabled as 노출, p.price as 시작가
  from public.specialty_plan_prices p
  join public.specialties s on s.id = p.specialty_id
 order by s.sort_order, s.name, p.scope, p.tier;
