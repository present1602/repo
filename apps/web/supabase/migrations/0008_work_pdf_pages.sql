-- ════════════════════════════════════════════════════════
-- 포트폴리오 PDF — 장마다 이미지로 저장
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 Run
-- 여러 번 실행해도 안전합니다 (멱등). 0007_designer_images_25mb.sql 다음에 돌린다.
-- ════════════════════════════════════════════════════════
--
-- PDF 는 브라우저가 장마다 이미지로 그려 올린다(pdf-pages.ts). 원본 PDF 는 두지 않는다.
-- 첫 장은 image_url(표지·썸네일 재료)이고, 둘째 장부터 pages 에 담는다 —
-- 모달이 첫 장 아래로 이어 붙여 스크롤로 보여 준다.
--
-- 1. designer_works.pages — [{url, width, height}, …]. 이미지 작업은 null.
-- 2. 원본 PDF 를 두던 이전 안(pdf_url, 버킷의 application/pdf)을 걷어 낸다 —
--    그 안을 돌리지 않은 DB 에서는 아무 일도 하지 않는다.

alter table public.designer_works
  add column if not exists pages jsonb;

comment on column public.designer_works.pages is
  'PDF 로 올린 작업의 둘째 장부터 — [{url, width, height}]. 첫 장은 image_url. 이미지 작업은 null.';

alter table public.designer_works
  drop column if exists pdf_url;

update storage.buckets
  set allowed_mime_types = array['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/avif']
  where id = 'designer-images';
