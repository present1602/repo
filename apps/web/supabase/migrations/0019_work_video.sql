-- ════════════════════════════════════════════════════════
-- 포트폴리오 작업 끝에 붙이는 유튜브 영상
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 Run
-- 여러 번 실행해도 안전합니다 (멱등).
-- ════════════════════════════════════════════════════════
--
-- 작업 하나에 영상 하나를 붙인다 — 상세 모달이 마지막 장 아래에 이어 붙여
-- 보여 준다. 그림 작업·PDF 작업 구분이 없다: PDF 도 올릴 때 장마다 이미지로
-- 바꿔 저장하므로(pdf-pages.ts) DB 에서는 둘이 같은 모양이다.
--
-- pages(jsonb)에 한 칸으로 끼우지 않고 칸을 따로 두는 이유 — pages 는 "이어
-- 붙인 긴 그림"의 장 목록이고, 그 높이 합이 width·height 와 crop_* 비율의
-- 기준이다(work-stack.ts). 영상을 그 목록에 넣으면 영상 칸까지 그림 높이로
-- 더해져 썸네일 영역이 어긋난다.
--
-- 주소 전체가 아니라 11자 영상 id 만 담는다. iframe 주소는 코드가
-- https://www.youtube-nocookie.com/embed/<id> 로 조립한다 — 임의 주소가
-- iframe src 에 박히는 자리를 만들지 않는다.

alter table public.designer_works
  add column if not exists video_id text;

-- 유튜브 영상 id — 11자, URL 안전 문자만. 코드(youtube.ts)도 같은 모양으로 거른다
alter table public.designer_works
  drop constraint if exists designer_works_video_id_shape;
alter table public.designer_works
  add constraint designer_works_video_id_shape check (
    video_id is null or video_id ~ '^[A-Za-z0-9_-]{11}$'
  );

comment on column public.designer_works.video_id is
  '작업 끝에 붙이는 유튜브 영상 id(11자). null 이면 영상 없음.
   주소가 아니라 id 만 담는다 — 보여줄 때 코드가 embed 주소를 조립한다.';

-- 확인용 조회
select '영상 id 칸' as 항목,
       case when count(*) = 1 then '있음 ✓' else '없음 ✗' end as 상태
  from information_schema.columns
 where table_schema = 'public' and table_name = 'designer_works'
   and column_name = 'video_id'
union all
select '모양 제약',
       case when count(*) = 1 then '있음 ✓' else '없음 ✗' end
  from pg_constraint
 where conname = 'designer_works_video_id_shape'
union all
select '영상 붙은 작업 ' || count(*) || '개', '✓'
  from public.designer_works
 where video_id is not null;
