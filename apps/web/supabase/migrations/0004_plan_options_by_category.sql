-- ════════════════════════════════════════════════════════
-- 가격 플랜 — 의뢰 받는 분야에 맞춘 의뢰 유형 · 분야별 포함 항목
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 Run
-- 여러 번 실행해도 안전합니다 (멱등). 0003_inquiry_category.sql 다음에 돌린다.
-- ════════════════════════════════════════════════════════
--
-- 1. 의뢰 유형 스위치의 주인이 바뀐다.
--      scope_sample      메인화면 시안 의뢰 — 어드민만 바꾼다(디자이너는 켜진 채 잠김)
--      scope_full_design 디자인 의뢰       — 디자이너가 켠다
--      scope_with_dev    프로젝트 의뢰     — 디자이너가 켠다(전에는 어드민 승인)
--    '고객이 선택' 분야(web/app)를 고르면 디자인·프로젝트 중 하나는 켜져 있어야 한다.
--    지금까지 디자인 의뢰는 늘 받았으므로, 처음 한 번만 그 분야 디자이너의
--    scope_full_design·scope_sample 을 켠다(아래 do 블록 — 다시 돌려도 덮어쓰지 않는다).
--
-- 2. designers.plan_options_mode — 포함 항목을 모든 의뢰에 공통으로 쓸지(common),
--    분야(와 그 안의 범위)마다 따로 쓸지(by_category).
--
-- 3. designer_category_options — 포함 항목의 새 자리.
--      bucket = 'common'                       공통 목록
--             = '<specialties.id>:<plan>'       분야별 목록(plan: sample·full_design·with_dev)
--    기본(basic) 단계의 designer_plan_options 를 공통 목록으로 옮긴다.
--    프리미엄 단계는 지금처럼 designer_plan_options 에 남는다.

do $$
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'designers' and column_name = 'plan_options_mode'
  ) then
    alter table public.designers
      add column plan_options_mode text not null default 'common';

    -- 처음 한 번만 — 디자이너가 이후에 끈 값을 다시 켜지 않게 칸이 생길 때만 돈다
    update public.designers d
       set scope_full_design = true
     where d.scope_full_design = false
       and exists (
         select 1 from public.specialties s
          where s.scope_mode = 'choice' and s.name = any (d.tags)
       );

    update public.designers d
       set scope_sample = true
     where d.scope_sample = false
       and exists (
         select 1 from public.specialties s
          where s.allow_sample and s.name = any (d.tags)
       );
  end if;
end $$;

alter table public.designers
  drop constraint if exists designers_plan_options_mode_allowed;

alter table public.designers
  add constraint designers_plan_options_mode_allowed
  check (plan_options_mode in ('common', 'by_category'));

comment on column public.designers.plan_options_mode is
  '포함 항목 방식. common = 모든 의뢰 공통, by_category = 분야(·범위)마다 따로(designer_category_options).';

comment on column public.designers.scope_sample is
  '메인화면 시안 의뢰를 받는지. 어드민만 바꾼다. 메인 시안 허용 분야(specialties.allow_sample)를 골랐을 때만 나간다.';
comment on column public.designers.scope_full_design is
  '고객이 선택하는 분야(web/app)에서 디자인 의뢰를 받는지. 디자이너가 켠다. 프로젝트 의뢰와 둘 다 끌 수는 없다.';
comment on column public.designers.scope_with_dev is
  '고객이 선택하는 분야(web/app)에서 프로젝트(디자인 + 개발) 의뢰를 받는지. 디자이너가 켠다.';

create table if not exists public.designer_category_options (
  designer_id  uuid not null references public.designers (id) on delete cascade,
  bucket       text not null,
  template_id  uuid not null references public.option_templates (id) on delete cascade,
  n            integer,
  updated_at   timestamptz not null default now(),
  primary key (designer_id, bucket, template_id),
  constraint designer_category_options_bucket_shape check (
    bucket = 'common'
    or bucket ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}:(sample|full_design|with_dev)$'
  ),
  constraint designer_category_options_n_range check (n is null or n between 0 and 999)
);

comment on table public.designer_category_options is
  '디자이너의 포함 항목(기본 단계). bucket 이 common 이면 공통 목록, <분야 id>:<plan> 이면 그 분야·범위 목록.';

alter table public.designer_category_options enable row level security;
alter table public.designer_category_options force row level security;

drop trigger if exists designer_category_options_touch_updated_at on public.designer_category_options;
create trigger designer_category_options_touch_updated_at
  before update on public.designer_category_options
  for each row execute function public.touch_updated_at();

-- 기본 단계 포함 항목을 공통 목록으로 — 여러 플랜에 같은 항목이 있으면
-- 디자인 전체 → 프로젝트 → 메인 시안 차례로 하나만 가져온다
insert into public.designer_category_options (designer_id, bucket, template_id, n)
select distinct on (o.designer_id, o.template_id)
       o.designer_id, 'common', o.template_id, o.n
  from public.designer_plan_options o
 where o.tier = 'basic'
 order by o.designer_id, o.template_id,
          case o.plan when 'full_design' then 0 when 'with_dev' then 1 else 2 end
on conflict do nothing;

-- 확인용 조회
select '포함 항목 방식 칸' as 항목,
       case when count(*) = 1 then '있음 ✓' else '없음 ✗' end as 상태
  from information_schema.columns
 where table_schema = 'public' and table_name = 'designers' and column_name = 'plan_options_mode'
union all
select '분야별 포함 항목 표',
       case when count(*) = 1 then '있음 ✓' else '없음 ✗' end
  from information_schema.tables
 where table_schema = 'public' and table_name = 'designer_category_options';
