-- ════════════════════════════════════════════════════════
-- 의뢰 문의 — 연락처 추가
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 Run
-- 여러 번 실행해도 안전합니다 (멱등).
-- ════════════════════════════════════════════════════════

-- ─────────────────────────────────────────
-- 1. 연락처
-- ─────────────────────────────────────────
-- 화면에서는 필수로 받지만 컬럼은 null 을 허용한다 —
-- 012 로 이미 들어온 문의에는 연락처가 없기 때문이다.
-- not null 로 걸면 그 행들 때문에 마이그레이션 자체가 거부된다.
--
-- 앞으로 들어오는 값은 API(/api/inquiry)가 비어 있으면 돌려보낸다.

alter table public.inquiries
  add column if not exists phone text;

comment on column public.inquiries.phone is
  '연락처. 화면에서는 필수지만, 013 이전에 들어온 문의는 비어 있다.';

-- 형식까지는 묶지 않는다 — 02-123-4567, +82 10-..., 내선 번호처럼
-- 모양이 제각각이라 정규식으로 막으면 멀쩡한 번호가 거부된다.
-- 길이만 터무니없지 않게 둔다.
do $$
begin
  alter table public.inquiries
    add constraint inquiries_phone_len
    check (phone is null or char_length(trim(phone)) between 1 and 40);
exception
  when duplicate_object then null;  -- 이미 있으면 그대로 둔다
end $$;

-- ─────────────────────────────────────────
-- 2. 확인용 조회
-- ─────────────────────────────────────────

select '컬럼 inquiries.phone' as 항목,
       '있음 ✓ (' || data_type || ')' as 상태
  from information_schema.columns
 where table_schema = 'public' and table_name = 'inquiries'
   and column_name = 'phone'

union all
select '제약 inquiries_phone_len',
       case when count(*) > 0 then '있음 ✓' else '없음 ✗' end
  from pg_constraint where conname = 'inquiries_phone_len'

union all
select '연락처가 없는 기존 문의 수', count(*)::text
  from public.inquiries where phone is null

order by 1;
