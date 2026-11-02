-- ════════════════════════════════════════════════════════
-- 전문 분야별 의뢰 범위 — 디자인만 · 디자인 + 개발 · 고객이 고름
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 Run
-- 여러 번 실행해도 안전합니다 (멱등). 038_plan_visibility.sql 다음에 돌린다.
-- ════════════════════════════════════════════════════════
--
-- choice     — 탐색에서 그 분야를 고르면 제목 옆에 '전체 | 디자인 | 디자인 + 개발'
--              필터가 나온다. 처음 값이라 지금까지와 같다.
-- design     — 디자인만 의뢰. 필터를 보여주지 않는다.
-- design_dev — 디자인 + 개발 묶어서 의뢰. 필터를 보여주지 않는다.
--
-- allow_sample — 이 분야에서 '메인 시안만 먼저 의뢰'를 받을 수 있는지(웹·앱 등).
--                처음엔 꺼 둔다. 디자이너가 받는지(designers.scope_sample)는 따로다.
--
-- 어드민 설정 → 전문 분야에서 바꾼다. 여기서 직접 고쳐도 탐색은 요청마다 새로 읽는다.

alter table public.specialties
  add column if not exists scope_mode text not null default 'choice';

alter table public.specialties
  drop constraint if exists specialties_scope_mode_allowed;

alter table public.specialties
  add constraint specialties_scope_mode_allowed
  check (scope_mode in ('choice', 'design', 'design_dev'));

comment on column public.specialties.scope_mode is
  '의뢰 범위. choice = 탐색에서 디자인/디자인+개발 필터를 보여줌, design = 디자인만, design_dev = 디자인+개발 묶음.';

alter table public.specialties
  add column if not exists allow_sample boolean not null default false;

comment on column public.specialties.allow_sample is
  '이 분야에서 메인 시안만 먼저 의뢰를 받을 수 있는지. 디자이너별 스위치(designers.scope_sample)와 둘 다 켜져야 한다.';

-- 확인용 조회
select name, scope_mode, allow_sample, visible
  from public.specialties
 order by sort_order, name;
