-- ════════════════════════════════════════════════════════
-- 디자이너 지원서 — 이력서 칸을 선택 '기타 자료'로
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 Run
-- 여러 번 실행해도 안전합니다 (멱등).
-- ════════════════════════════════════════════════════════

-- ─────────────────────────────────────────
-- 1. 이력서 → '기타 자료' (선택)
-- ─────────────────────────────────────────
-- 신청 화면(designers/apply)이 바뀌었다 — 포트폴리오만 필수이고, 그 아래
-- '기타' 칸에 이력서·자소서 같은 자료를 파일 또는 URL 로 자유롭게 낸다.
-- 칸은 그대로 쓴다: 파일은 resume, 주소는 새 resume_url.
-- 022 의 intro 는 지우지 않는다 — 그동안 자기소개로 낸 지원서가 남아 있다.

alter table public.designer_applications
  add column if not exists resume_url text;

comment on column public.designer_applications.resume is
  '기타 자료 파일(이력서·자소서 등). 선택 — 예전 지원서에서는 이력서 파일.';
comment on column public.designer_applications.resume_url is
  '기타 자료 주소. 선택 — 파일을 냈으면 비어 있다.';

-- ─────────────────────────────────────────
-- 2. 이력서 필수 제약을 뗀다 — 이제 선택이다
-- ─────────────────────────────────────────

alter table public.designer_applications
  drop constraint if exists designer_applications_resume_or_intro;

-- ─────────────────────────────────────────
-- 3. 확인용 조회
-- ─────────────────────────────────────────

select '컬럼 resume_url' as 항목,
       case when count(*) > 0 then '있음 ✓' else '없음 ✗' end as 상태
  from information_schema.columns
 where table_schema = 'public' and table_name = 'designer_applications'
   and column_name = 'resume_url'

union all
select '이력서 필수 제약 (없어야 한다)',
       case when count(*) = 0 then '없음 ✓' else '남아 있음 ✗' end
  from pg_constraint
 where conname = 'designer_applications_resume_or_intro';
