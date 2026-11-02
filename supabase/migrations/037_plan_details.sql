-- ════════════════════════════════════════════════════════
-- 플랜 상세 — 작업 기간 · 포함 항목
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 Run
-- 여러 번 실행해도 안전합니다 (멱등). 036_plan_copy_premium.sql 다음에 돌린다.
-- ════════════════════════════════════════════════════════
--
-- 디자이너 상세의 의뢰 패널에서 고른 플랜 아래에 나간다:
--   작업 기간 3–5일
--   ✓ 메인 화면 시안 1종   ✓ 수정 1회   ✓ 마음에 들면 본 계약으로 전환
--
-- 작업 기간: 플랜(유형 × 기본·프리미엄)마다 전체 공통값, 어드민이 디자이너마다
--   덮어쓸 수 있다. '작업 기간 노출' 스위치가 켜져야 나간다 — 처음엔 꺼 둔다.
--
-- 포함 항목: 어드민은 문장 템플릿만 만든다('수정 {n}회'). 템플릿마다 어느
--   플랜에서 고를 수 있는지 정한다 — 기본은 모든 플랜. 디자이너(또는 어드민이
--   대신)가 플랜마다 템플릿을 골라 n 까지 넣어 등록해야 나간다.
--   처음 가입한 디자이너는 아무것도 나가지 않는다.
--   어드민은 특정 디자이너만 쓰는 전용 템플릿도 만들 수 있다(designer_id).

-- ─────────────────────────────────────────
-- 1. 작업 기간 — 플랜마다 전체 공통값
-- ─────────────────────────────────────────
-- 글자로 둔다('3–5일', '2주 안팎') — 숫자 범위로 묶으면 표현이 막힌다.

alter table public.plan_copy
  add column if not exists duration text not null default '';

alter table public.plan_copy
  drop constraint if exists plan_copy_duration_len;

alter table public.plan_copy
  add constraint plan_copy_duration_len check (char_length(duration) <= 40);

comment on column public.plan_copy.duration is
  '작업 기간(전체 공통). 비면 나가지 않는다. 디자이너별 값은 designer_plan_details.duration.';

-- ─────────────────────────────────────────
-- 2. 작업 기간 노출 스위치 — 처음엔 꺼 둔다
-- ─────────────────────────────────────────

alter table public.site_settings
  add column if not exists show_duration boolean not null default false;

comment on column public.site_settings.show_duration is
  '작업 기간을 공개 화면에 보여주는지. 꺼져 있으면 넣어 둔 기간이 모두 나가지 않는다.';

-- ─────────────────────────────────────────
-- 3. 디자이너별 작업 기간 — 어드민만 정한다
-- ─────────────────────────────────────────
-- duration 이 null 이면 전체 공통값을 따른다.

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

-- ─────────────────────────────────────────
-- 4. 포함 항목 템플릿 — 어드민이 만든다
-- ─────────────────────────────────────────
-- template 의 {n} 자리에 디자이너가 넣은 숫자가 들어간다. {n} 이 없으면 문장만.
-- targets 는 고를 수 있는 플랜('sample:basic', 'sample:premium' …). null 이면 모든 플랜.
-- designer_id 가 있으면 그 디자이너 전용이다 — 어드민만 만들고, 그 디자이너만 고른다.

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

-- 같은 문장은 공통에서 한 번, 디자이너 전용에서는 디자이너마다 한 번
create unique index if not exists option_templates_template_uniq
  on public.option_templates (template) where designer_id is null;
create unique index if not exists option_templates_designer_template_uniq
  on public.option_templates (designer_id, template) where designer_id is not null;

comment on table public.option_templates is
  '포함 항목 문장 템플릿. {n} 자리에 디자이너가 넣은 숫자. targets 가 null 이면 모든 플랜에서 고를 수 있다. designer_id 가 있으면 그 디자이너 전용.';

drop trigger if exists option_templates_touch_updated_at on public.option_templates;
create trigger option_templates_touch_updated_at
  before update on public.option_templates
  for each row execute function public.touch_updated_at();

-- 처음 템플릿 몇 개 — 고를 거리만 둔다. 디자이너가 등록하기 전에는 어디에도 나가지 않는다.
insert into public.option_templates (template, sort_order) values
  ('메인 화면 시안 {n}종', 0),
  ('수정 {n}회', 1),
  ('마음에 들면 본 계약으로 전환', 2)
on conflict (template) where designer_id is null do nothing;

-- ─────────────────────────────────────────
-- 5. 디자이너가 등록한 포함 항목 — 플랜마다
-- ─────────────────────────────────────────
-- 줄이 있어야 나간다. {n} 템플릿은 n 이 있어야 한다(화면에서 막고, 여기서도 막는다 —
-- 다만 템플릿 문장이 나중에 바뀔 수 있어 DB 에서는 n 범위만 본다).

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
-- 6. RLS — 전부 차단
-- ─────────────────────────────────────────

alter table public.designer_plan_details enable row level security;
alter table public.designer_plan_details force  row level security;
alter table public.option_templates enable row level security;
alter table public.option_templates force  row level security;
alter table public.designer_plan_options enable row level security;
alter table public.designer_plan_options force  row level security;

do $$
declare p record;
begin
  for p in
    select policyname, tablename from pg_policies
     where schemaname = 'public'
       and tablename in ('designer_plan_details', 'option_templates', 'designer_plan_options')
  loop
    execute format('drop policy if exists %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;

-- ─────────────────────────────────────────
-- 7. 확인용 조회
-- ─────────────────────────────────────────

select '컬럼 plan_copy.duration' as 항목,
       case when count(*) > 0 then '있음 ✓' else '없음 ✗' end as 상태
  from information_schema.columns
 where table_schema = 'public' and table_name = 'plan_copy' and column_name = 'duration'

union all
select '컬럼 site_settings.show_duration',
       case when count(*) > 0 then '있음 ✓' else '없음 ✗' end
  from information_schema.columns
 where table_schema = 'public' and table_name = 'site_settings' and column_name = 'show_duration'

union all
select '공통 템플릿 수', count(*)::text
  from public.option_templates where designer_id is null

union all
select '표 designer_plan_options',
       case when to_regclass('public.designer_plan_options') is not null then '있음 ✓' else '없음 ✗' end

union all
select '표 designer_plan_details',
       case when to_regclass('public.designer_plan_details') is not null then '있음 ✓' else '없음 ✗' end

order by 1;
