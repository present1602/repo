-- ════════════════════════════════════════════════════════
-- 포함 항목 — STANDARD · PREMIUM 이 같은 항목 목록을 나눠 쓴다
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 Run
-- 여러 번 실행해도 안전합니다 (멱등). 0016_designer_specialty_prices.sql 다음에 돌린다.
-- ════════════════════════════════════════════════════════
--
-- 지금까지 프리미엄 포함 항목은 기본(STANDARD)과 따로 놀았다.
--   기본      designer_category_options — 공통·분야(·범위)별 목록(0004)
--   프리미엄  designer_plan_options     — 플랜(유형)마다 한 목록, 분야 구분 없음
-- 같은 항목이 두 곳에 따로 있어 "STANDARD 2회 / PREMIUM 5회" 같은 비교표를 만들 수 없었다.
--
-- 이제 한 목록(공통 또는 분야·범위 하나)의 항목을 두 단계가 함께 쓰고,
-- 단계마다 체크 여부와 숫자(n)만 다르다.
--   템플릿 항목  기본 = designer_category_options(그대로), 프리미엄 = designer_premium_options(새 표)
--                두 표는 같은 모양이다 — 한 줄이 그 단계에 체크된 항목이고 n 은 그 단계의 숫자.
--   직접 입력    designer_custom_options 에 단계별 체크 칸(in_basic·in_premium)을 붙인다.
--
-- 기본 표에 tier 칸을 붙이지 않고 표를 따로 두는 이유 — 지금 돌고 있는 코드가 이 SQL 뒤에도
-- 그대로 돈다. 예전 코드는 designer_category_options 를 목록째 지우고 다시 넣으므로, 같은 표에
-- 프리미엄 줄이 섞이면 지워지거나 기본 항목으로 보인다. 새 표·새 칸은 예전 코드가 읽지 않는다.
--
-- 예전 프리미엄 항목(designer_plan_options 의 premium 줄)은 그 디자이너가 고른 분야 중
-- 그 플랜을 받는 분야의 목록으로 옮겨 적는다(아래 do 블록 — 표를 처음 만들 때 한 번만).
-- designer_plan_options 는 지우지 않는다 — 예전 코드가 계속 읽는다.

-- 표는 처음 한 번만 만들고, 그때만 예전 프리미엄 항목을 옮겨 적는다 —
-- 다시 돌려도 디자이너가 새 화면에서 지운 항목이 되살아나지 않게.
-- 예전 프리미엄 항목을 분야 목록으로 — 플랜을 받는 분야마다 한 벌씩.
--   full_design(디자인)  고객이 선택(choice)·디자인만(design) 분야
--   with_dev(프로젝트)    고객이 선택(choice)·디자인 + 개발(design_dev) 분야
--   sample(메인 시안)     메인 시안을 받는 분야(allow_sample)
-- 공통 항목(기본 단계)에 있는 템플릿은 개별 목록에 두지 않는다(0004 와 같은 방침) —
-- 그 경우는 공통 목록의 프리미엄으로 옮긴다.
do $$
begin
  if to_regclass('public.designer_premium_options') is null then
    create table public.designer_premium_options (
      designer_id  uuid not null references public.designers (id) on delete cascade,
      bucket       text not null,
      template_id  uuid not null references public.option_templates (id) on delete cascade,
      n            integer,
      updated_at   timestamptz not null default now(),
      primary key (designer_id, bucket, template_id)
    );

    insert into public.designer_premium_options (designer_id, bucket, template_id, n)
    select o.designer_id, s.id::text || ':' || o.plan, o.template_id, o.n
      from public.designer_plan_options o
      join public.designers d on d.id = o.designer_id
      join public.specialties s on s.name = any (d.tags)
     where o.tier = 'premium'
       and (
            (o.plan = 'full_design' and s.scope_mode in ('choice', 'design'))
         or (o.plan = 'with_dev' and s.scope_mode in ('choice', 'design_dev'))
         or (o.plan = 'sample' and s.allow_sample)
       )
       and not exists (
         select 1 from public.designer_category_options c
          where c.designer_id = o.designer_id and c.bucket = 'common' and c.template_id = o.template_id
       )
    on conflict do nothing;

    insert into public.designer_premium_options (designer_id, bucket, template_id, n)
    select distinct on (o.designer_id, o.template_id)
           o.designer_id, 'common', o.template_id, o.n
      from public.designer_plan_options o
     where o.tier = 'premium'
       and exists (
         select 1 from public.designer_category_options c
          where c.designer_id = o.designer_id and c.bucket = 'common' and c.template_id = o.template_id
       )
     order by o.designer_id, o.template_id,
              case o.plan when 'full_design' then 0 when 'with_dev' then 1 else 2 end
    on conflict do nothing;
  end if;
end $$;

-- '<분야 id>' 모양은 0018 에서 쓴다 — 0018 뒤에 이 파일을 다시 돌려도 막히지 않게 미리 받는다
alter table public.designer_premium_options
  drop constraint if exists designer_premium_options_bucket_shape;
alter table public.designer_premium_options
  add constraint designer_premium_options_bucket_shape check (
    bucket = 'common'
    or bucket ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(:(sample|full_design|with_dev))?$'
  );

alter table public.designer_premium_options
  drop constraint if exists designer_premium_options_n_range;
alter table public.designer_premium_options
  add constraint designer_premium_options_n_range check (n is null or n between 0 and 999);

comment on table public.designer_premium_options is
  '디자이너의 포함 항목(프리미엄 단계). 모양은 designer_category_options(기본 단계)와 같다 — 같은 목록의 같은 항목을 단계마다 체크·숫자만 달리 둔다.';

-- 서버(service_role)만 읽고 쓴다
alter table public.designer_premium_options enable row level security;
alter table public.designer_premium_options force row level security;

drop trigger if exists designer_premium_options_touch_updated_at on public.designer_premium_options;
create trigger designer_premium_options_touch_updated_at
  before update on public.designer_premium_options
  for each row execute function public.touch_updated_at();

-- 직접 입력 — 단계마다 넣을지. 지금 있는 항목은 기본에만 들어가 있던 그대로다
alter table public.designer_custom_options
  add column if not exists in_basic boolean not null default true;
alter table public.designer_custom_options
  add column if not exists in_premium boolean not null default false;

comment on column public.designer_custom_options.in_basic is
  'STANDARD(기본 단계)에 이 항목이 들어가는지.';
comment on column public.designer_custom_options.in_premium is
  'PREMIUM 단계에 이 항목이 들어가는지.';

-- 확인용 조회
select '프리미엄 포함 항목 표' as 항목,
       case when count(*) = 1 then '있음 ✓' else '없음 ✗' end as 상태
  from information_schema.tables
 where table_schema = 'public' and table_name = 'designer_premium_options'
union all
select '직접 입력 단계 칸',
       case when count(*) = 2 then '있음 ✓' else '없음 ✗' end
  from information_schema.columns
 where table_schema = 'public' and table_name = 'designer_custom_options'
   and column_name in ('in_basic', 'in_premium')
union all
select '옮겨 온 프리미엄 항목 ' || count(*) || '줄', '✓'
  from public.designer_premium_options;
