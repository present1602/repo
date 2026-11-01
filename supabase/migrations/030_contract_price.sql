-- ════════════════════════════════════════════════════════
-- 본 계약 시작가 — 디자이너마다 어드민이 정한다
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 Run
-- 여러 번 실행해도 안전합니다 (멱등).
-- ════════════════════════════════════════════════════════
--
-- 상세 화면의 디자인 플랜 카드에 "본 계약 의뢰는 전부 189,000원~" 으로 나간다.
-- 지금은 모두 같은 금액이지만, 디자이너마다 다르게 둘 수 있게 칸을 둔다.
-- 디자이너 본인은 바꾸지 못하고 어드민만 바꾼다.

-- ─────────────────────────────────────────
-- 1. 컬럼
-- ─────────────────────────────────────────

alter table public.designers
  add column if not exists contract_price integer not null default 189000;

comment on column public.designers.contract_price is
  '본 계약 시작가(원). 어드민이 디자이너마다 정한다. 상세 화면에 "본 계약 의뢰는 전부 N원~" 으로 나간다.';

-- 자유 입력이되 터무니없는 값은 막는다(plans.ts 의 MIN·MAX_CONTRACT_PRICE 와 같은 값)
do $$
begin
  alter table public.designers
    add constraint designers_contract_price_range
    check (contract_price between 10000 and 100000000);
exception when duplicate_object then null;
end $$;

-- ─────────────────────────────────────────
-- 2. 확인용 조회
-- ─────────────────────────────────────────

select '컬럼 designers.contract_price' as 항목,
       case when count(*) > 0 then '있음 ✓' else '없음 ✗' end as 상태
  from information_schema.columns
 where table_schema = 'public' and table_name = 'designers'
   and column_name = 'contract_price'

union all
select '제약 designers_contract_price_range',
       case when count(*) > 0 then '있음 ✓' else '없음 ✗' end
  from pg_constraint
 where conname = 'designers_contract_price_range'

order by 1;
