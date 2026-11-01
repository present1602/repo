-- ════════════════════════════════════════════════════════
-- 디자이너 노출 관리 — 탐색 상단에 크게 올릴 디자이너
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 Run
-- 여러 번 실행해도 안전합니다 (멱등).
-- ════════════════════════════════════════════════════════
--
-- 탐색의 기본 카드는 대표 작업 한 장을 크게 보여주는 모양이다 — 작업을
-- 한두 개만 올린 디자이너가 많아, 썸네일을 한 줄로 늘어놓는 카드는
-- 화면이 비어 보였다.
--
-- 작업이 많은 소수만 어드민이 골라 위쪽에 썸네일 줄 카드(feature1)로 올린다.
-- layout 은 앞으로 다른 모양(feature2 …)이 생길 자리다.

-- ─────────────────────────────────────────
-- 1. 테이블
-- ─────────────────────────────────────────

create table if not exists public.explore_features (
  designer_id uuid primary key references public.designers (id) on delete cascade,
  created_at  timestamptz not null default now(),

  -- 어떤 모양으로 올리는지. 지금은 feature1 하나뿐이다.
  layout      text not null default 'feature1',

  -- 탐색 위쪽에서의 차례. 어드민이 끌어서 바꾼다.
  sort_order  integer not null default 0,

  constraint explore_features_layout check (layout in ('feature1'))
);

comment on table public.explore_features is
  '탐색 상단에 크게 올릴 디자이너. 여기 없는 디자이너는 기본 카드로 아래에 선다.';

create index if not exists explore_features_order_idx
  on public.explore_features (layout, sort_order);

-- ─────────────────────────────────────────
-- 2. 접근 — 서버(service_role)만
-- ─────────────────────────────────────────
-- 다른 테이블과 같은 방침이다. 정책을 만들지 않으므로 anon·authenticated 는
-- 거부되고, 서버의 service_role 키만 이 테이블에 닿는다.

alter table public.explore_features enable row level security;
alter table public.explore_features force  row level security;

do $$
declare p record;
begin
  for p in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'explore_features'
  loop
    execute format('drop policy if exists %I on public.explore_features', p.policyname);
  end loop;
end $$;

-- ─────────────────────────────────────────
-- 3. 확인용 조회
-- ─────────────────────────────────────────

select '테이블 explore_features' as 항목,
       case when count(*) > 0 then '있음 ✓' else '없음 ✗' end as 상태
  from information_schema.tables
 where table_schema = 'public' and table_name = 'explore_features'

union all
select '올려 둔 디자이너', count(*)::text
  from public.explore_features

order by 1;
