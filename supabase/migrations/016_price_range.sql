-- ════════════════════════════════════════════════════════
-- 가격 — 시작가 보기 확대 · 디자이너별 상한
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 Run
-- 여러 번 실행해도 안전합니다 (멱등).
-- ════════════════════════════════════════════════════════

-- ─────────────────────────────────────────
-- 1. 상한 — 어드민이 디자이너마다 정한다
-- ─────────────────────────────────────────
-- 공개 화면에는 "시작가 ~ 상한" 범위로 나간다.
-- 시작가(design_price)는 디자이너가 보기 중에서 고르고, 상한은 어드민이
-- 직접 적는다 — 금액을 올려 줄 만한 디자이너를 가려내는 일은 사람이 한다.
--
-- 기본 99,000. 실력이 쌓인 디자이너에게는 어드민이 올려 준다.

alter table public.designers
  add column if not exists price_max integer not null default 99000;

comment on column public.designers.price_max is
  '시안 가격 상한(원). 어드민이 디자이너마다 정한다. 공개 화면은 design_price ~ price_max 로 보여준다.';

-- 자유 입력이되 터무니없는 값은 막는다 — 1원이나 9,999,999원이 공개
-- 화면에 박히면 플랫폼 신뢰가 깨진다. 시작가 보기의 최저(29,000)보다
-- 낮을 수 없고, 백만 원을 넘지 않는다.
do $$
begin
  alter table public.designers
    add constraint designers_price_max_range
    check (price_max between 29000 and 1000000);
exception when duplicate_object then null;
end $$;

-- ─────────────────────────────────────────
-- 2. 시작가 보기 확대
-- ─────────────────────────────────────────
-- 59,000 과 99,000 을 더한다. 99,000 은 상한을 99,000 이상으로 올려 둔
-- 디자이너만 고를 수 있지만, 그 판단은 화면과 서버 액션이 한다 —
-- check 제약은 "있을 수 있는 값"만 적어 둔다.
--
-- 둘의 관계(시작가 ≤ 상한)도 여기서 묶는다. 한쪽만 바꿔 범위가 뒤집히면
-- 공개 화면에 "79,000 ~ 49,000원" 같은 글자가 나간다.

alter table public.designers
  drop constraint if exists designers_design_price_allowed;

do $$
begin
  alter table public.designers
    add constraint designers_design_price_allowed
    check (design_price in (29000, 39000, 49000, 59000, 79000, 99000));
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.designers
    add constraint designers_price_order
    check (design_price <= price_max);
exception when duplicate_object then null;
end $$;

-- ─────────────────────────────────────────
-- 3. 확인용 조회
-- ─────────────────────────────────────────

select '컬럼 designers.price_max' as 항목, '있음 ✓' as 상태
  from information_schema.columns
 where table_schema = 'public' and table_name = 'designers'
   and column_name = 'price_max'

union all
select '제약 ' || conname,
       case when count(*) > 0 then '있음 ✓' else '없음 ✗' end
  from pg_constraint
 where conname in (
   'designers_price_max_range',
   'designers_design_price_allowed',
   'designers_price_order'
 )
 group by conname

union all
select '상한을 99,000 초과로 올린 디자이너', count(*)::text
  from public.designers where price_max > 99000

union all
select '범위가 뒤집힌 디자이너 (0이어야 한다)', count(*)::text
  from public.designers where design_price > price_max

order by 1;
