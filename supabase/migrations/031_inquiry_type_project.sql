-- ════════════════════════════════════════════════════════
-- 의뢰 유형 문구 변경 — 디자인 + 개발 → 프로젝트 의뢰
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 Run
-- 여러 번 실행해도 안전합니다 (멱등).
--
-- ⚠ 코드를 배포하기 전에 먼저 돌린다 — 제약이 옛 값 그대로면
--   화면이 보내는 '프로젝트 의뢰' 가 거부되어 문의 접수가 실패한다.
-- ════════════════════════════════════════════════════════

-- ─────────────────────────────────────────
-- 1. 이미 저장된 값을 새 문구로
-- ─────────────────────────────────────────
-- 제약을 바꾸기 전에 옮긴다 — 옛 값이 남아 있으면 새 제약이 거부된다.

alter table public.inquiries
  drop constraint if exists inquiries_type_allowed;

update public.inquiries
   set inquiry_type = '프로젝트 의뢰'
 where inquiry_type = '디자인 + 개발';

-- ─────────────────────────────────────────
-- 2. 제약 다시 걸기
-- ─────────────────────────────────────────
-- inquiry-types.ts 의 INQUIRY_TYPES 와 같은 글자여야 한다 —
-- 한 곳이라도 어긋나면 저장이 조용히 거부된다.

alter table public.inquiries
  add constraint inquiries_type_allowed
  check (
    inquiry_type is null
    or inquiry_type in ('디자인', '메인화면 시안 먼저 의뢰', '프로젝트 의뢰')
  );

comment on column public.inquiries.inquiry_type is
  '의뢰 유형: 디자인 / 메인화면 시안 먼저 의뢰 / 프로젝트 의뢰. 014 이전 문의는 null.';

-- ─────────────────────────────────────────
-- 3. 확인용 조회
-- ─────────────────────────────────────────

select '제약 inquiries_type_allowed' as 항목,
       case when count(*) > 0 then '있음 ✓' else '없음 ✗' end as 상태
  from pg_constraint where conname = 'inquiries_type_allowed'

union all
select '옛 문구가 남은 문의 (0이어야 한다)', count(*)::text
  from public.inquiries where inquiry_type = '디자인 + 개발'

union all
select '유형 ' || coalesce(inquiry_type, '(없음)'), count(*)::text
  from public.inquiries
 group by inquiry_type

order by 1;
