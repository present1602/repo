-- ════════════════════════════════════════════════════════
-- 팝업 — 테이블 · 상태 enum · 첨부 버킷
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 Run
-- 여러 번 실행해도 안전합니다 (멱등).
-- ════════════════════════════════════════════════════════

-- ─────────────────────────────────────────
-- 1. 상태 enum
-- ─────────────────────────────────────────
--   visible — 노출. 게시 기간 안이면 사이트에 뜬다.
--   hidden  — 숨김. 관리자가 내려 둔 것.
--   expired — 만료. 노출 상태로 게시 기간이 지나 조회 때 자동으로 바뀐다.
--
-- 숨김과 만료를 나눈다 — 둘 다 안 보이지만 "내가 내렸는지, 기간이
-- 끝났는지"는 목록에서 구분돼야 다시 올릴지 판단할 수 있다.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'popup_status') then
    create type public.popup_status as enum ('visible', 'hidden', 'expired');
  end if;
end $$;

-- ─────────────────────────────────────────
-- 2. 팝업
-- ─────────────────────────────────────────

create table if not exists public.popups (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  -- 제목은 선택 — 이미지 한 장만 띄우는 팝업도 있다
  title       text,

  -- 본문: [{ type: 'text', text } | { type: 'image', path }] — 위에서부터 차례로.
  -- HTML 로 두지 않는다. 공개 화면에 그대로 그리면 스크립트가 실릴 수 있다.
  body        jsonb not null default '[]'::jsonb,

  -- 첨부 파일(본문 이미지와 별개): [{ name, path, size }]
  files       jsonb not null default '[]'::jsonb,

  -- 게시 기간 — 비우면 그쪽 끝이 열려 있다(바로 시작 / 끝없이)
  starts_at   timestamptz,
  ends_at     timestamptz,

  status      public.popup_status not null default 'hidden',
  status_at   timestamptz,

  constraint popups_title_len   check (title is null or char_length(title) <= 100),
  constraint popups_body_array  check (jsonb_typeof(body) = 'array' and jsonb_array_length(body) > 0),
  constraint popups_files_array check (jsonb_typeof(files) = 'array'),
  constraint popups_period      check (starts_at is null or ends_at is null or starts_at < ends_at)
);

comment on table  public.popups is '사이트 팝업. 어드민이 올리고 게시 기간·상태에 따라 공개 화면에 뜬다.';
comment on column public.popups.body is '본문 블록 배열. 글 또는 이미지(path). 비어 있을 수 없다.';
comment on column public.popups.files is '첨부 파일 [{ name, path, size }] — 본문 이미지와 별개.';
comment on column public.popups.status is 'visible 노출 / hidden 숨김 / expired 기간이 지나 자동 만료.';

create index if not exists popups_created_idx on public.popups (created_at desc);
create index if not exists popups_status_idx  on public.popups (status, ends_at);

-- ─────────────────────────────────────────
-- 3. RLS — 전부 차단
-- ─────────────────────────────────────────
-- 다른 테이블과 같은 방침이다. 공개 화면도 서버(service_role)를 거쳐
-- 기간·상태를 걸러 내보낸다.

alter table public.popups enable row level security;
alter table public.popups force  row level security;

do $$
declare p record;
begin
  for p in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'popups'
  loop
    execute format('drop policy if exists %I on public.popups', p.policyname);
  end loop;
end $$;

-- ─────────────────────────────────────────
-- 4. 버킷 — 공개, 파일당 20MB
-- ─────────────────────────────────────────
-- 방문자가 보고 내려받는 자료라 공개로 둔다. 어드민 화면이 서명 업로드로
-- 바로 올리므로 크기 제한은 버킷이 최종으로 막는다.

insert into storage.buckets (id, name, public, file_size_limit)
values ('popup-files', 'popup-files', true, 20971520)
on conflict (id) do update set public = true, file_size_limit = 20971520;

-- ─────────────────────────────────────────
-- 5. 확인용 조회
-- ─────────────────────────────────────────

select '테이블 popups' as 항목,
       case when count(*) > 0 then '있음 ✓' else '없음 ✗' end as 상태
  from information_schema.tables
 where table_schema = 'public' and table_name = 'popups'

union all
select 'enum popup_status',
       string_agg(enumlabel, ', ' order by enumsortorder)
  from pg_enum e join pg_type t on t.oid = e.enumtypid
 where t.typname = 'popup_status'

union all
select '정책 수 (0이어야 안전)', count(*)::text
  from pg_policies
 where schemaname = 'public' and tablename = 'popups'

union all
select 'popup-files 버킷',
       case when count(*) > 0 then '있음 ✓' else '없음 ✗' end
  from storage.buckets where id = 'popup-files'

order by 1;
