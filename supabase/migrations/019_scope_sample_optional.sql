-- ════════════════════════════════════════════════════════
-- 메인 시안 의뢰도 디자이너가 끌 수 있게
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 Run
-- 여러 번 실행해도 안전합니다 (멱등).
-- ════════════════════════════════════════════════════════

-- ─────────────────────────────────────────
-- 1. 받을 유형 — 메인 시안
-- ─────────────────────────────────────────
-- 017 에서는 메인 시안을 모두가 받는 것으로 두고 컬럼을 만들지 않았다.
-- 소액 의뢰는 받지 않고 본계약 건(전체 디자인 · 디자인+개발)만 받으려는
-- 디자이너가 있어 스위치를 둔다.
--
-- 기본은 켜짐 — 지금까지 모든 디자이너가 받아 왔으므로, 컬럼이 생기는
-- 순간 누군가 탐색 화면에서 빠지면 안 된다. 끄는 것은 본인이 한다.
--
-- 셋 다 꺼도 된다 — 탐색 목록에서는 빠지고 프로필 링크로만 열린다.
-- 링크를 직접 건네 의뢰받는 디자이너가 쓴다.

alter table public.designers
  add column if not exists scope_sample boolean not null default true;

comment on column public.designers.scope_sample is
  '메인 시안 의뢰를 받는지. 디자이너 본인이 켜고 끈다. 기본 켜짐.';

-- ─────────────────────────────────────────
-- 2. 확인용 조회
-- ─────────────────────────────────────────

select '컬럼 designers.scope_sample' as 항목, '있음 ✓' as 상태
  from information_schema.columns
 where table_schema = 'public' and table_name = 'designers'
   and column_name = 'scope_sample'

union all
select '메인 시안 의뢰를 받지 않는 디자이너', count(*)::text
  from public.designers where not scope_sample

order by 1;
