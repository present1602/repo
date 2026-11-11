-- ════════════════════════════════════════════════════════
-- 포트폴리오 작업 끝에 붙이는 영상 — 유튜브 대신 파일로 직접 올리기
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 Run
-- 여러 번 실행해도 안전합니다 (멱등). 0027_chat_intents.sql 다음에 돌린다.
-- ════════════════════════════════════════════════════════
--
-- 0019_work_video.sql 은 유튜브 주소(video_id)만 받았다. 유튜브에 올리지
-- 않은 영상(비공개 클립, 짧은 데모)도 쓸 수 있게 파일 업로드를 더한다.
--
-- 한 작업에는 영상 소스 하나만 — 유튜브 또는 올린 파일 중 하나다.
-- video_id 와 video_file_path 를 동시에 채우지 않는다(코드가 저장할 때
-- 하나를 고르면 다른 하나는 null 로 비운다). 상세 모달은 video_id 가 있으면
-- 유튜브 iframe, video_file_path 가 있으면 <video> 태그로 재생한다.
--
--   designer_works.video_file_path  올린 영상의 저장 경로. null 이면 없음
--
-- 이미지와 다른 버킷(work-videos)을 쓴다 — 영상은 50MB 까지라 이미지
-- 버킷의 10MB 한도(0009)와 맞지 않고, 썸네일 변환 같은 이미지 전용 처리도
-- 영상에는 적용되면 안 된다.

-- ─────────────────────────────────────────
-- 1. 올린 영상 경로
-- ─────────────────────────────────────────

alter table public.designer_works
  add column if not exists video_file_path text;

-- 코드(video-upload.ts)가 만든 경로만 — works/<uuid>.<ext> 모양
alter table public.designer_works
  drop constraint if exists designer_works_video_file_path_shape;
alter table public.designer_works
  add constraint designer_works_video_file_path_shape check (
    video_file_path is null
    or video_file_path ~ '^works/[0-9a-f-]{36}\.[a-z0-9]+$'
  );

-- 유튜브와 올린 파일을 동시에 들고 있지 않는다 — 상세 모달이 둘 중
-- 무엇을 틀지 가릴 수 없게 된다
alter table public.designer_works
  drop constraint if exists designer_works_video_one_source;
alter table public.designer_works
  add constraint designer_works_video_one_source check (
    video_id is null or video_file_path is null
  );

comment on column public.designer_works.video_file_path is
  '작업 끝에 붙이는 올린 영상의 저장 경로(work-videos 버킷). null 이면 없음.
   video_id(유튜브)와 동시에 채우지 않는다 — 한 작업에 영상 소스는 하나뿐.';

-- ─────────────────────────────────────────
-- 2. 영상 버킷 — 공개. 업로드는 서버가 준 서명 주소로만 한다(쓰기 정책 없음)
-- ─────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'work-videos',
  'work-videos',
  true,
  52428800,  -- 50MB (Supabase 무료 티어의 파일당 상한과 같다 — 이보다 크게 잡으면 버킷 생성이 거절된다)
  array['video/mp4', 'video/webm', 'video/quicktime', 'video/ogg']
)
on conflict (id) do update
  set public = true,
      file_size_limit = 52428800,
      allowed_mime_types = excluded.allowed_mime_types;

-- 확인용 조회
select '영상 파일 경로 칸' as 항목,
       case when count(*) = 1 then '있음 ✓' else '없음 ✗' end as 상태
  from information_schema.columns
 where table_schema = 'public' and table_name = 'designer_works'
   and column_name = 'video_file_path'
union all
select '영상 버킷',
       case when count(*) = 1 then '있음 ✓' else '없음 ✗' end
  from storage.buckets
 where id = 'work-videos';
