-- ════════════════════════════════════════════════════════
-- 포함 항목 — 공통 + 개별, 직접 입력
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 Run
-- 여러 번 실행해도 안전합니다 (멱등). 0004_plan_options_by_category.sql 다음에 돌린다.
-- ════════════════════════════════════════════════════════
--
-- 포함 항목은 이제 방식을 고르지 않고 둘 다 쓴다.
--   공통 항목(bucket = 'common')        모든 의뢰 유형에 먼저 나간다
--   개별 항목(bucket = '<분야 id>:<plan>') 그 의뢰 유형에만, 공통 다음에 나간다
-- designers.plan_options_mode 는 더 읽지 않는다(칸은 남겨 둔다).
--
-- designer_custom_options — 디자이너가 직접 적은 항목. 템플릿과 달리 그 목록(bucket)에만 있다.
-- 같은 목록 안에서는 템플릿 항목 다음, 적은 차례대로 나간다.

create table if not exists public.designer_custom_options (
  id          uuid primary key default gen_random_uuid(),
  designer_id uuid not null references public.designers (id) on delete cascade,
  bucket      text not null,
  text        text not null,
  created_at  timestamptz not null default now(),
  constraint designer_custom_options_bucket_shape check (
    bucket = 'common'
    or bucket ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}:(sample|full_design|with_dev)$'
  ),
  constraint designer_custom_options_text_len check (char_length(trim(text)) between 1 and 80)
);

comment on table public.designer_custom_options is
  '디자이너가 직접 적은 포함 항목. bucket 이 common 이면 모든 의뢰, <분야 id>:<plan> 이면 그 의뢰 유형에만.';

create index if not exists designer_custom_options_designer_idx
  on public.designer_custom_options (designer_id, bucket, created_at);

alter table public.designer_custom_options enable row level security;
alter table public.designer_custom_options force row level security;

comment on column public.designers.plan_options_mode is
  '더 쓰지 않는다(0005). 포함 항목은 공통 + 개별을 함께 쓴다.';

-- 확인용 조회
select '직접 입력 포함 항목 표' as 항목,
       case when count(*) = 1 then '있음 ✓' else '없음 ✗' end as 상태
  from information_schema.tables
 where table_schema = 'public' and table_name = 'designer_custom_options';
