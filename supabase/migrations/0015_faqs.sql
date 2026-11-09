-- ════════════════════════════════════════════════════════
-- 자주 묻는 질문(FAQ) — 제목 + 내용, 차례와 노출
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 Run
-- 여러 번 실행해도 안전합니다 (멱등). 0014_inquiry_files_30mb.sql 다음에 돌린다.
-- ════════════════════════════════════════════════════════
--
-- 어드민 설정 → FAQ 에서 등록하고, 손잡이를 끌어 차례를 바꾼다.
-- 공개 화면에서는 제목만 보이고 누르면 내용이 펼쳐진다.
--
--   question    제목(접혀 있을 때 보이는 줄)
--   answer      내용(펼치면 나오는 글). 줄바꿈을 그대로 살려 내보낸다
--   sort_order  차례 — specialties 와 같은 방침으로 0번부터 다시 매긴다
--   visible     false 면 공개 화면에서 빠진다. 어드민 목록에는 '숨김' 으로 남는다

create table if not exists public.faqs (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  question    text not null,
  answer      text not null default '',
  sort_order  integer not null default 0,
  visible     boolean not null default true
);

alter table public.faqs
  drop constraint if exists faqs_question_len;
alter table public.faqs
  add constraint faqs_question_len check (char_length(trim(question)) between 1 and 200);

alter table public.faqs
  drop constraint if exists faqs_answer_len;
alter table public.faqs
  add constraint faqs_answer_len check (char_length(answer) <= 4000);

comment on table  public.faqs is '어드민이 관리하는 자주 묻는 질문. 제목을 누르면 내용이 펼쳐진다.';
comment on column public.faqs.question is '접혀 있을 때 보이는 제목.';
comment on column public.faqs.answer is '펼치면 나오는 내용. 줄바꿈을 그대로 살려 내보낸다.';
comment on column public.faqs.visible is 'false 면 공개 화면에서 빠진다. 어드민 목록에는 남는다.';

create index if not exists faqs_order_idx
  on public.faqs (sort_order, created_at)
  where visible;

-- 서버(service_role)만 읽고 쓴다
alter table public.faqs enable row level security;
alter table public.faqs force row level security;

-- 확인용 조회
select 'FAQ 표' as 항목,
       case when count(*) = 1 then '있음 ✓' else '없음 ✗' end as 상태
  from information_schema.tables
 where table_schema = 'public' and table_name = 'faqs';
