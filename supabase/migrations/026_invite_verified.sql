-- ════════════════════════════════════════════════════════
-- 초대코드 — '인증함' 상태 추가
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 Run
-- 여러 번 실행해도 안전합니다 (멱등).
-- ════════════════════════════════════════════════════════

-- ─────────────────────────────────────────
-- 1. 상태 값 — active 와 used 사이에 verified
-- ─────────────────────────────────────────
-- 가입 화면에서 누군가 이 코드로 [인증]을 통과하면 verified 가 된다.
-- 아직 가입하지 않았으므로 코드는 계속 쓸 수 있고(가입 가능·취소 가능),
-- 어드민이 "누가 이 코드로 인증까지는 했구나" 를 보기 위한 표시다.

alter type public.invite_status add value if not exists 'verified' after 'active';

-- ─────────────────────────────────────────
-- 2. 처음 인증한 시각
-- ─────────────────────────────────────────

alter table public.designer_invites
  add column if not exists verified_at timestamptz;

comment on column public.designer_invites.verified_at is
  '가입 화면에서 이 코드로 처음 인증한 시각. 가입 전이어도 남는다.';

comment on column public.designer_invites.status is
  'active 발행 / verified 인증함(가입 전, 계속 사용 가능) / used 사용됨 / expired 만료(조회 때 전환) / canceled 취소.';

-- ─────────────────────────────────────────
-- 3. 확인용 조회
-- ─────────────────────────────────────────

select 'enum invite_status' as 항목,
       string_agg(enumlabel, ', ' order by enumsortorder) as 상태
  from pg_enum e join pg_type t on t.oid = e.enumtypid
 where t.typname = 'invite_status'

union all
select 'verified_at 컬럼',
       case when count(*) > 0 then '있음 ✓' else '없음 ✗' end
  from information_schema.columns
 where table_schema = 'public' and table_name = 'designer_invites' and column_name = 'verified_at';
