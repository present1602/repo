-- ════════════════════════════════════════════════════════
-- 탐색 제목 아래 문구 — 분야별 · 전체
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 Run
-- 여러 번 실행해도 안전합니다 (멱등). 0001_init.sql 다음에 돌린다.
-- ════════════════════════════════════════════════════════
--
-- 탐색에서 분야를 고르면 제목 아래에 그 분야의 description 이, '전체'에서는
-- site_settings.explore_desc 가 나간다. 비어 있으면 아무것도 나가지 않는다.
-- 어드민 설정 → 전문 분야에서 고친다.

alter table public.specialties
  add column if not exists description text not null default '';

alter table public.specialties
  drop constraint if exists specialties_description_len;

alter table public.specialties
  add constraint specialties_description_len check (char_length(description) <= 200);

comment on column public.specialties.description is
  '탐색에서 이 분야를 고르면 제목 아래에 나가는 문구. 비면 나가지 않는다.';

alter table public.site_settings
  add column if not exists explore_desc text not null default '';

alter table public.site_settings
  drop constraint if exists site_settings_explore_desc_len;

alter table public.site_settings
  add constraint site_settings_explore_desc_len check (char_length(explore_desc) <= 200);

comment on column public.site_settings.explore_desc is
  '탐색 "전체"일 때 제목 아래에 나가는 문구. 비면 나가지 않는다.';

-- 확인용 조회
select '분야 문구 칸' as 항목,
       case when count(*) = 1 then '있음 ✓' else '없음 ✗' end as 상태
  from information_schema.columns
 where table_schema = 'public' and table_name = 'specialties' and column_name = 'description'
union all
select '전체 문구 칸',
       case when count(*) = 1 then '있음 ✓' else '없음 ✗' end
  from information_schema.columns
 where table_schema = 'public' and table_name = 'site_settings' and column_name = 'explore_desc';
