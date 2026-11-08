-- ════════════════════════════════════════════════════════
-- 범위별 메인화면 먼저 의뢰 옵션 — 디자인만 / 디자인 + 개발 따로 켜고 끈다
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 Run
-- 여러 번 실행해도 안전합니다 (멱등). 0012_design_plan_name.sql 다음에 돌린다.
-- ════════════════════════════════════════════════════════
--
-- 메인화면 먼저 의뢰는 본계약 줄(디자인만·디자인 + 개발) 안의 옵션이다. 지금까지는 분야 단위
-- (specialties.allow_sample)로만 켜고 꺼서, 디자인만 의뢰에서만 빼는 일은 할 수 없었다.
--
-- specialty_plan_prices 의 기본 단계(tier = 'basic') 줄에 칸을 둔다 —
--   allow_sample  이 분야·범위에서 메인화면 먼저 의뢰 옵션을 붙일지. 기본 true(지금과 같다)
-- 분야의 메인시안 우선 허용(specialties.allow_sample)이 꺼져 있으면 이 칸과 상관없이 나가지 않는다.
-- 프리미엄 줄에서는 쓰지 않는다.

alter table public.specialty_plan_prices
  add column if not exists allow_sample boolean not null default true;

comment on column public.specialty_plan_prices.allow_sample is
  '기본 단계 줄에서만 — 이 분야·범위에 메인화면 먼저 의뢰 옵션을 붙일지. 분야의 allow_sample 이 꺼지면 무시.';

-- 확인용 조회
select s.name as 분야, p.scope as 범위, p.allow_sample as 메인먼저
  from public.specialty_plan_prices p
  join public.specialties s on s.id = p.specialty_id
 where p.tier = 'basic'
 order by s.sort_order, s.name, p.scope;
