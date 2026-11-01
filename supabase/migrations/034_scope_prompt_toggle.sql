-- ════════════════════════════════════════════════════════
-- 탐색의 의뢰유형 묻기 — 어드민이 켜고 끈다
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 Run
-- 여러 번 실행해도 안전합니다 (멱등).
-- ════════════════════════════════════════════════════════
--
-- 탐색에 들어오면 '어떤 의뢰를 원하시나요?' 를 먼저 묻고, 제목 옆에
-- '의뢰유형 : …' 을 띄운다. 끄면 둘 다 나오지 않고 목록을 바로 보여준다.
-- 사이트 전체에 한 번에 적용되므로 site_settings 에 둔다(006_plans.sql).

-- ─────────────────────────────────────────
-- 1. 컬럼
-- ─────────────────────────────────────────
-- 기본은 켜짐 — 지금까지의 동작 그대로다.

alter table public.site_settings
  add column if not exists scope_prompt boolean not null default true;

comment on column public.site_settings.scope_prompt is
  '탐색에서 의뢰유형을 묻는지. 끄면 묻는 창과 제목 옆 의뢰유형 표시가 모두 빠진다.';

-- ─────────────────────────────────────────
-- 2. 확인용 조회
-- ─────────────────────────────────────────

select '컬럼 site_settings.scope_prompt' as 항목,
       case when count(*) > 0 then '있음 ✓' else '없음 ✗' end as 상태
  from information_schema.columns
 where table_schema = 'public' and table_name = 'site_settings'
   and column_name = 'scope_prompt'

union all
select '지금 값', coalesce((select scope_prompt::text from public.site_settings where id), '(행 없음)')

order by 1;
