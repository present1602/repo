-- ════════════════════════════════════════════════════════
-- 로고 디자인 — 의뢰 유형과 디자이너가 받을 유형, 로고 시작가
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 Run
-- 여러 번 실행해도 안전합니다 (멱등).
-- ════════════════════════════════════════════════════════

-- ─────────────────────────────────────────
-- 1. 의뢰 폼의 유형 — '로고 디자인'
-- ─────────────────────────────────────────
-- inquiry-types.ts 의 INQUIRY_TYPES 와 글자가 같아야 한다 —
-- 어긋나면 저장이 제약에 걸려 거부된다.

alter table public.inquiries
  drop constraint if exists inquiries_type_allowed;

alter table public.inquiries
  add constraint inquiries_type_allowed
  check (
    inquiry_type is null
    or inquiry_type in ('메인화면 시안 먼저 의뢰', '로고 디자인', '디자인', '프로젝트 의뢰')
  );

comment on column public.inquiries.inquiry_type is
  '의뢰 유형: 메인화면 시안 먼저 의뢰 / 로고 디자인 / 디자인 / 프로젝트 의뢰. 014 이전 문의는 null.';

-- ─────────────────────────────────────────
-- 2. 디자이너가 받을 유형 — 로고 디자인
-- ─────────────────────────────────────────
-- 탐색 화면의 '어떤 의뢰를 원하시나요?' 에서 로고 디자인을 고르면
-- 이 스위치를 켠 디자이너만 남는다. 디자이너 본인이 켜고 끈다.
--
-- 기본은 꺼짐 — 디자인 전체(017)와 같은 방침이다. 로고를 하지 않는
-- 디자이너가 목록에 섞이면 고객이 의뢰했다가 거절당한다.

alter table public.designers
  add column if not exists scope_logo boolean not null default false;

comment on column public.designers.scope_logo is
  '로고 디자인 의뢰를 받는지. 디자이너 본인이 켜고 끈다. 기본 꺼짐.';

-- ─────────────────────────────────────────
-- 3. 로고 시작가
-- ─────────────────────────────────────────
-- 디자이너가 아래 보기 중에서 고른다(plans.ts 의 LOGO_PRICES 와 같은 값).
-- 상한은 모두 99,000원으로 고정이라 컬럼을 두지 않는다 — 디자인 플랜처럼
-- 어드민이 디자이너마다 올려 줄 일이 생기면 그때 만든다.

alter table public.designers
  add column if not exists logo_price integer not null default 19900;

comment on column public.designers.logo_price is
  '로고 디자인 시작가(원). 디자이너가 고른다. 공개 화면은 logo_price ~ 99,000원 으로 보여준다.';

alter table public.designers
  drop constraint if exists designers_logo_price_allowed;

alter table public.designers
  add constraint designers_logo_price_allowed
  check (logo_price in (19900, 29000, 39000, 49000, 59000, 79000, 99000));

-- ─────────────────────────────────────────
-- 4. 확인용 조회
-- ─────────────────────────────────────────

select '제약 inquiries_type_allowed' as 항목,
       case when count(*) > 0 then '있음 ✓' else '없음 ✗' end as 상태
  from pg_constraint where conname = 'inquiries_type_allowed'

union all
select '컬럼 designers.scope_logo', '있음 ✓'
  from information_schema.columns
 where table_schema = 'public' and table_name = 'designers'
   and column_name = 'scope_logo'

union all
select '컬럼 designers.logo_price', '있음 ✓'
  from information_schema.columns
 where table_schema = 'public' and table_name = 'designers'
   and column_name = 'logo_price'

union all
select '로고 디자인 의뢰를 받는 디자이너', count(*)::text
  from public.designers where scope_logo

order by 1;
