-- ════════════════════════════════════════════════════════
-- 포트폴리오 작업의 '프로젝트 보기' 링크 + 디자이너별 허용 스위치
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 Run
-- 여러 번 실행해도 안전합니다 (멱등). 0024_setup_guide.sql 다음에 돌린다.
-- ════════════════════════════════════════════════════════
--
-- 작업 하나에 이동 링크 하나를 붙인다 — 상세 모달 하단 가운데에
-- '프로젝트 보기 ↗' 버튼으로 뜬다.
--
-- 아무나 붙일 수 있게 두지 않는다: 어드민이 디자이너마다 켜 준 경우에만
-- 스튜디오 업로드 창에 링크 칸이 나온다(기본 꺼짐). 포트폴리오가 외부로
-- 나가는 통로라, 누가 그 통로를 열 수 있는지를 어드민이 쥔다.
--
--   designers.portfolio_link_allowed  false 면 스튜디오에 링크 칸이 뜨지 않는다
--   designer_works.link_url           작업에 붙인 이동 주소. null 이면 버튼 없음
--
-- 주소는 http(s) 만 받는다 — javascript: 같은 주소가 링크에 박히지 않게
-- DB 제약으로 막고, 코드(work-link.ts)도 같은 모양으로 거른다. 유튜브 영상
-- (0019)이 id 만 담아 주소를 코드가 조립하는 것과 같은 방침이다: 여기서는
-- 임의의 외부 주소가 목적이므로 주소를 담되, 모양을 좁혀 받는다.

-- ─────────────────────────────────────────
-- 1. 디자이너별 허용 스위치 — 기본 꺼짐
-- ─────────────────────────────────────────

alter table public.designers
  add column if not exists portfolio_link_allowed boolean not null default false;

comment on column public.designers.portfolio_link_allowed is
  '어드민이 켜 준 경우에만 이 디자이너가 포트폴리오에 이동 링크를 붙일 수 있다.
   꺼져 있으면 스튜디오 업로드 창에 링크 칸 자체가 뜨지 않는다. 기본 꺼짐.';

-- ─────────────────────────────────────────
-- 2. 작업에 붙이는 이동 주소
-- ─────────────────────────────────────────

alter table public.designer_works
  add column if not exists link_url text;

-- http(s) 로 시작하는 주소만. 공백이 들어간 주소도 막는다
alter table public.designer_works
  drop constraint if exists designer_works_link_url_shape;
alter table public.designer_works
  add constraint designer_works_link_url_shape check (
    link_url is null
    or (link_url ~ '^https?://[^[:space:]]+$' and char_length(link_url) <= 500)
  );

comment on column public.designer_works.link_url is
  '작업에 붙인 이동 주소(http/https, 500자 이내). null 이면 버튼이 뜨지 않는다.
   상세 모달 하단 가운데에 ''프로젝트 보기 ↗'' 로 뜬다.';

-- 확인용 조회
select '허용 스위치 칸' as 항목,
       case when count(*) = 1 then '있음 ✓' else '없음 ✗' end as 상태
  from information_schema.columns
 where table_schema = 'public' and table_name = 'designers'
   and column_name = 'portfolio_link_allowed'
union all
select '작업 링크 칸',
       case when count(*) = 1 then '있음 ✓' else '없음 ✗' end
  from information_schema.columns
 where table_schema = 'public' and table_name = 'designer_works'
   and column_name = 'link_url';
