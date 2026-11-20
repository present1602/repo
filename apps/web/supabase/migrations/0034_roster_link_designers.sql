-- ════════════════════════════════════════════════════════
-- 경력 페이지 링크마다 보여 줄 디자이너를 고른다.
-- 0032_designer_roster.sql 다음에 실행한다.
-- Supabase SQL Editor 에 붙여 넣고 Run. 여러 번 실행해도 안전하다.
-- ════════════════════════════════════════════════════════

-- 링크를 만들 때 체크한 roster_designers.id 목록. 그 링크로는 이 사람들만 보인다.
-- null 은 이 칸이 생기기 전에 만든 링크다 — 예전처럼 전원을 보여 준다.
-- 목록의 디자이너를 나중에 삭제하면 그 사람만 빠진다(배열이라 외래 키는 걸지 않는다).
alter table public.roster_links add column if not exists designer_ids uuid[];

alter table public.roster_links drop constraint if exists roster_links_designer_ids_len;
alter table public.roster_links add constraint roster_links_designer_ids_len
  check (designer_ids is null or (cardinality(designer_ids) between 1 and 300));

comment on column public.roster_links.designer_ids is '이 링크로 보여 줄 roster_designers.id — null 이면 전원(0034 이전 링크)';
