-- ════════════════════════════════════════════════════════
-- 전문 분야 — 어드민이 관리하는 목록
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 Run
-- 여러 번 실행해도 안전합니다 (멱등).
-- ════════════════════════════════════════════════════════

-- ─────────────────────────────────────────
-- 1. 분야 목록
-- ─────────────────────────────────────────
-- 지금까지는 디자이너가 쉼표로 자유롭게 적고, 탐색 사이드바가 그것을
-- 모아서 보여줬다. 그러면 'UX/UI' 와 'UI/UX', 'web' 과 '웹' 이 따로
-- 서서 필터가 금세 지저분해진다.
--
-- 어드민이 목록을 정하고, 디자이너는 그 안에서 고른다.
-- designers.tags 는 그대로 쓴다(text[]) — 고른 결과가 거기 담긴다.
-- 새 테이블로 옮기지 않는 이유는, 한 디자이너가 여러 분야를 갖는 관계가
-- 이미 배열로 잘 표현돼 있고 조회도 단순하기 때문이다.

create table if not exists public.specialties (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),

  -- 화면에 보이는 이름. 이것이 곧 designers.tags 에 담기는 값이다.
  name        text not null unique,

  -- 탐색 사이드바에서의 차례. 같은 값이면 이름순으로 선다.
  sort_order  integer not null default 0,

  -- 끄면 탐색 사이드바와 디자이너 선택지에서 빠진다.
  -- 지우지 않고 끄는 쪽을 둔 이유: 이미 그 분야를 고른 디자이너가 있으면
  -- 지웠을 때 tags 에 남은 값이 어디에도 없는 이름이 된다.
  visible     boolean not null default true,

  constraint specialties_name_len check (char_length(trim(name)) between 1 and 40)
);

comment on table  public.specialties is '어드민이 관리하는 전문 분야 목록. designers.tags 가 이 이름을 담는다.';
comment on column public.specialties.name is '화면에 보이는 이름이자 designers.tags 에 담기는 값. 바꾸면 쓰던 디자이너의 tags 도 함께 고쳐야 한다.';
comment on column public.specialties.visible is 'false 면 탐색 필터와 디자이너 선택지에서 빠진다. 이미 고른 디자이너의 tags 는 건드리지 않는다.';

create index if not exists specialties_order_idx
  on public.specialties (sort_order, name)
  where visible;

-- ─────────────────────────────────────────
-- 2. RLS — 전부 차단
-- ─────────────────────────────────────────
-- 다른 테이블과 같은 방침이다. 정책을 만들지 않으므로 anon·authenticated 는
-- 거부되고, 서버의 service_role 키만 이 테이블에 닿는다.

alter table public.specialties enable row level security;
alter table public.specialties force  row level security;

do $$
declare p record;
begin
  for p in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'specialties'
  loop
    execute format('drop policy if exists %I on public.specialties', p.policyname);
  end loop;
end $$;

-- ─────────────────────────────────────────
-- 3. 지금 쓰이는 분야를 그대로 가져온다
-- ─────────────────────────────────────────
-- 디자이너들이 이미 적어 둔 값을 목록의 출발점으로 삼는다.
-- 이것을 건너뛰면 마이그레이션 직후 탐색 필터가 통째로 빈다.
-- 어드민이 들어가서 정리(오타 끄기·순서 바꾸기)하면 된다.

insert into public.specialties (name, sort_order)
select distinct trim(t), 0
  from public.designers d, unnest(d.tags) as t
 where trim(t) <> ''
   and char_length(trim(t)) <= 40
on conflict (name) do nothing;

-- ─────────────────────────────────────────
-- 4. 확인용 조회
-- ─────────────────────────────────────────

select '테이블 specialties' as 항목,
       case when count(*) > 0 then '있음 ✓' else '없음 ✗' end as 상태
  from information_schema.tables
 where table_schema = 'public' and table_name = 'specialties'

union all
select 'RLS 켜짐',
       case when bool_and(rowsecurity) then '켜짐 ✓' else '꺼짐 ✗' end
  from pg_tables where schemaname = 'public' and tablename = 'specialties'

union all
select '정책 수 (0이어야 안전)', count(*)::text
  from pg_policies
 where schemaname = 'public' and tablename = 'specialties'

union all
select '가져온 분야 수', count(*)::text from public.specialties

order by 1;
