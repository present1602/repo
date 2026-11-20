-- ════════════════════════════════════════════════════════
-- 챗봇 시작 메뉴 — 손님이 처음에 고르는 단추와 그 소개 멘트
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 Run
-- 여러 번 실행해도 안전합니다 (멱등). 0026_designer_sort_order.sql 다음에 돌린다.
-- ════════════════════════════════════════════════════════
--
-- 챗봇을 열면 '무엇을 만들고 싶으신가요?' 아래에 단추가 깔린다. 누르면 그
-- 단추의 소개 멘트가 뜨고, 아래 단계가 있으면 다음 단추가 이어진다.
--
-- 단추를 왜 두는가: 빈 입력칸 앞에서 손님은 멈춘다. 무엇을 물어도 되는지
-- 모르기 때문이다. 고를 것을 깔아 두면 누르는 것이 적는 것보다 쉽고,
-- 누른 것이 곧 '무엇을 만들고 싶은지' 가 되어 의뢰로 이어진다.
--
--   parent_id   비어 있으면 첫 단계. 채워져 있으면 그 단추를 누른 뒤 나온다
--   label       단추에 적히는 말 ('웹사이트', '앱', '웹 + 앱')
--   intro       누른 뒤 챗봇이 띄우는 소개 멘트
--   sort_order  같은 단계 안에서의 차례. 작은 수가 앞
--   enabled     끄면 손님에게 안 보인다. 어드민 목록에는 남는다
--
-- intro 를 비워 두면 멘트 없이 다음 단계로 바로 넘어간다 — '웹사이트' 처럼
-- 그 자체로는 할 말이 없고 한 번 더 물어야 하는 단추에 쓴다.
--
-- 깊이는 막지 않는다(parent_id 가 몇 단계든 이어진다). 다만 실제로는 2단계
-- 까지만 쓰기를 권한다 — 세 번 물으면 손님은 창을 닫고, 그 아래에서 물을
-- 것들(예산·일정·연락처)은 이미 의뢰 폼이 묻는다.
--
-- 이 글은 챗봇의 프롬프트에도 함께 들어간다(chat-prompt.ts). 그래서 손님이
-- 단추를 누르지 않고 나중에 같은 것을 글로 물어도 챗봇이 답할 수 있다 —
-- 한 군데만 적으면 양쪽이 함께 바뀐다.

create table if not exists public.chat_intents (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  parent_id   uuid references public.chat_intents(id) on delete cascade,
  label       text not null,
  intro       text not null default '',
  sort_order  integer not null default 0,
  enabled     boolean not null default true
);

-- 부모를 지우면 자식도 함께 지운다(on delete cascade) — 끊어진 가지를 남기지
-- 않는다. 어드민에서도 '아래 단계까지 함께 지워집니다' 라고 알린다.

alter table public.chat_intents
  drop constraint if exists chat_intents_label_len;
alter table public.chat_intents
  add constraint chat_intents_label_len check (char_length(trim(label)) between 1 and 40);

alter table public.chat_intents
  drop constraint if exists chat_intents_intro_len;
alter table public.chat_intents
  add constraint chat_intents_intro_len check (char_length(intro) <= 2000);

-- 자기 자신을 부모로 삼지 못하게 — 한 단계짜리 고리도 막는다
alter table public.chat_intents
  drop constraint if exists chat_intents_not_self_parent;
alter table public.chat_intents
  add constraint chat_intents_not_self_parent check (parent_id is null or parent_id <> id);

comment on table  public.chat_intents is
  '챗봇 시작 메뉴. 손님이 고르는 단추와 그 소개 멘트. 어드민에서 짠다.';
comment on column public.chat_intents.parent_id is
  '비어 있으면 첫 단계. 채워져 있으면 그 단추를 누른 뒤 나온다.';
comment on column public.chat_intents.intro is
  '누른 뒤 띄우는 소개 멘트. 비우면 멘트 없이 다음 단계로 넘어간다.';
comment on column public.chat_intents.enabled is
  'false 면 손님에게 안 보인다. 어드민 목록에는 남는다.';

-- 화면이 읽는 차례 그대로 — 켜 둔 것만, 단계별로
create index if not exists chat_intents_tree_idx
  on public.chat_intents (parent_id, sort_order, created_at)
  where enabled;

-- 서버만 service_role 로 읽고 쓴다(AGENTS.md) — 정책을 두지 않는다
alter table public.chat_intents enable row level security;
alter table public.chat_intents force row level security;

-- ─────────── 처음 한 번만 넣는 보기 ───────────
--
-- 빈 표로 두면 어드민이 처음부터 다 적어야 한다. 단추 글자만 깔아 두고
-- 소개 멘트(intro)는 비워 둔다 — 그 글은 운영자가 직접 써야 하는 것이다.
-- 이미 무엇이든 들어 있으면 건드리지 않는다(두 번 돌려도 안전).

do $$
declare web_id uuid;
begin
  if exists (select 1 from public.chat_intents) then
    return;
  end if;

  insert into public.chat_intents (label, intro, sort_order) values
    ('웹사이트', '', 0)
    returning id into web_id;

  insert into public.chat_intents (label, intro, sort_order) values
    ('앱', '', 1),
    ('상세페이지', '', 2);

  insert into public.chat_intents (parent_id, label, intro, sort_order) values
    (web_id, '랜딩 페이지', '', 0),
    (web_id, '쇼핑몰', '', 1),
    (web_id, '회사소개 페이지', '', 2),
    (web_id, 'MVP 서비스', '', 3);
end $$;

-- 확인용 조회
select '시작 메뉴 표' as 항목,
       case when count(*) = 1 then '있음 ✓' else '없음 ✗' end as 상태
  from information_schema.tables
 where table_schema = 'public' and table_name = 'chat_intents';

select coalesce(p.label, '(첫 단계)') as 상위,
       c.label as 단추,
       case when c.intro = '' then '(소개 멘트 비어 있음)' else '적혀 있음' end as 소개
  from public.chat_intents c
  left join public.chat_intents p on p.id = c.parent_id
 order by coalesce(p.sort_order, c.sort_order), p.label nulls first, c.sort_order;
