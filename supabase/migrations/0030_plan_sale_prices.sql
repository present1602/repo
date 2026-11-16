-- 현재 시작가(price)는 판매가로 유지합니다. 원래 가격은 선택 입력입니다.
-- Supabase SQL Editor에서 실행. 여러 번 실행해도 안전합니다.
begin;
alter table public.plan_copy
  add column if not exists price integer,
  add column if not exists original_price integer;
alter table public.specialty_plan_prices
  add column if not exists original_price integer;

alter table public.plan_copy drop constraint if exists plan_copy_sale_price_valid;
alter table public.plan_copy add constraint plan_copy_sale_price_valid
  check (price is null or price between 10000 and 100000000);
alter table public.plan_copy drop constraint if exists plan_copy_original_price_valid;
alter table public.plan_copy add constraint plan_copy_original_price_valid
  check (original_price is null or (price is not null and original_price between 10000 and 100000000 and original_price >= price));
alter table public.specialty_plan_prices drop constraint if exists specialty_plan_prices_original_price_valid;
alter table public.specialty_plan_prices add constraint specialty_plan_prices_original_price_valid
  check (original_price is null or (price is not null and original_price between 10000 and 100000000 and original_price >= price));

comment on column public.plan_copy.price is '의뢰 유형·단계별 공통 판매가. null이면 기존 디자이너 가격 사용. 분야별·디자이너별 분야 판매가가 우선합니다.';
comment on column public.plan_copy.original_price is '할인 전 원래 가격. 판매가보다 클 때만 취소선 표시.';
comment on column public.specialty_plan_prices.original_price is '분야·범위·단계별 판매가의 할인 전 원래 가격. 디자이너별 분야 판매가를 따로 설정하면 적용하지 않습니다.';
commit;
