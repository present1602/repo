-- ════════════════════════════════════════════════════════
-- 의뢰 폼 — 분야 → 범위 흐름
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 Run
-- 여러 번 실행해도 안전합니다 (멱등). 0002_specialty_description.sql 다음에 돌린다.
-- ════════════════════════════════════════════════════════
--
-- 의뢰 폼은 분야(specialties)를 먼저 고르고, 그 분야가 허용하는 범위
-- (메인 시안 먼저 / 디자인만 / 디자인 + 개발) 중 하나를 고른다.
--
-- 1. inquiries.category — 고른 분야 이름(그때의 글자 그대로).
--    범위는 지금처럼 inquiry_type 에 담는다:
--      메인 시안 먼저 → '메인화면 시안 먼저 의뢰', 디자인만 → '디자인',
--      디자인 + 개발 → '프로젝트 의뢰'
--    그래서 inquiry_type 의 check 제약은 그대로 둔다. 이전 문의는 category 가 비어 있다.
--
-- 2. specialties.price_from — 범위가 정해진 분야(랜딩·로고처럼)의 시작가(원).
--    비면 디자이너의 범위 가격(디자인 의뢰가·프로젝트 의뢰가)을 보여준다.

alter table public.inquiries
  add column if not exists category text;

alter table public.inquiries
  drop constraint if exists inquiries_category_len;

alter table public.inquiries
  add constraint inquiries_category_len check (category is null or char_length(category) <= 40);

comment on column public.inquiries.category is
  '고른 분야 이름(접수 당시 글자). 범위는 inquiry_type. 0003 이전 문의는 null.';

alter table public.specialties
  add column if not exists price_from integer;

alter table public.specialties
  drop constraint if exists specialties_price_from_range;

alter table public.specialties
  add constraint specialties_price_from_range
  check (price_from is null or price_from between 10000 and 100000000);

comment on column public.specialties.price_from is
  '범위가 정해진 분야(디자인만·디자인+개발)의 시작가(원). 비면 디자이너의 범위 가격을 쓴다.';

-- 확인용 조회
select '문의 분야 칸' as 항목,
       case when count(*) = 1 then '있음 ✓' else '없음 ✗' end as 상태
  from information_schema.columns
 where table_schema = 'public' and table_name = 'inquiries' and column_name = 'category'
union all
select '분야 시작가 칸',
       case when count(*) = 1 then '있음 ✓' else '없음 ✗' end
  from information_schema.columns
 where table_schema = 'public' and table_name = 'specialties' and column_name = 'price_from';
