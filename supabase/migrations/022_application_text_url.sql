-- ════════════════════════════════════════════════════════
-- 디자이너 지원서 — 짧은 자기소개 · 포트폴리오 URL
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 Run
-- 021 다음에 실행. 여러 번 실행해도 안전합니다 (멱등).
-- ════════════════════════════════════════════════════════

-- ─────────────────────────────────────────
-- 1. 파일 대신 받을 수 있는 것
-- ─────────────────────────────────────────
-- 디자이너 신청 화면(designers/apply)에서는 둘 중 하나를 고른다 —
--   이력서 파일   또는  짧은 자기소개(500자)
--   포트폴리오 파일 또는 포트폴리오 URL
-- 그래서 파일 칸(resume·portfolio)이 빌 수 있게 풀고, 대신 각 쌍에서
-- 하나는 반드시 있도록 제약을 건다.

alter table public.designer_applications
  add column if not exists intro text,
  add column if not exists portfolio_url text;

alter table public.designer_applications
  alter column resume drop not null,
  alter column portfolio drop not null;

alter table public.designer_applications
  drop constraint if exists designer_applications_resume_or_intro,
  drop constraint if exists designer_applications_portfolio_or_url,
  drop constraint if exists designer_applications_intro_len;

alter table public.designer_applications
  add constraint designer_applications_resume_or_intro
    check (resume is not null or nullif(trim(intro), '') is not null),
  add constraint designer_applications_portfolio_or_url
    check (portfolio is not null or nullif(trim(portfolio_url), '') is not null),
  add constraint designer_applications_intro_len
    check (intro is null or char_length(intro) <= 500);

comment on column public.designer_applications.intro is
  '이력서 대신 적은 짧은 자기소개(500자 이내). 이력서 파일이 있으면 비어 있다.';
comment on column public.designer_applications.portfolio_url is
  '포트폴리오 파일 대신 적은 주소. 파일이 있으면 비어 있다.';

-- ─────────────────────────────────────────
-- 2. 확인용 조회
-- ─────────────────────────────────────────

select '컬럼 ' || column_name as 항목, '있음 ✓' as 상태
  from information_schema.columns
 where table_schema = 'public' and table_name = 'designer_applications'
   and column_name in ('intro', 'portfolio_url')

union all
select '제약 ' || conname, '있음 ✓'
  from pg_constraint
 where conname in ('designer_applications_resume_or_intro', 'designer_applications_portfolio_or_url')

order by 1;
