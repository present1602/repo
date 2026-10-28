-- ════════════════════════════════════════════════════════
-- 초대 디자이너 가입 — 초대코드 · 이메일 인증코드
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 Run
-- 여러 번 실행해도 안전합니다 (멱등).
-- ════════════════════════════════════════════════════════

-- ─────────────────────────────────────────
-- 1. 초대코드 상태 enum
-- ─────────────────────────────────────────
--   active   — 발행됨. 기간 안이면 가입에 쓸 수 있다.
--   used     — 누군가 이 코드로 가입했다. 한 코드는 한 명만.
--   expired  — 기간이 지났다. 배치를 돌리지 않고, 그 코드로 가입을
--              시도하거나 어드민 목록을 열 때 바꾼다.
--   canceled — 어드민이 취소했다. active 일 때만 취소할 수 있다.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'invite_status') then
    create type public.invite_status as enum ('active', 'used', 'expired', 'canceled');
  end if;
end $$;

-- ─────────────────────────────────────────
-- 2. 초대코드
-- ─────────────────────────────────────────

create table if not exists public.designer_invites (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),

  -- 사람이 받아 적는 코드 — 헷갈리는 글자를 뺀 8자리
  code        text not null unique,

  -- 누구에게 줬는지 어드민이 적어 두는 칸
  memo        text,

  -- 이 시각부터는 쓸 수 없다. 발행 시 최대 14일 뒤까지만 고를 수 있다.
  expires_at  timestamptz not null,

  status      public.invite_status not null default 'active',
  status_at   timestamptz,

  -- 가입에 쓰였을 때 — 디자이너가 지워져도 누가 썼는지는 남긴다
  used_at     timestamptz,
  used_by     uuid references public.designers(id) on delete set null,
  used_email  text,

  constraint designer_invites_code_fmt check (code ~ '^[A-Z0-9]{8}$'),
  constraint designer_invites_memo_len check (memo is null or char_length(memo) <= 100),
  -- 날짜 단위로 고르므로 하루 여유를 둔다(오늘 + 14일의 자정까지)
  constraint designer_invites_max_period check (expires_at <= created_at + interval '15 days')
);

comment on table  public.designer_invites is '디자이너 초대코드. 어드민이 발행하고, 한 코드로 한 명이 가입한다.';
comment on column public.designer_invites.status is 'active 발행 / used 사용됨 / expired 만료(조회 때 전환) / canceled 취소.';
comment on column public.designer_invites.used_email is '가입 당시 이메일. 디자이너가 지워지거나 이메일을 바꿔도 남는다.';

create index if not exists designer_invites_created_idx on public.designer_invites (created_at desc);

-- ─────────────────────────────────────────
-- 3. 이메일 인증코드
-- ─────────────────────────────────────────
-- 가입 화면에서 이메일로 6자리 숫자를 보내고, 맞게 넣으면 verified_at 을
-- 찍는다. 가입이 끝나면 consumed_at 을 찍어 같은 인증으로 두 번 가입하지
-- 못하게 한다. 코드는 해시로만 남긴다.

create table if not exists public.email_verifications (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  email        text not null,
  code_hash    text not null,
  expires_at   timestamptz not null,
  -- 틀린 횟수 — 넘으면 그 코드는 버리고 새로 받아야 한다
  attempts     int not null default 0,
  verified_at  timestamptz,
  consumed_at  timestamptz
);

comment on table public.email_verifications is '가입용 이메일 인증코드. 코드는 해시로만 저장한다.';

create index if not exists email_verifications_email_idx
  on public.email_verifications (email, created_at desc);

-- ─────────────────────────────────────────
-- 4. RLS — 전부 차단
-- ─────────────────────────────────────────

alter table public.designer_invites    enable row level security;
alter table public.designer_invites    force  row level security;
alter table public.email_verifications enable row level security;
alter table public.email_verifications force  row level security;

do $$
declare p record;
begin
  for p in
    select policyname, tablename from pg_policies
    where schemaname = 'public' and tablename in ('designer_invites', 'email_verifications')
  loop
    execute format('drop policy if exists %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;

-- ─────────────────────────────────────────
-- 5. 확인용 조회
-- ─────────────────────────────────────────

select '테이블 designer_invites' as 항목,
       case when count(*) > 0 then '있음 ✓' else '없음 ✗' end as 상태
  from information_schema.tables
 where table_schema = 'public' and table_name = 'designer_invites'

union all
select '테이블 email_verifications',
       case when count(*) > 0 then '있음 ✓' else '없음 ✗' end
  from information_schema.tables
 where table_schema = 'public' and table_name = 'email_verifications'

union all
select 'enum invite_status',
       string_agg(enumlabel, ', ' order by enumsortorder)
  from pg_enum e join pg_type t on t.oid = e.enumtypid
 where t.typname = 'invite_status'

union all
select '정책 수 (0이어야 안전)', count(*)::text
  from pg_policies
 where schemaname = 'public' and tablename in ('designer_invites', 'email_verifications')

order by 1;
