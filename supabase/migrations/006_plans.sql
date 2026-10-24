-- ════════════════════════════════════════════════════════
-- 가격 플랜 — 디자이너별 선택 가격 · 전역 설명
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 Run
-- 여러 번 실행해도 안전합니다 (멱등).
-- ════════════════════════════════════════════════════════

-- ─────────────────────────────────────────
-- 1. 디자이너별 가격
-- ─────────────────────────────────────────
-- 금액은 디자이너가 정해진 보기 중에서 고른다. 자유 입력이 아니다 —
-- 1원이나 9,999,999원 같은 값이 공개 화면에 박히면 플랫폼 신뢰가 깨진다.
-- 허용 금액은 check 제약으로 못박고, 화면의 보기(plans.ts)와 같은 값을 쓴다.
--
-- 단위는 원이다. 소수가 없으므로 integer 로 충분하다.

alter table public.designers
  add column if not exists design_price   integer not null default 29000;

alter table public.designers
  add column if not exists premium_price  integer not null default 79000;

-- 프리미엄은 디자이너가 끌 수 있다. 디자인 플랜은 필수라 끄는 스위치가 없다.
-- 기본은 꺼짐 — 금액을 들여다보지 않은 계정이 79,000원을 내건 것처럼
-- 보이면 안 된다. 쓰겠다고 켜는 편이 안전하다.
alter table public.designers
  add column if not exists premium_enabled boolean not null default false;

comment on column public.designers.design_price is
  '디자인 플랜 금액(원).';
comment on column public.designers.premium_price is
  '프리미엄 플랜 금액(원).';
comment on column public.designers.premium_enabled is
  'false면 공개 화면에 프리미엄 플랜을 보여주지 않는다. 디자인 플랜은 항상 보인다.';

do $$
begin
  alter table public.designers
    add constraint designers_design_price_allowed
    check (design_price in (29000, 39000, 49000, 79000));
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.designers
    add constraint designers_premium_price_allowed
    check (premium_price in (79000, 109000, 169000));
exception when duplicate_object then null;
end $$;

-- ─────────────────────────────────────────
-- 1-2. 신규 가입 기본값 — 프로필 비공개
-- ─────────────────────────────────────────
-- 004 에서는 기본이 공개였다. 등록되자마자 빈 프로필이 탐색 화면에 뜨므로
-- 기본을 비공개로 바꾼다 — 디자이너가 내용을 채운 뒤 직접 켠다.
--
-- 이미 등록된 계정의 현재 값은 건드리지 않는다. 기본값만 바꾼다 —
-- 공개해 둔 디자이너가 이 마이그레이션 때문에 사라지면 안 된다.

alter table public.designers
  alter column profile_public set default false;

comment on column public.designers.profile_public is
  '디자이너 본인이 정하는 프로필 공개 여부. 신규 가입은 비공개로 시작한다. 계정 정지는 visible 을 쓴다.';

-- ─────────────────────────────────────────
-- 2. 전역 설정 — 플랜 이름·설명
-- ─────────────────────────────────────────
-- 설명은 모든 디자이너에게 같은 문구가 나간다. 어드민이 한 번 고치면
-- 전체에 반영돼야 하므로 디자이너 행이 아니라 설정 테이블에 둔다.
--
-- 한 줄만 쓰는 테이블이다. id 를 고정값으로 묶어 두 줄째가 생기지 않게 한다 —
-- 행이 여러 개면 "어느 것이 진짜인지" 가 코드마다 갈린다.

create table if not exists public.site_settings (
  id          boolean primary key default true,
  updated_at  timestamptz not null default now(),

  design_plan_name  text not null default '디자인 플랜',
  design_plan_desc  text not null default '고객측에서 디자인할 화면에 들어갈 내용을 구체적으로 전달합니다.',

  premium_plan_name text not null default '프리미엄 플랜',
  premium_plan_desc text not null default '프리미엄플랜설명',

  constraint site_settings_single_row check (id),
  constraint site_settings_desc_len check (
    char_length(design_plan_desc)  <= 500 and
    char_length(premium_plan_desc) <= 500
  )
);

comment on table public.site_settings is
  '사이트 전역 설정. 한 줄만 존재한다(id = true).';

-- 기본 한 줄을 넣어 둔다. 이미 있으면 건드리지 않는다 —
-- 다시 실행했을 때 어드민이 고친 문구를 되돌리면 안 된다.
insert into public.site_settings (id) values (true)
on conflict (id) do nothing;

drop trigger if exists site_settings_touch_updated_at on public.site_settings;
create trigger site_settings_touch_updated_at
  before update on public.site_settings
  for each row execute function public.touch_updated_at();

-- ─────────────────────────────────────────
-- 3. RLS — 전부 차단
-- ─────────────────────────────────────────
-- 다른 테이블과 같은 방침이다. 공개 화면도 서버에서 읽어 내려보내므로
-- 브라우저가 직접 닿을 일이 없다.

alter table public.site_settings enable row level security;
alter table public.site_settings force  row level security;

do $$
declare p record;
begin
  for p in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'site_settings'
  loop
    execute format('drop policy if exists %I on public.site_settings', p.policyname);
  end loop;
end $$;

-- ─────────────────────────────────────────
-- 4. 확인용 조회
-- ─────────────────────────────────────────

select '기본값 designers.' || column_name as 항목,
       coalesce(column_default, '(없음)') as 상태
  from information_schema.columns
 where table_schema = 'public' and table_name = 'designers'
   and column_name in ('design_price','premium_price','premium_enabled','profile_public')

union all
select 'site_settings 행 수 (1이어야 함)', count(*)::text
  from public.site_settings

union all
select 'site_settings RLS',
       case when bool_or(rowsecurity) then '켜짐 ✓' else '꺼짐 ✗' end
  from pg_tables
 where schemaname = 'public' and tablename = 'site_settings'

union all
select 'site_settings 정책 수 (0이어야 안전)', count(*)::text
  from pg_policies
 where schemaname = 'public' and tablename = 'site_settings'

order by 1;
