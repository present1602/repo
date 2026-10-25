-- ════════════════════════════════════════════════════════
-- 디자이너가 받을 의뢰 유형
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 Run
-- 여러 번 실행해도 안전합니다 (멱등).
-- ════════════════════════════════════════════════════════

-- ─────────────────────────────────────────
-- 1. 받을 유형
-- ─────────────────────────────────────────
-- 의뢰는 세 가지로 들어온다(inquiry-types.ts 의 유형과 같은 갈래다).
-- 디자이너는 자신이 맡을 수 있는 것만 켜 두고, 탐색 화면은 그 체크로 거른다.
--
--   메인 시안   — 모든 디자이너가 받는다. 끄는 스위치를 두지 않는다.
--                 플랫폼이 서 있는 자리라, 아무도 안 받으면 서비스가 빈다.
--   전체 디자인 — 고객이 디자인만 따로 의뢰하는 경우.
--                 디자이너 본인이 켜고 끈다.
--   디자인+개발 — 개발자와 함께 전체를 맡는 경우.
--                 오프라인 미팅·상주 근무 요청이 따를 수 있어 아무나
--                 받을 수 없다 — 어드민이 디자이너를 보고 열어 준다.
--                 본인은 자기 상태를 볼 수만 있다.
--
-- 기본은 둘 다 꺼짐. 들여다보지 않은 계정이 큰 건을 받는 것처럼 보이면
-- 고객이 의뢰했다가 거절당한다 — 받겠다고 켜는 편이 안전하다.

alter table public.designers
  add column if not exists scope_full_design boolean not null default false;

alter table public.designers
  add column if not exists scope_with_dev boolean not null default false;

comment on column public.designers.scope_full_design is
  '디자인 전체 의뢰를 받는지. 메인 시안은 모두가 받으므로 따로 두지 않는다.';
comment on column public.designers.scope_with_dev is
  '디자인 + 개발 의뢰를 받는지. 어드민만 켜고 끈다 — 오프라인 미팅·상주 근무
   요청이 따를 수 있어 디자이너를 보고 열어 준다. 본인은 보기만 한다.';

-- 탐색 화면이 이 두 값으로 거른다 — 공개 디자이너만 훑으므로 함께 묶는다
create index if not exists designers_scope_idx
  on public.designers (scope_full_design, scope_with_dev)
  where visible and profile_public;

-- ─────────────────────────────────────────
-- 2. 확인용 조회
-- ─────────────────────────────────────────

select '컬럼 designers.' || column_name as 항목, '있음 ✓' as 상태
  from information_schema.columns
 where table_schema = 'public' and table_name = 'designers'
   and column_name in ('scope_full_design', 'scope_with_dev')

union all
select '디자인 전체 의뢰를 받는 디자이너', count(*)::text
  from public.designers where scope_full_design

union all
select '디자인 + 개발 의뢰를 받는 디자이너', count(*)::text
  from public.designers where scope_with_dev

order by 1;
