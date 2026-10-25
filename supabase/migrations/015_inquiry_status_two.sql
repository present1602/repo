-- ════════════════════════════════════════════════════════
-- 의뢰 문의 — 상태를 확인/미확인 둘로
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 Run
-- 여러 번 실행해도 안전합니다 (멱등).
-- ════════════════════════════════════════════════════════

-- ─────────────────────────────────────────
-- 1. 상태 값 정리
-- ─────────────────────────────────────────
-- 012 에서는 네 단계(new·contacted·done·spam)로 뒀지만, 지금 필요한
-- 구분은 "봤는지 아닌지" 뿐이다. 단계를 늘려 두면 고를 때마다
-- 무엇을 고를지 망설이게 되고, 쓰지 않는 값이 데이터에 섞인다.
--
--   unread — 아직 확인하지 않음 (접수 직후 기본값)
--   read   — 확인함
--
-- 'new' 대신 'unread' 를 쓴다. new 는 "새로 들어옴"이라 시간이 지나면
-- 뜻이 흐려지지만, unread 는 확인 여부를 그대로 말한다.

-- 제약을 먼저 떼어낸다 — 값을 바꾸는 동안 옛 제약에 걸린다.
alter table public.inquiries
  drop constraint if exists inquiries_status_check;

-- 지금 들어 있는 값을 두 갈래로 옮긴다.
-- new 만 미확인이고, 손을 댄 적 있는 나머지는 확인한 것으로 본다.
update public.inquiries
   set status = case when status = 'new' then 'unread' else 'read' end
 where status not in ('unread', 'read');

alter table public.inquiries
  alter column status set default 'unread';

alter table public.inquiries
  add constraint inquiries_status_check
  check (status in ('unread', 'read'));

comment on column public.inquiries.status is
  '확인 여부. unread = 아직 확인 안 함(기본), read = 확인함.';

-- ─────────────────────────────────────────
-- 2. 확인용 조회
-- ─────────────────────────────────────────

select '기본값' as 항목, column_default as 상태
  from information_schema.columns
 where table_schema = 'public' and table_name = 'inquiries'
   and column_name = 'status'

union all
select '미확인(unread)', count(*)::text
  from public.inquiries where status = 'unread'

union all
select '확인(read)', count(*)::text
  from public.inquiries where status = 'read'

union all
select '그 밖의 값 (0이어야 한다)', count(*)::text
  from public.inquiries where status not in ('unread', 'read')

order by 1;
