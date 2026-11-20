-- ════════════════════════════════════════════════════════
-- 경력 페이지 디자이너별 포트폴리오 파일 — 여러 개를 올려 두면 링크를 받은 사람이 내려받는다.
-- 0032_designer_roster.sql 다음에 실행한다.
-- Supabase SQL Editor 에 붙여 넣고 Run. 여러 번 실행해도 안전하다.
-- ════════════════════════════════════════════════════════

-- 저장소 — 비공개. 경력 페이지가 비공개라 파일 주소가 새어도 열리지 않아야 한다.
-- 내려받을 때마다 서버가 링크·디자이너를 확인하고 1분짜리 서명 주소를 만들어 넘긴다.
-- 형식은 서버가 확장자로 거른다(hwp·key 처럼 MIME 이 들쭉날쭉한 파일이 있어 버킷에서는 막지 않는다).
insert into storage.buckets (id, name, public, file_size_limit)
values ('roster-files', 'roster-files', false, 52428800)  -- 50MB
on conflict (id) do update set public = false, file_size_limit = 52428800;

-- 파일 한 개. 디자이너를 지우면 줄도 지워진다(저장소의 실제 파일은 서버가 지운다).
create table if not exists public.roster_designer_files (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  designer_id  uuid not null references public.roster_designers(id) on delete cascade,

  -- 저장소 경로 '{designer_id}/{uuid}.{확장자}' — 원래 이름은 경로에 쓰지 않는다(한글·공백)
  path         text not null unique,
  -- 내려받을 때 붙는 원래 파일 이름
  name         text not null,
  size         bigint not null,
  -- 작은 수가 위
  sort_order   integer not null default 0
);

alter table public.roster_designer_files drop constraint if exists roster_designer_files_name_len;
alter table public.roster_designer_files add constraint roster_designer_files_name_len
  check (char_length(name) between 1 and 200);

alter table public.roster_designer_files drop constraint if exists roster_designer_files_size_chk;
alter table public.roster_designer_files add constraint roster_designer_files_size_chk
  check (size > 0 and size <= 52428800);

create index if not exists roster_designer_files_designer_idx
  on public.roster_designer_files (designer_id, sort_order, created_at);

comment on table public.roster_designer_files is '경력 페이지 디자이너별 포트폴리오 파일(roster-files 버킷)';

-- RLS — 켜 두고 정책을 두지 않는다. 서버의 service_role 만 읽고 쓴다.
alter table public.roster_designer_files enable row level security;
alter table public.roster_designer_files force  row level security;
