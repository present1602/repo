-- ════════════════════════════════════════════════════════
-- 포트폴리오 이미지 한도 10MB → 20MB
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 Run
-- 여러 번 실행해도 안전합니다 (멱등). 0006_invite_link.sql 다음에 돌린다.
-- ════════════════════════════════════════════════════════
--
-- designer-images 버킷의 file_size_limit 만 올린다. 실제로 막는 것은 버킷이다 —
-- 코드(src/lib/upload.ts 의 MAX_IMAGE_BYTES)도 같은 값으로 맞춘다.
-- Free 플랜의 전역 한도(50MB) 안이라 플랜 변경은 필요 없다.

update storage.buckets
  set file_size_limit = 20971520  -- 20MB
  where id = 'designer-images';
