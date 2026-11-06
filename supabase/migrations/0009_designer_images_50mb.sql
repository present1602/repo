-- ════════════════════════════════════════════════════════
-- 포트폴리오 이미지 한도 25MB → 50MB
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 Run
-- 여러 번 실행해도 안전합니다 (멱등). 0008_work_pdf_pages.sql 다음에 돌린다.
-- ════════════════════════════════════════════════════════
--
-- designer-images 버킷의 file_size_limit 만 올린다. 실제로 막는 것은 버킷이다 —
-- 코드(src/lib/portfolio-limits.ts 의 MAX_UPLOAD_BYTES)도 같은 값으로 맞춘다.
-- Free 플랜의 전역 한도(50MB)와 같은 값이다 — 더 올리려면 Pro 로 바꾸고 전역 한도부터 올린다.

update storage.buckets
  set file_size_limit = 52428800  -- 50MB
  where id = 'designer-images';
