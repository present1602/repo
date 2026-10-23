-- ════════════════════════════════════════════════════════
-- 디자이너 계정 — 테이블 · RLS
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 Run
-- 여러 번 실행해도 안전합니다 (멱등).
-- ════════════════════════════════════════════════════════

-- ─────────────────────────────────────────
-- 1. 디자이너
-- ─────────────────────────────────────────
-- 어드민이 이메일로 등록하고, 디자이너는 메일로 받은 임시 비밀번호로 로그인한다.
-- 프로필 상세(소개글·경력·지역·가격 플랜)는 다음 단계에서 컬럼을 늘린다.

create table if not exists public.designers (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  -- 로그인 아이디 겸 연락처. 구글 로그인은 쓰지 않는다.
  email           text not null unique,

  -- 공개 페이지에 쓰이는 표시 이름.
  -- 디자이너 본인은 최초 1회만 정할 수 있고, 이후 변경은 관리자만 한다.
  name            text not null,
  -- 이름을 본인이 한 번 정했는지 — 정했으면 디자이너 화면에서 입력칸이 잠긴다
  name_locked     boolean not null default false,

  avatar_url      text,
  -- 목록 카드에 한 줄로 들어가는 짧은 소개
  one_liner       text,
  -- 전문 분야 — 탐색 화면의 필터가 이 값으로 묶인다
  tags            text[] not null default '{}',

  -- bcrypt 해시. 평문은 저장하지 않는다.
  password_hash   text,
  -- 발급한 임시 비밀번호(평문). 디자이너가 비밀번호를 바꾸는 순간 null로 지운다.
  -- 어드민 화면에서 확인은 되지만, 변경 후에는 아무도 볼 수 없다.
  temp_password   text,
  password_changed_at timestamptz,

  last_login_at   timestamptz,

  -- 디자이너 자체의 공개 여부 — 끄면 탐색 화면에서 사라지고 로그인도 막힌다
  visible         boolean not null default true
);

comment on table  public.designers is '디자이너 계정 · 프로필';
comment on column public.designers.temp_password is '발급한 임시 비밀번호(평문). 본인이 변경하면 null이 되어 더는 확인할 수 없다.';
comment on column public.designers.name_locked is 'true면 디자이너 본인은 이름을 바꿀 수 없다(관리자에게 요청).';
comment on column public.designers.visible is 'false면 탐색 화면에서 숨고 로그인도 거부된다.';

create index if not exists designers_visible_idx on public.designers (visible, created_at desc);

-- ─────────────────────────────────────────
-- 2. updated_at 자동 갱신
-- ─────────────────────────────────────────

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists designers_touch_updated_at on public.designers;
create trigger designers_touch_updated_at
  before update on public.designers
  for each row execute function public.touch_updated_at();

-- ─────────────────────────────────────────
-- 3. RLS — 전부 차단
-- ─────────────────────────────────────────
-- 정책을 만들지 않으므로 anon·authenticated 는 거부되고,
-- 서버의 service_role 키만 이 테이블에 닿는다.
-- 디자이너 로그인은 Supabase Auth가 아니라 우리 쪽 서명 쿠키로 처리하므로
-- 브라우저에서 직접 접근할 일이 없다.
-- 특히 password_hash·temp_password 가 들어 있어 더더욱 열어두면 안 된다.

alter table public.designers enable row level security;
alter table public.designers force  row level security;

do $$
declare p record;
begin
  for p in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'designers'
  loop
    execute format('drop policy if exists %I on public.designers', p.policyname);
  end loop;
end $$;

-- ─────────────────────────────────────────
-- 4. Storage 버킷 — 프로필 이미지
-- ─────────────────────────────────────────
-- 공개 페이지에 실리므로 읽기는 공개, 쓰기는 service_role 만.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'designer-images',
  'designer-images',
  true,
  10485760,  -- 10MB
  array['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/avif']
)
on conflict (id) do update
  set public = true,
      file_size_limit = 10485760,
      allowed_mime_types = excluded.allowed_mime_types;

-- ─────────────────────────────────────────
-- 5. 확인용 조회
-- ─────────────────────────────────────────

select 'designers RLS' as 항목,
       case when rowsecurity then '켜짐 ✓' else '꺼짐 ✗' end as 상태
  from pg_tables where schemaname = 'public' and tablename = 'designers'

union all
select '정책 수 (0이어야 안전)', count(*)::text
  from pg_policies
 where schemaname = 'public' and tablename = 'designers'

union all
select 'designer-images 버킷 공개',
       case when public then '공개 ✓ (의도됨)' else '비공개 ✗ 이미지가 안 보임' end
  from storage.buckets where id = 'designer-images'

union all
select 'designer-images 쓰기 정책 수 (0이어야 안전)', count(*)::text
  from pg_policies
 where schemaname = 'storage' and tablename = 'objects'
   and (coalesce(qual, '') like '%designer-images%'
        or coalesce(with_check, '') like '%designer-images%');
