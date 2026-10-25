-- ════════════════════════════════════════════════════════
-- 의뢰 문의 — 접수 테이블 · 첨부 버킷
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 Run
-- 여러 번 실행해도 안전합니다 (멱등).
-- ════════════════════════════════════════════════════════

-- ─────────────────────────────────────────
-- 1. 문의
-- ─────────────────────────────────────────
-- 로그인 없이 누구나 보낸다. 받는 쪽은 어드민이고, 알림 메일이 함께 나간다.
-- 메일이 실패해도 여기 남아 있으면 놓치지 않는다 — 그래서 저장이 먼저다.

create table if not exists public.inquiries (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),

  -- 폼 필수 항목
  name          text not null,
  email         text not null,
  message       text not null,

  -- 누구에게 보낸 문의인지. 디자이너 상세에서 열면 채워지고,
  -- 네비바에서 열면 비어 있다(아직 상대를 안 정한 일반 의뢰).
  -- 디자이너가 지워져도 문의 기록은 남아야 하므로 외래키를 걸지 않는다.
  designer_id   uuid,
  designer_name text,

  -- 첨부 파일: [{ name, path, url, size }]
  files         jsonb not null default '[]'::jsonb,

  -- 중복 제출 차단 — 같은 키는 한 번만 저장된다.
  -- 느린 응답에 다시 누르면 같은 문의가 두 번 들어온다.
  submit_key    text unique,

  -- 처리 상태 — 어드민 화면에서 바꾼다
  status        text not null default 'new'
                check (status in ('new', 'contacted', 'done', 'spam')),
  memo          text,

  -- 알림 메일이 나갔는지. 실패해도 접수는 남으므로 따로 센다.
  mailed        boolean not null default false,

  constraint inquiries_name_len    check (char_length(trim(name)) between 1 and 100),
  constraint inquiries_email_len   check (char_length(trim(email)) between 3 and 200),
  constraint inquiries_message_len check (char_length(trim(message)) between 1 and 5000)
);

comment on table  public.inquiries is '의뢰 문의 접수. 로그인 없이 들어오고 어드민이 처리한다.';
comment on column public.inquiries.submit_key is '중복 제출 차단용. 같은 키로는 한 번만 저장된다.';
comment on column public.inquiries.designer_id is '특정 디자이너에게 보낸 문의면 채워진다. 외래키를 걸지 않아 디자이너가 지워져도 기록이 남는다.';
comment on column public.inquiries.mailed is '알림 메일 발송 성공 여부. 실패해도 접수는 저장된다.';

create index if not exists inquiries_created_idx on public.inquiries (created_at desc);
create index if not exists inquiries_status_idx  on public.inquiries (status, created_at desc);

-- ─────────────────────────────────────────
-- 2. updated 가 없는 대신 상태 변경 시각
-- ─────────────────────────────────────────
-- 언제 처리했는지 알아야 밀린 문의를 찾을 수 있다.

alter table public.inquiries
  add column if not exists status_at timestamptz;

comment on column public.inquiries.status_at is '상태를 마지막으로 바꾼 시각. 접수 직후에는 null.';

-- ─────────────────────────────────────────
-- 3. RLS — 전부 차단
-- ─────────────────────────────────────────
-- 다른 테이블과 같은 방침이다. 정책을 만들지 않으므로 anon·authenticated 는
-- 거부되고, 서버의 service_role 키만 닿는다. 폼 제출도 서버를 거친다.
-- 이름·이메일·문의 내용이 들어 있어 더더욱 열어두면 안 된다.

alter table public.inquiries enable row level security;
alter table public.inquiries force  row level security;

do $$
declare p record;
begin
  for p in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'inquiries'
  loop
    execute format('drop policy if exists %I on public.inquiries', p.policyname);
  end loop;
end $$;

-- ─────────────────────────────────────────
-- 4. 첨부 파일 버킷
-- ─────────────────────────────────────────
-- 작업 이미지(designer-images)와 섞지 않는다. 저쪽은 공개 버킷이라
-- 주소만 알면 누구나 열 수 있는데, 문의 첨부는 사업 자료일 수 있다.
-- 비공개로 두고 메일에는 기한이 있는 서명 링크를 넣는다.

insert into storage.buckets (id, name, public)
values ('inquiry-files', 'inquiry-files', false)
on conflict (id) do nothing;

-- ─────────────────────────────────────────
-- 5. 확인용 조회
-- ─────────────────────────────────────────

select '테이블 inquiries' as 항목,
       case when count(*) > 0 then '있음 ✓' else '없음 ✗' end as 상태
  from information_schema.tables
 where table_schema = 'public' and table_name = 'inquiries'

union all
select 'RLS 켜짐',
       case when bool_and(rowsecurity) then '켜짐 ✓' else '꺼짐 ✗' end
  from pg_tables where schemaname = 'public' and tablename = 'inquiries'

union all
select '정책 수 (0이어야 안전)', count(*)::text
  from pg_policies
 where schemaname = 'public' and tablename = 'inquiries'

union all
select 'inquiry-files 버킷',
       case when count(*) > 0 then
         case when bool_and(not public) then '비공개 ✓' else '공개 ✗ 위험' end
       else '없음 ✗' end
  from storage.buckets where id = 'inquiry-files'

union all
select '접수된 문의 수', count(*)::text from public.inquiries

order by 1;
