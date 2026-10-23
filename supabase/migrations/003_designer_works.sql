-- ════════════════════════════════════════════════════════
-- 디자이너 포트폴리오 — 테이블 · RLS
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 Run
-- 여러 번 실행해도 안전합니다 (멱등).
-- ════════════════════════════════════════════════════════

-- ─────────────────────────────────────────
-- 1. 포트폴리오 작업
-- ─────────────────────────────────────────

create table if not exists public.designer_works (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  designer_id   uuid not null references public.designers(id) on delete cascade,

  image_url     text not null,
  -- 원본 비율 — 카드 자리를 미리 잡아 레이아웃이 흔들리지 않게 한다
  width         integer,
  height        integer,

  title         text,
  description   text,

  -- masonry 에서 이 카드가 세로로 몇 칸을 차지할지.
  -- 가로 폭은 그리드가 정하므로 조절하지 않는다 — 열이 깨지기 때문이다.
  row_span      integer not null default 1,

  -- 디자이너가 켠 노출 여부
  visible       boolean not null default true,

  -- 목록 정렬 순서
  sort_order    integer not null default 0,

  constraint designer_works_description_len check (char_length(coalesce(description, '')) <= 1000),
  constraint designer_works_row_span_range  check (row_span between 1 and 3)
);

comment on table  public.designer_works is '디자이너별 포트폴리오 이미지';
comment on column public.designer_works.row_span is
  'masonry 에서 차지할 세로 칸 수(1~3). 가로는 그리드가 정한다.';

create index if not exists designer_works_designer_idx
  on public.designer_works (designer_id, sort_order, created_at);

-- ─────────────────────────────────────────
-- 2. 개수 제한 — 최대 30개
-- ─────────────────────────────────────────
-- 애플리케이션에서도 막지만, 동시에 두 번 올리면 통과할 수 있다.
-- 최종 방어선을 DB에 둔다.

create or replace function public.designer_works_guard()
returns trigger
language plpgsql
as $$
declare
  total integer;
begin
  if tg_op = 'INSERT' then
    select count(*) into total
      from public.designer_works
     where designer_id = new.designer_id;

    if total >= 30 then
      raise exception '포트폴리오는 최대 30개까지 올릴 수 있습니다.'
        using errcode = 'check_violation';
    end if;
  end if;

  return new;
end $$;

drop trigger if exists designer_works_guard_trg on public.designer_works;
create trigger designer_works_guard_trg
  before insert on public.designer_works
  for each row execute function public.designer_works_guard();

-- ─────────────────────────────────────────
-- 3. updated_at 자동 갱신
-- ─────────────────────────────────────────
-- 001_designers.sql 에서 만든 touch_updated_at() 을 재사용한다.

drop trigger if exists designer_works_touch_updated_at on public.designer_works;
create trigger designer_works_touch_updated_at
  before update on public.designer_works
  for each row execute function public.touch_updated_at();

-- ─────────────────────────────────────────
-- 4. RLS — 전부 차단
-- ─────────────────────────────────────────
-- designers 와 같은 방침이다. 정책을 만들지 않으므로
-- anon·authenticated 는 거부되고, 서버의 service_role 키만 접근한다.
-- 디자이너 로그인은 Supabase Auth 가 아니라 우리 쪽 세션 쿠키로 처리하므로
-- 브라우저에서 이 테이블에 직접 닿을 일이 없다.

alter table public.designer_works enable row level security;
alter table public.designer_works force  row level security;

do $$
declare p record;
begin
  for p in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'designer_works'
  loop
    execute format('drop policy if exists %I on public.designer_works', p.policyname);
  end loop;
end $$;

-- ─────────────────────────────────────────
-- 5. 확인용 조회
-- ─────────────────────────────────────────

select 'designer_works RLS' as 항목,
       case when rowsecurity then '켜짐 ✓' else '꺼짐 ✗' end as 상태
  from pg_tables where schemaname = 'public' and tablename = 'designer_works'

union all
select '정책 수 (0이어야 안전)', count(*)::text
  from pg_policies
 where schemaname = 'public' and tablename = 'designer_works'

union all
select 'designer-images 버킷 공개',
       case when public then '공개 ✓ (의도됨)' else '비공개 ✗ 이미지가 안 보임' end
  from storage.buckets where id = 'designer-images';
