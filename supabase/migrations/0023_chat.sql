-- ════════════════════════════════════════════════════════
-- 문의 챗봇 — 지식 카드와 대화 기록
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 Run
-- 여러 번 실행해도 안전합니다 (멱등). 0022_specialty_budgets.sql 다음에 돌린다.
-- ════════════════════════════════════════════════════════
--
-- 챗봇은 모델을 길들이지 않는다 — 지식 카드를 늘려 정확해진다.
-- 어드민 → 챗봇 에서 카드를 등록하고, 대화 기록을 읽어 빠진 지식을 메운다.
--
-- 두 표를 둔다
--   chat_knowledge   답에 쓰이는 지식 카드. FAQ 로 띄우기엔 길거나 내부 톤인 것
--   chat_logs        실제 대화. 모름으로 끝난 줄이 곧 다음에 쓸 카드다
--
-- 공개 노출 스위치는 site_settings 에 칸으로 붙인다 — 켜기 전에는
-- 어드민으로 로그인한 사람에게만 보인다.

-- ─────────── 지식 카드 ───────────
--
--   title       무엇에 대한 지식인지(모델이 고르는 단서가 된다)
--   body        지식 본문. 줄바꿈을 그대로 살려 프롬프트에 넣는다
--   sort_order  차례 — faqs 와 같은 방침으로 0번부터 다시 매긴다
--   enabled     false 면 프롬프트에서 빠진다. 어드민 목록에는 '끔' 으로 남는다

create table if not exists public.chat_knowledge (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  title       text not null,
  body        text not null default '',
  sort_order  integer not null default 0,
  enabled     boolean not null default true
);

alter table public.chat_knowledge
  drop constraint if exists chat_knowledge_title_len;
alter table public.chat_knowledge
  add constraint chat_knowledge_title_len check (char_length(trim(title)) between 1 and 200);

alter table public.chat_knowledge
  drop constraint if exists chat_knowledge_body_len;
alter table public.chat_knowledge
  add constraint chat_knowledge_body_len check (char_length(body) <= 8000);

comment on table  public.chat_knowledge is '챗봇이 답에 쓰는 지식 카드. 어드민이 등록하고 늘려 간다.';
comment on column public.chat_knowledge.body is '지식 본문. 줄바꿈을 그대로 살려 프롬프트에 넣는다.';
comment on column public.chat_knowledge.enabled is 'false 면 프롬프트에서 빠진다. 어드민 목록에는 남는다.';

create index if not exists chat_knowledge_order_idx
  on public.chat_knowledge (sort_order, created_at)
  where enabled;

-- ─────────── 대화 기록 ───────────
--
-- 한 줄이 한 번의 주고받기다(질문 하나 + 답 하나) — 대화 전체를 한 줄에 담으면
-- '모름으로 끝난 질문' 을 집어낼 수 없다. session_id 로 묶어 흐름을 읽는다.
--
--   session_id  브라우저가 만든 대화 묶음 id(uuid 글자). 로그인과 무관하다
--   question    사용자가 적은 말
--   answer      모델이 돌려준 말. 실패했으면 빈 글자로 남는다
--   unanswered  모델이 모른다고 답한 줄 — 어드민에서 '답변 필요' 로 모인다
--   resolved    그 질문으로 지식 카드를 만들었으면 체크해 목록에서 내린다
--   tokens_in/out  비용을 보기 위한 값. 없으면 0
--   error       실패한 까닭(모델 오류·한도 초과). 성공이면 빈 글자

create table if not exists public.chat_logs (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  session_id  text not null default '',
  question    text not null default '',
  answer      text not null default '',
  unanswered  boolean not null default false,
  resolved    boolean not null default false,
  tokens_in   integer not null default 0,
  tokens_out  integer not null default 0,
  error       text not null default ''
);

comment on table  public.chat_logs is '챗봇 대화 기록. 모름으로 끝난 줄을 모아 지식 카드를 늘린다.';
comment on column public.chat_logs.session_id is '브라우저가 만든 대화 묶음 id. 로그인과 무관하다.';
comment on column public.chat_logs.unanswered is '모델이 모른다고 답한 줄 — 어드민의 답변 필요 목록에 모인다.';
comment on column public.chat_logs.resolved is '그 질문으로 지식 카드를 만들었으면 true — 목록에서 내려간다.';

create index if not exists chat_logs_recent_idx
  on public.chat_logs (created_at desc);

-- 답변 필요 목록 — 모름으로 끝났고 아직 메우지 않은 줄
create index if not exists chat_logs_todo_idx
  on public.chat_logs (created_at desc)
  where unanswered and not resolved;

-- 서버(service_role)만 읽고 쓴다
alter table public.chat_knowledge enable row level security;
alter table public.chat_knowledge force row level security;
alter table public.chat_logs enable row level security;
alter table public.chat_logs force row level security;

-- ─────────── 공개 노출 스위치 ───────────
--
-- 기본은 false — 켤 때까지 어드민으로 로그인한 사람에게만 보인다.
-- 지식이 모자란 챗봇을 손님에게 먼저 보이면 그게 첫인상이 된다.

alter table public.site_settings
  add column if not exists chat_public boolean not null default false;

comment on column public.site_settings.chat_public is
  'false 면 챗봇이 어드민에게만 보인다. 지식을 채운 뒤 켠다.';

-- 확인용 조회
select '지식 카드 표' as 항목,
       case when count(*) = 1 then '있음 ✓' else '없음 ✗' end as 상태
  from information_schema.tables
 where table_schema = 'public' and table_name = 'chat_knowledge'
union all
select '대화 기록 표',
       case when count(*) = 1 then '있음 ✓' else '없음 ✗' end
  from information_schema.tables
 where table_schema = 'public' and table_name = 'chat_logs'
union all
select '공개 스위치 칸',
       case when count(*) = 1 then '있음 ✓' else '없음 ✗' end
  from information_schema.columns
 where table_schema = 'public' and table_name = 'site_settings' and column_name = 'chat_public';
