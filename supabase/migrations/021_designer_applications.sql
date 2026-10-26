-- ════════════════════════════════════════════════════════
-- 디자이너 지원서 — 접수 테이블 · 첨부 버킷
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 Run
-- 여러 번 실행해도 안전합니다 (멱등).
-- ════════════════════════════════════════════════════════

-- ─────────────────────────────────────────
-- 1. 지원서
-- ─────────────────────────────────────────
-- 제안서(designers/proposal/v1-3) 마지막 쪽에서 로그인 없이 보낸다.
-- 이력서·포트폴리오 파일은 브라우저가 Storage 로 바로 올리고(서명 업로드),
-- 여기에는 경로만 남는다 — 포트폴리오 PDF 는 수십 MB 라 서버를 거치면
-- 요청 크기 제한에 걸린다(app/api/apply/route.ts).

create table if not exists public.designer_applications (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),

  name        text not null,
  email       text not null,

  -- 첨부: { name, path, size } — path 는 designer-applications 버킷 안의 경로
  resume      jsonb not null,
  portfolio   jsonb not null,

  -- 중복 제출 차단 — 업로드 폴더 이름으로도 쓴다
  submit_key  text not null unique,

  -- 어드민이 봤는지 — 문의(015)와 같은 두 갈래
  status      text not null default 'unread'
              check (status in ('unread', 'read')),
  status_at   timestamptz,

  constraint designer_applications_name_len  check (char_length(trim(name)) between 1 and 100),
  constraint designer_applications_email_len check (char_length(trim(email)) between 3 and 200)
);

comment on table public.designer_applications is
  '디자이너 지원서. 제안서에서 로그인 없이 들어오고 어드민이 확인한다.';

create index if not exists designer_applications_created_idx
  on public.designer_applications (created_at desc);

-- ─────────────────────────────────────────
-- 2. RLS — 전부 차단
-- ─────────────────────────────────────────
-- 다른 테이블과 같은 방침이다. 정책이 없으므로 service_role 키만 닿는다.

alter table public.designer_applications enable row level security;
alter table public.designer_applications force  row level security;

do $$
declare p record;
begin
  for p in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'designer_applications'
  loop
    execute format('drop policy if exists %I on public.designer_applications', p.policyname);
  end loop;
end $$;

-- ─────────────────────────────────────────
-- 3. 첨부 버킷 — 비공개, 파일당 30MB
-- ─────────────────────────────────────────
-- 이력서에는 연락처·경력 같은 개인정보가 있다. 비공개로 두고 어드민
-- 화면에서 기한이 있는 서명 링크로만 연다.
--
-- 크기 제한을 버킷에 건다 — 서명 업로드는 서버를 거치지 않으므로
-- 서버에서 잰 크기를 믿을 수 없다. 여기가 마지막 방어선이다.

insert into storage.buckets (id, name, public, file_size_limit)
values ('designer-applications', 'designer-applications', false, 31457280)
on conflict (id) do update set public = false, file_size_limit = 31457280;

-- ─────────────────────────────────────────
-- 4. 확인용 조회
-- ─────────────────────────────────────────

select '테이블 designer_applications' as 항목,
       case when count(*) > 0 then '있음 ✓' else '없음 ✗' end as 상태
  from information_schema.tables
 where table_schema = 'public' and table_name = 'designer_applications'

union all
select '정책 수 (0이어야 안전)', count(*)::text
  from pg_policies
 where schemaname = 'public' and tablename = 'designer_applications'

union all
select 'designer-applications 버킷',
       case when count(*) > 0 then
         case when bool_and(not public) then '비공개 ✓' else '공개 ✗ 위험' end
       else '없음 ✗' end
  from storage.buckets where id = 'designer-applications'

order by 1;
