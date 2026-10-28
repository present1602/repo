-- ════════════════════════════════════════════════════════
-- 초대코드 — 어드민이 직접 정하는 코드 허용
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 Run
-- 여러 번 실행해도 안전합니다 (멱등).
-- ════════════════════════════════════════════════════════

-- ─────────────────────────────────────────
-- 1. 코드 형식 — 8자리 고정 → 영문 대문자·숫자·언더바 4~15자
-- ─────────────────────────────────────────
-- 자동 발행은 지금처럼 8자리다. 어드민이 직접 적으면(예: SOOM_2026FALL)
-- 그 값을 그대로 쓴다. 이미 발행된 8자리 코드는 새 제약에도 맞는다.

alter table public.designer_invites
  drop constraint if exists designer_invites_code_fmt;

alter table public.designer_invites
  add constraint designer_invites_code_fmt check (code ~ '^[A-Z0-9_]{4,15}$');

-- ─────────────────────────────────────────
-- 2. 확인용 조회
-- ─────────────────────────────────────────

select '코드 형식 제약' as 항목, pg_get_constraintdef(oid) as 상태
  from pg_constraint
 where conname = 'designer_invites_code_fmt';
