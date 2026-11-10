-- ════════════════════════════════════════════════════════
-- 설정 가이드 — 챕터마다 글과 이미지를 쌓아 두는 안내문
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 Run
-- 여러 번 실행해도 안전합니다 (멱등). 0023_chat.sql 다음에 돌린다.
-- ════════════════════════════════════════════════════════
--
-- 디자이너가 로그인한 뒤 읽는 안내다 — 기능과 엮이지 않고 글과 그림만 보여 준다.
-- 어드민 '설정 가이드' 에서 챕터를 만들고, 챕터마다 본문을 글·이미지 블록으로
-- 쌓는다(팝업 본문과 같은 방식 — popup-shape.ts 의 PopupBlock).
--
--   title       챕터 제목(차례에 보이는 줄)
--   summary     제목 아래 한 줄 설명. 비워 둘 수 있다
--   body        본문 블록 배열 — [{"type":"text","text":"…"},{"type":"image","path":"guide/…"}]
--               이미지는 경로만 남긴다. 주소는 그릴 때 만든다(버킷 주소가 바뀌어도 데이터는 그대로)
--   sort_order  차례 — faqs 와 같은 방침으로 0번부터 다시 매긴다
--   visible     false 면 디자이너 화면에서 빠진다. 어드민 목록에는 '숨김' 으로 남는다

create table if not exists public.setup_guide_chapters (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  title       text not null,
  summary     text not null default '',
  body        jsonb not null default '[]'::jsonb,
  sort_order  integer not null default 0,
  visible     boolean not null default true
);

alter table public.setup_guide_chapters
  drop constraint if exists setup_guide_chapters_title_len;
alter table public.setup_guide_chapters
  add constraint setup_guide_chapters_title_len
  check (char_length(trim(title)) between 1 and 200);

alter table public.setup_guide_chapters
  drop constraint if exists setup_guide_chapters_summary_len;
alter table public.setup_guide_chapters
  add constraint setup_guide_chapters_summary_len check (char_length(summary) <= 500);

-- 본문은 블록 배열만 받는다 — 글 칸이 객체가 아닌 값으로 섞여 들어오면 화면이 깨진다
alter table public.setup_guide_chapters
  drop constraint if exists setup_guide_chapters_body_array;
alter table public.setup_guide_chapters
  add constraint setup_guide_chapters_body_array check (jsonb_typeof(body) = 'array');

comment on table  public.setup_guide_chapters is '어드민이 관리하는 디자이너용 설정 가이드. 챕터마다 글·이미지 블록을 쌓는다.';
comment on column public.setup_guide_chapters.summary is '제목 아래 한 줄 설명. 비워 둘 수 있다.';
comment on column public.setup_guide_chapters.body is '본문 블록 배열 — {"type":"text","text"} 또는 {"type":"image","path"}. 위에서부터 차례로 그린다.';
comment on column public.setup_guide_chapters.visible is 'false 면 디자이너 화면에서 빠진다. 어드민 목록에는 남는다.';

create index if not exists setup_guide_chapters_order_idx
  on public.setup_guide_chapters (sort_order, created_at)
  where visible;

-- 서버(service_role)만 읽고 쓴다
alter table public.setup_guide_chapters enable row level security;
alter table public.setup_guide_chapters force row level security;

-- ─────────────────────────────────────────
-- 가이드 이미지 버킷 — 공개. 업로드는 서버가 준 서명 주소로만 한다(쓰기 정책 없음)
-- ─────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'guide-images',
  'guide-images',
  true,
  10485760,  -- 10MB
  array['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/avif']
)
on conflict (id) do update
  set public = true,
      file_size_limit = 10485760,
      allowed_mime_types = excluded.allowed_mime_types;

-- 확인용 조회
select '설정 가이드 표' as 항목,
       case when count(*) = 1 then '있음 ✓' else '없음 ✗' end as 상태
  from information_schema.tables
 where table_schema = 'public' and table_name = 'setup_guide_chapters'
union all
select '가이드 이미지 버킷',
       case when count(*) = 1 then '있음 ✓' else '없음 ✗' end
  from storage.buckets
 where id = 'guide-images';
