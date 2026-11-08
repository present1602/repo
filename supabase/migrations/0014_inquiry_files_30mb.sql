-- ════════════════════════════════════════════════════════
-- 문의 첨부 버킷 한도 30MB
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 Run
-- 여러 번 실행해도 안전합니다 (멱등). 0013_scope_allow_sample.sql 다음에 돌린다.
-- ════════════════════════════════════════════════════════
--
-- 문의 첨부는 이제 브라우저가 서명 주소로 inquiry-files 버킷에 바로 올린다(src/lib/inquiry-files.ts).
-- 접수 API 를 거치지 않으므로 크기를 버킷이 막아야 한다 — 지금까지는 한도가 없었다.
-- 코드의 INQUIRY_FILE_MAX_MB(src/lib/inquiry-shape.ts)와 같은 값이다.

update storage.buckets
   set file_size_limit = 31457280  -- 30MB
 where id = 'inquiry-files';

-- 확인용 조회
select id, public, file_size_limit from storage.buckets where id = 'inquiry-files';
