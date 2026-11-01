-- ════════════════════════════════════════════════════════
-- 디자인 전체·프로젝트 의뢰 최소가 — 디자이너마다 어드민이 정한다
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 Run
-- 여러 번 실행해도 안전합니다 (멱등).
-- ════════════════════════════════════════════════════════
--
-- 상세 화면의 플랜 카드와 의뢰 폼의 금액 줄에 "N원~" 으로 나간다.
-- 메인 시안·로고 시작가와 달리 디자이너 본인은 바꾸지 못하고 어드민만 바꾼다.
-- 기본값은 지금까지 모두에게 나가던 금액이다(plans.ts 의 DEFAULT_* 와 같은 값).

-- ─────────────────────────────────────────
-- 1. 컬럼
-- ─────────────────────────────────────────

alter table public.designers
  add column if not exists full_design_price integer not null default 179000;

alter table public.designers
  add column if not exists project_price integer not null default 349000;

comment on column public.designers.full_design_price is
  '디자인 전체 의뢰 최소가(원). 어드민이 디자이너마다 정한다.';

comment on column public.designers.project_price is
  '프로젝트 의뢰 최소가(원). 어드민이 디자이너마다 정한다.';

-- 자유 입력이되 터무니없는 값은 막는다(plans.ts 의 MIN·MAX_CONTRACT_PRICE 와 같은 값)
alter table public.designers
  drop constraint if exists designers_full_design_price_range;

alter table public.designers
  add constraint designers_full_design_price_range
  check (full_design_price between 10000 and 100000000);

alter table public.designers
  drop constraint if exists designers_project_price_range;

alter table public.designers
  add constraint designers_project_price_range
  check (project_price between 10000 and 100000000);

-- ─────────────────────────────────────────
-- 2. 확인용 조회
-- ─────────────────────────────────────────

select '컬럼 designers.full_design_price' as 항목,
       case when count(*) > 0 then '있음 ✓' else '없음 ✗' end as 상태
  from information_schema.columns
 where table_schema = 'public' and table_name = 'designers'
   and column_name = 'full_design_price'

union all
select '컬럼 designers.project_price',
       case when count(*) > 0 then '있음 ✓' else '없음 ✗' end
  from information_schema.columns
 where table_schema = 'public' and table_name = 'designers'
   and column_name = 'project_price'

order by 1;
