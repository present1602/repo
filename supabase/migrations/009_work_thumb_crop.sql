-- ════════════════════════════════════════════════════════
-- 썸네일 영역 — 어드민이 올릴 때 직접 잡는다
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 Run
-- 여러 번 실행해도 안전합니다 (멱등).
-- ════════════════════════════════════════════════════════

-- ─────────────────────────────────────────
-- 1. 크롭 영역
-- ─────────────────────────────────────────
-- 원본 픽셀이 아니라 0~1 비율로 저장한다. 픽셀로 두면 나중에 원본을
-- 다른 크기로 다시 만들 때 좌표가 통째로 어긋난다 — 비율은 그대로 쓴다.
--
--   crop_x, crop_y  — 영역 좌상단 (원본 너비·높이에 대한 비율)
--   crop_w, crop_h  — 영역 크기   (같은 기준)
--
-- 넷 다 null 이면 "영역을 잡지 않음" — 지금까지처럼 이미지 전체를
-- work-ratio.ts 규칙으로 보여준다. 일부만 채워진 상태는 쓰지 않는다.

alter table public.designer_works
  add column if not exists crop_x real;
alter table public.designer_works
  add column if not exists crop_y real;
alter table public.designer_works
  add column if not exists crop_w real;
alter table public.designer_works
  add column if not exists crop_h real;

comment on column public.designer_works.crop_x is
  '썸네일 영역 좌상단 x — 원본 너비에 대한 0~1 비율. 넷 다 null 이면 영역 미지정.';
comment on column public.designer_works.crop_y is
  '썸네일 영역 좌상단 y — 원본 높이에 대한 0~1 비율.';
comment on column public.designer_works.crop_w is
  '썸네일 영역 너비 — 원본 너비에 대한 0~1 비율.';
comment on column public.designer_works.crop_h is
  '썸네일 영역 높이 — 원본 높이에 대한 0~1 비율.';

-- 영역이 이미지 밖으로 나가면 화면에서 빈 칸이 생긴다.
-- 화면에서도 막지만 최종 방어선을 DB 에 둔다.
do $$
begin
  alter table public.designer_works
    add constraint designer_works_crop_range check (
      -- 넷 다 null(미지정) 이거나, 넷 다 들어 있고 범위 안이거나
      (crop_x is null and crop_y is null and crop_w is null and crop_h is null)
      or (
        crop_x >= 0 and crop_y >= 0
        and crop_w > 0 and crop_h > 0
        and crop_x + crop_w <= 1.0001   -- 부동소수 오차만큼 여유를 둔다
        and crop_y + crop_h <= 1.0001
      )
    );
exception
  when duplicate_object then null;  -- 이미 있으면 그대로 둔다
end $$;

-- ─────────────────────────────────────────
-- 2. 확인용 조회
-- ─────────────────────────────────────────

select '컬럼 designer_works.' || column_name as 항목, '있음 ✓' as 상태
  from information_schema.columns
 where table_schema = 'public' and table_name = 'designer_works'
   and column_name in ('crop_x', 'crop_y', 'crop_w', 'crop_h')

union all
select '제약 designer_works_crop_range',
       case when count(*) > 0 then '있음 ✓' else '없음 ✗' end
  from pg_constraint where conname = 'designer_works_crop_range'

union all
select '썸네일 영역을 잡아 둔 작업 수', count(*)::text
  from public.designer_works where crop_w is not null

order by 1;
