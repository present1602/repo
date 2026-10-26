-- ════════════════════════════════════════════════════════
-- 작업별 'SOOM에서 수행한 의뢰' 여부
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 Run
-- 여러 번 실행해도 안전합니다 (멱등).
-- ════════════════════════════════════════════════════════

-- ─────────────────────────────────────────
-- 1. SOOM 의뢰 여부
-- ─────────────────────────────────────────
-- 디자이너가 올릴 때, 또는 어드민이 대신 올리거나 고칠 때 체크한다.
-- 공개 화면에는 켠 것만 'SOOM 의뢰'로 표기된다.
--
-- ai_used(008)와 달리 '묻지 않음(null)'을 두지 않는다 — 올릴 때 꼭
-- 답하게 하는 항목이 아니라, 해당할 때만 켜는 표시다. 기본은 꺼짐:
-- 지금까지 올라간 작업은 SOOM 이 생기기 전 것들이다.

alter table public.designer_works
  add column if not exists soom_work boolean not null default false;

comment on column public.designer_works.soom_work is
  'SOOM 에서 수행한 의뢰의 결과물인지. 디자이너 본인 또는 어드민이 체크한다.';

-- ─────────────────────────────────────────
-- 2. 확인용 조회
-- ─────────────────────────────────────────

select '컬럼 designer_works.soom_work' as 항목, '있음 ✓' as 상태
  from information_schema.columns
 where table_schema = 'public' and table_name = 'designer_works'
   and column_name = 'soom_work'

union all
select 'SOOM 의뢰로 표시된 작업', count(*)::text
  from public.designer_works where soom_work

order by 1;
