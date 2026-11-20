-- ════════════════════════════════════════════════════════
-- 경력 페이지 링크 열람 기록 — 링크를 연 때마다 한 줄씩 남긴다.
-- 0032_designer_roster.sql 다음에 실행한다.
-- Supabase SQL Editor 에 붙여 넣고 Run. 여러 번 실행해도 안전하다.
-- ════════════════════════════════════════════════════════

-- roster_links.open_count 는 "몇 번"만 안다. 누가(IP·브라우저·OS) 언제 열었는지는 여기에 쌓는다.
-- 링크를 삭제하면 기록도 함께 지워진다(on delete cascade).
create table if not exists public.roster_link_opens (
  id          bigint generated always as identity primary key,
  link_id     uuid not null references public.roster_links(id) on delete cascade,
  opened_at   timestamptz not null default now(),

  ip          text,
  -- 원문은 길이를 잘라 둔다(500자). browser·os·device 는 서버가 원문에서 읽어 낸 이름이다.
  user_agent  text,
  browser     text,
  os          text,
  device      text,
  -- 카카오톡·슬랙 등이 링크 미리보기를 만들려고 연 것. 사람이 연 횟수(open_count)에는 넣지 않는다.
  is_bot      boolean not null default false
);

alter table public.roster_link_opens drop constraint if exists roster_link_opens_ua_len;
alter table public.roster_link_opens add constraint roster_link_opens_ua_len
  check (user_agent is null or char_length(user_agent) <= 500);

create index if not exists roster_link_opens_link_idx on public.roster_link_opens (link_id, opened_at desc);

comment on table public.roster_link_opens is '경력 페이지 링크(roster_links) 열람 기록 — IP·브라우저·OS·시각';

-- RLS — 켜 두고 정책을 두지 않는다. 서버의 service_role 만 읽고 쓴다.
alter table public.roster_link_opens enable row level security;
alter table public.roster_link_opens force  row level security;
