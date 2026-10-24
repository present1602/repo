-- ════════════════════════════════════════════════════════
-- 작업별 AI 사용 여부 — 올릴 때 본인이 체크한다
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 Run
-- 여러 번 실행해도 안전합니다 (멱등).
-- ════════════════════════════════════════════════════════

-- ─────────────────────────────────────────
-- 1. AI 사용 여부
-- ─────────────────────────────────────────
-- not null default false 로 두지 않는다. 이 값은 본인 신고 사항이라
-- "거짓"과 "아직 답하지 않음"이 다르다 — 하나로 합치면 이미 올라간
-- 작업 전부가 묻지도 않았는데 "AI 미사용"을 주장하게 된다.
--
--   true   — AI 를 썼다고 밝힘
--   false  — 쓰지 않았다고 밝힘
--   null   — 묻기 전에 올라간 작업(또는 답하지 않음)
--
-- 공개 화면은 true 일 때만 표기한다(work-gallery.tsx) — null 과 false 를
-- 구분해 보여주지 않는다. 다만 어드민은 셋을 구분해서 본다.

alter table public.designer_works
  add column if not exists ai_used boolean;

comment on column public.designer_works.ai_used is
  '작업에 AI 를 썼는지 본인이 체크한 값. null 은 묻기 전에 올라간 작업 —
   false(쓰지 않았다고 밝힘)와 섞지 않는다. 공개 화면은 true 만 표기한다.';

-- ─────────────────────────────────────────
-- 2. 확인용 조회
-- ─────────────────────────────────────────

select '컬럼 designer_works.ai_used' as 항목,
       '있음 ✓ (' || data_type || ', nullable: ' || is_nullable || ')' as 상태
  from information_schema.columns
 where table_schema = 'public' and table_name = 'designer_works'
   and column_name = 'ai_used'

union all
select 'AI 썼다고 밝힌 작업 수', count(*)::text
  from public.designer_works where ai_used

union all
select 'AI 안 썼다고 밝힌 작업 수', count(*)::text
  from public.designer_works where ai_used = false

union all
select '아직 답하지 않은 작업 수 (묻기 전에 올라간 것)', count(*)::text
  from public.designer_works where ai_used is null

order by 1;
