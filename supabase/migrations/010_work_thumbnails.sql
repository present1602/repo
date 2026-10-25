-- ════════════════════════════════════════════════════════
-- 썸네일 — 목록에서 쓰는 작은 이미지
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 Run
-- 여러 번 실행해도 안전합니다 (멱등).
-- ════════════════════════════════════════════════════════

-- ─────────────────────────────────────────
-- 1. 썸네일 주소
-- ─────────────────────────────────────────
-- 목록·피드는 한 화면에 수십 장이 깔린다. 원본을 그대로 쓰면 보이지도
-- 않을 크기에 원본 전체가 전송된다 — 작게 만들어 둔 파일을 따로 가리킨다.
--
-- 상세 모달은 그대로 image_url(원본)을 쓴다. 크게 띄우는 자리라
-- 줄여 둔 파일로는 화질이 모자란다.
--
-- 썸네일이 없는 작업을 남기지 않는다. 있으면 화면마다 "없으면 원본"
-- 이라는 분기가 따라다니고, 그 분기는 영영 지워지지 않는다.
-- 기존 작업은 이 마이그레이션과 함께 일괄 생성한다.

alter table public.designer_works
  add column if not exists thumb_url text;

comment on column public.designer_works.thumb_url is
  '목록·피드에서 쓰는 작은 이미지. 상세 모달은 image_url(원본)을 쓴다.
   crop_* 영역이 있으면 그 영역만 잘라 만든다.';

-- ─────────────────────────────────────────
-- 2. 확인용 조회
-- ─────────────────────────────────────────

select '컬럼 designer_works.thumb_url' as 항목, '있음 ✓' as 상태
  from information_schema.columns
 where table_schema = 'public' and table_name = 'designer_works'
   and column_name = 'thumb_url'

union all
select '썸네일이 있는 작업 수', count(*)::text
  from public.designer_works where thumb_url is not null

union all
select '썸네일이 없는 작업 수 (0이어야 한다)', count(*)::text
  from public.designer_works where thumb_url is null

order by 1;
