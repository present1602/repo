-- ════════════════════════════════════════════════════════
-- 프로필 공개 여부 · 로그인 이력 — 테이블 · 컬럼 · RLS
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 Run
-- 여러 번 실행해도 안전합니다 (멱등).
-- ════════════════════════════════════════════════════════

-- ─────────────────────────────────────────
-- 1. 프로필 공개 여부
-- ─────────────────────────────────────────
-- designers.visible 과 역할이 다르다. 섞으면 안 된다:
--
--   visible        — 관리자만 끈다. 끄면 로그인 자체가 거부된다(계정 정지).
--   profile_public — 디자이너 본인이 끈다. 탐색 화면에서만 사라지고
--                    로그인과 관리 화면은 그대로 쓸 수 있다.
--
-- 본인에게 visible 을 맡기면 끄는 순간 세션이 무효가 되어
-- 다시 켜러 들어올 수조차 없다. 그래서 컬럼을 따로 둔다.

alter table public.designers
  add column if not exists profile_public boolean not null default true;

comment on column public.designers.profile_public is
  '디자이너 본인이 정하는 프로필 공개 여부. false면 탐색 화면에서만 숨고 로그인은 가능하다. 계정 정지는 visible 을 쓴다.';

-- 탐색 화면은 두 조건을 함께 본다 — 복합 인덱스로 받는다
create index if not exists designers_public_idx
  on public.designers (visible, profile_public, created_at desc);

-- ─────────────────────────────────────────
-- 2. 로그인 이력
-- ─────────────────────────────────────────
-- designers.last_login_at 은 덮어쓰기라 마지막 시각만 남는다.
-- 횟수를 세려면 로그인마다 한 줄씩 쌓아야 한다.

create table if not exists public.designer_logins (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),

  designer_id   uuid not null references public.designers(id) on delete cascade
);

comment on table public.designer_logins is
  '디자이너 로그인 1회 = 1행. 최근 30일 횟수 집계에 쓴다.';

-- 집계는 늘 "이 디자이너의 최근 N일" 형태다 — 그 순서로 인덱스를 잡는다
create index if not exists designer_logins_designer_idx
  on public.designer_logins (designer_id, created_at desc);

-- ─────────────────────────────────────────
-- 3. 목록용 집계 뷰
-- ─────────────────────────────────────────
-- 어드민 목록은 디자이너마다 네 가지 숫자를 함께 보여준다.
-- 행마다 따로 조회하면 N+1 이 되므로 한 번에 집계한다.
--
-- security_invoker 를 켜 두면 뷰가 호출자의 권한으로 동작한다 —
-- 뷰가 RLS 를 우회하는 통로가 되지 않는다. 서버의 service_role 만 읽는다.

create or replace view public.designer_activity
with (security_invoker = true)
as
select
  d.id as designer_id,

  -- 로그인 이력이 없던 시절의 계정도 있으므로 last_login_at 을 함께 본다
  greatest(
    d.last_login_at,
    (select max(l.created_at) from public.designer_logins l where l.designer_id = d.id)
  ) as last_login_at,

  coalesce((
    select count(*) from public.designer_logins l
     where l.designer_id = d.id
       and l.created_at >= now() - interval '30 days'
  ), 0) as logins_30d,

  (select max(w.created_at) from public.designer_works w where w.designer_id = d.id)
    as last_work_at,

  coalesce((
    select count(*) from public.designer_works w
     where w.designer_id = d.id and w.visible
  ), 0) as works_visible,

  coalesce((
    select count(*) from public.designer_works w where w.designer_id = d.id
  ), 0) as works_total

from public.designers d;

comment on view public.designer_activity is
  '어드민 목록용 집계 — 마지막 로그인·최근 30일 로그인 수·최근 업로드·포트폴리오(노출/전체).';

-- ─────────────────────────────────────────
-- 4. RLS — 전부 차단
-- ─────────────────────────────────────────
-- designers·designer_works 와 같은 방침이다. 정책을 만들지 않으므로
-- anon·authenticated 는 거부되고, 서버의 service_role 키만 접근한다.

alter table public.designer_logins enable row level security;
alter table public.designer_logins force  row level security;

do $$
declare p record;
begin
  for p in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'designer_logins'
  loop
    execute format('drop policy if exists %I on public.designer_logins', p.policyname);
  end loop;
end $$;

-- ─────────────────────────────────────────
-- 5. 확인용 조회
-- ─────────────────────────────────────────

select 'profile_public 컬럼' as 항목,
       case when count(*) = 1 then '있음 ✓' else '없음 ✗' end as 상태
  from information_schema.columns
 where table_schema = 'public' and table_name = 'designers'
   and column_name = 'profile_public'

union all
select 'designer_logins RLS',
       case when bool_or(rowsecurity) then '켜짐 ✓' else '꺼짐 ✗' end
  from pg_tables
 where schemaname = 'public' and tablename = 'designer_logins'

union all
select 'designer_logins 정책 수 (0이어야 안전)', count(*)::text
  from pg_policies
 where schemaname = 'public' and tablename = 'designer_logins'

union all
select 'designer_activity 뷰',
       case when count(*) = 1 then '있음 ✓' else '없음 ✗' end
  from information_schema.views
 where table_schema = 'public' and table_name = 'designer_activity';
