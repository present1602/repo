-- ════════════════════════════════════════════════════════
-- 비공개 디자이너 경력 페이지 — 어드민이 디자이너 실명·경력을 적어 두고,
-- 기한 있는 링크(/roster/{token})를 만들어 건네면 그 링크로만 볼 수 있다.
-- Supabase SQL Editor 에 붙여 넣고 Run. 여러 번 실행해도 안전하다.
-- ════════════════════════════════════════════════════════

-- 경력 페이지에 실리는 디자이너 한 명. 공개 프로필(designers)과 따로 둔다 —
-- 공개 화면은 이름을 가리지만(김*연) 여기는 실명을 그대로 싣는다.
create table if not exists public.roster_designers (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  name         text not null,
  career       text not null default '',
  avatar_url   text,
  -- '포트폴리오 보기' 가 여는 공개 상세(/designers/{id}). 없으면 버튼을 숨긴다.
  designer_id  uuid references public.designers(id) on delete set null,
  -- 작은 수가 위
  sort_order   integer not null default 0
);

alter table public.roster_designers drop constraint if exists roster_designers_name_len;
alter table public.roster_designers add constraint roster_designers_name_len
  check (char_length(name) between 1 and 30);

alter table public.roster_designers drop constraint if exists roster_designers_career_len;
alter table public.roster_designers add constraint roster_designers_career_len
  check (char_length(career) <= 5000);

create index if not exists roster_designers_order_idx on public.roster_designers (sort_order, created_at);

drop trigger if exists roster_designers_touch_updated_at on public.roster_designers;
create trigger roster_designers_touch_updated_at
  before update on public.roster_designers
  for each row execute function public.touch_updated_at();

-- 경력 페이지를 여는 링크. 만료는 저장된 상태가 아니라 expires_at 이 지났는지로 본다.
create table if not exists public.roster_links (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),

  -- 주소(/roster/{token})의 끝 토막. 추측할 수 없는 난수다.
  token           text not null unique,
  -- 누구에게 보냈는지 어드민이 적어 두는 메모(선택). 페이지에는 보이지 않는다.
  memo            text,
  expires_at      timestamptz not null,
  -- 기한 전에 어드민이 거둔 시각
  revoked_at      timestamptz,

  -- 받은 사람이 열어 봤는지
  open_count      integer not null default 0,
  last_opened_at  timestamptz,

  created_by      text
);

alter table public.roster_links drop constraint if exists roster_links_memo_len;
alter table public.roster_links add constraint roster_links_memo_len
  check (memo is null or char_length(memo) <= 100);

-- 유효기간은 1~7일(코드도 같은 범위만 받는다). 시계 오차 몫으로 1시간을 더 준다.
alter table public.roster_links drop constraint if exists roster_links_expiry_chk;
alter table public.roster_links add constraint roster_links_expiry_chk
  check (expires_at > created_at and expires_at <= created_at + interval '7 days 1 hour');

create index if not exists roster_links_created_idx on public.roster_links (created_at desc);

comment on table public.roster_designers is '비공개 경력 페이지(/roster/{token})에 실리는 디자이너 — 실명';
comment on table public.roster_links is '비공개 경력 페이지를 여는 기한 있는 링크(1~7일)';

-- RLS — 켜 두고 정책을 두지 않는다. 서버의 service_role 만 읽고 쓴다.
alter table public.roster_designers enable row level security;
alter table public.roster_designers force  row level security;
alter table public.roster_links enable row level security;
alter table public.roster_links force  row level security;
