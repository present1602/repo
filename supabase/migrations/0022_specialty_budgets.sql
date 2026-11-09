-- ════════════════════════════════════════════════════════
-- 분야별 예산 범위 — 간편 의뢰에서 2차 범위 대신 묻는 구간
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 Run
-- 여러 번 실행해도 안전합니다 (멱등). 0021_inquiry_budget.sql 다음에 돌린다.
-- ════════════════════════════════════════════════════════
--
-- 0021 은 구간 네 개를 check 제약에 박아 두었다. 구간은 분야마다 다르고
-- (앱은 300만원, 이커머스는 200만원이 경계다) 앞으로도 바뀌므로,
-- 고정 목록을 어드민이 고치는 표로 옮긴다 — 구간을 바꿀 때마다
-- 마이그레이션을 쓰지 않게.
--
-- 한 줄 = 분야 × 구간 하나. 줄이 없는 분야는 예산을 묻지 않는다
-- (상세페이지처럼). 간편 의뢰에서만 쓴다 — 디자이너를 지정한 의뢰는
-- 2차 범위에서 금액이 정해진다.

create table if not exists public.specialty_budgets (
  id           uuid primary key default gen_random_uuid(),
  specialty_id uuid not null references public.specialties (id) on delete cascade,
  -- 화면에 그대로 나가고 inquiries.budget 에 그대로 담기는 문구
  label        text not null,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now(),

  constraint specialty_budgets_label_len check (char_length(trim(label)) between 1 and 40),
  -- 같은 분야에 같은 구간을 두 번 두지 않는다
  constraint specialty_budgets_uniq unique (specialty_id, label)
);

comment on table public.specialty_budgets is
  '분야별 예산 범위 선택지(간편 의뢰). 줄이 없는 분야는 예산을 묻지 않는다.';
comment on column public.specialty_budgets.label is
  '화면에 나가고 inquiries.budget 에 담기는 문구. 예: 300만원 이하';

create index if not exists specialty_budgets_order_idx
  on public.specialty_budgets (specialty_id, sort_order, label);

-- 서버(service_role)만 읽고 쓴다
alter table public.specialty_budgets enable row level security;
alter table public.specialty_budgets force row level security;

-- ── 0021 의 고정 제약을 푼다 ──
-- 구간을 어드민이 정하므로 네 개짜리 목록으로는 더 막을 수 없다.
-- 접수 API 가 그 분야에 실제로 있는 구간인지 보고 거른다.
-- 길이만 DB 에서 막는다 — 아무 글이나 담기지 않게.
alter table public.inquiries
  drop constraint if exists inquiries_budget_allowed;

alter table public.inquiries
  drop constraint if exists inquiries_budget_len;
alter table public.inquiries
  add constraint inquiries_budget_len check (
    budget is null or char_length(trim(budget)) between 1 and 40
  );

comment on column public.inquiries.budget is
  '간편 의뢰에서 고른 예산 범위 문구. 선택사항이라 비어 있을 수 있다(0021·0022).';

-- 확인용 조회 — 처음에는 비어 있다. 어드민 설정에서 분야마다 적는다
select s.name as 분야, b.label as 구간, b.sort_order as 차례
  from public.specialties s
  left join public.specialty_budgets b on b.specialty_id = s.id
 order by s.sort_order, s.name, b.sort_order, b.label;
