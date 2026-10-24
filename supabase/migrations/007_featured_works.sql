-- ════════════════════════════════════════════════════════
-- 메인 화면 노출 — 어드민이 고르는 작업
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 Run
-- 여러 번 실행해도 안전합니다 (멱등).
-- ════════════════════════════════════════════════════════

-- ─────────────────────────────────────────
-- 1. 노출 플래그
-- ─────────────────────────────────────────
-- visible 과 섞지 않는다. 둘은 주인이 다르다:
--   visible  — 디자이너 본인이 자기 포트폴리오에서 켜고 끈다
--   featured — 어드민이 메인 화면에 걸지 말지 정한다
-- 한 컬럼으로 합치면 디자이너가 작업을 숨겼다 켤 때 메인 노출까지
-- 따라 바뀌어, 어드민이 고른 구성이 조용히 무너진다.

alter table public.designer_works
  add column if not exists featured boolean not null default false;

comment on column public.designer_works.featured is
  '어드민이 메인 화면에 노출하려고 고른 작업. 디자이너의 visible 과 별개다 —
   메인에 뜨려면 둘 다 참이어야 한다.';

-- 어드민이 고른 순서를 기억한다. 메인은 이 순서로 먼저 깔고,
-- 고른 게 모자라면 최신순으로 채운다(public-designers.ts).
alter table public.designer_works
  add column if not exists featured_at timestamptz;

comment on column public.designer_works.featured_at is
  '메인 노출로 고른 시각. featured 가 거짓이면 의미 없다.';

-- 메인 피드는 "featured 이고 visible 인 것"만 훑는다.
-- 부분 인덱스라 고르지 않은 작업(대다수)은 인덱스에 들어가지 않는다.
create index if not exists designer_works_featured_idx
  on public.designer_works (featured_at desc)
  where featured;

-- ─────────────────────────────────────────
-- 2. 확인용 조회
-- ─────────────────────────────────────────

select '컬럼 designer_works.' || column_name as 항목, '있음 ✓' as 상태
  from information_schema.columns
 where table_schema = 'public' and table_name = 'designer_works'
   and column_name in ('featured', 'featured_at')

union all
select '메인 노출로 고른 작업 수', count(*)::text
  from public.designer_works
 where featured

union all
select '그중 실제 메인에 뜨는 수 (디자이너도 공개한 것)', count(*)::text
  from public.designer_works w
  join public.designers d on d.id = w.designer_id
 where w.featured and w.visible and d.visible and d.profile_public

order by 1;
