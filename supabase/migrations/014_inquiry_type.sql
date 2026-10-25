-- ════════════════════════════════════════════════════════
-- 의뢰 문의 — 의뢰 유형 추가
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 Run
-- 여러 번 실행해도 안전합니다 (멱등).
-- ════════════════════════════════════════════════════════

-- ─────────────────────────────────────────
-- 1. 의뢰 유형
-- ─────────────────────────────────────────
-- 무엇을 맡기려는지에 따라 답변도 견적도 달라진다 —
-- 어드민이 목록에서 바로 가려볼 수 있게 컬럼으로 둔다.
--
-- 화면의 라디오 값(inquiry-modal.tsx)과 같은 글자를 쓴다. 코드값(design_dev
-- 같은)으로 두면 화면·메일·어드민에서 매번 한글로 옮겨야 하는데, 그 표가
-- 세 곳에 흩어져 어긋난다. 보이는 글자를 그대로 담는다.
--
-- null 을 허용한다 — 013 이전에 들어온 문의에는 유형이 없다.
-- not null 로 걸면 그 행들 때문에 마이그레이션이 거부된다.

alter table public.inquiries
  add column if not exists inquiry_type text;

comment on column public.inquiries.inquiry_type is
  '의뢰 유형: 디자인 + 개발 / 디자인 / 메인화면 시안 먼저 의뢰. 014 이전 문의는 null.';

-- 화면에 없는 값이 들어오지 않게 묶는다. API 에서도 거르지만,
-- 서버 액션과 달리 여기는 최종 방어선이다.
do $$
begin
  alter table public.inquiries
    add constraint inquiries_type_allowed
    check (
      inquiry_type is null
      or inquiry_type in ('디자인 + 개발', '디자인', '메인화면 시안 먼저 의뢰')
    );
exception
  when duplicate_object then null;  -- 이미 있으면 그대로 둔다
end $$;

create index if not exists inquiries_type_idx
  on public.inquiries (inquiry_type, created_at desc);

-- ─────────────────────────────────────────
-- 2. 확인용 조회
-- ─────────────────────────────────────────

select '컬럼 inquiries.inquiry_type' as 항목, '있음 ✓' as 상태
  from information_schema.columns
 where table_schema = 'public' and table_name = 'inquiries'
   and column_name = 'inquiry_type'

union all
select '제약 inquiries_type_allowed',
       case when count(*) > 0 then '있음 ✓' else '없음 ✗' end
  from pg_constraint where conname = 'inquiries_type_allowed'

union all
select '유형이 없는 기존 문의 수', count(*)::text
  from public.inquiries where inquiry_type is null

order by 1;
