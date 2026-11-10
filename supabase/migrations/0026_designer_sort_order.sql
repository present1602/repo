-- ════════════════════════════════════════════════════════
-- 탐색 화면 디자이너 차례 — 어드민이 끌어 정한다
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 Run
-- 여러 번 실행해도 안전합니다 (멱등). 0025_work_link.sql 다음에 돌린다.
-- ════════════════════════════════════════════════════════
--
-- 지금까지 탐색 목록은 등록 역순(created_at desc)으로만 섰다. 어드민이
-- 보여주고 싶은 차례를 따로 정할 수 있게 칸을 둔다.
--
--   sort_order  작은 수가 앞. 어드민 '디자이너 노출 관리'에서 끌어 바꾼다
--
-- 기본값을 0 으로 두고, 같은 값일 때는 예전처럼 등록 역순으로 세운다
-- (코드의 정렬도 sort_order → created_at desc 두 단계다). 그래서 이 파일을
-- 돌리기만 하고 차례를 손대지 않으면 지금 보이는 차례가 그대로 유지된다.
--
-- 탐색 맨 위의 feature1 묶음(0032_explore_features)과는 다른 것이다 —
-- 그쪽은 '크게 올릴 몇 명'이고, 이 칸은 그 아래 줄지어 서는 전체의 차례다.

alter table public.designers
  add column if not exists sort_order integer not null default 0;

comment on column public.designers.sort_order is
  '탐색 목록에서의 차례. 작은 수가 앞. 같으면 등록 역순.
   어드민이 끌어 정한다. 0 이면 아직 정하지 않은 것과 같다.';

-- 목록 질의가 쓰는 차례 그대로 — 공개된 디자이너만 걸러 읽는다
create index if not exists designers_sort_idx
  on public.designers (sort_order, created_at desc)
  where visible and profile_public;

-- 확인용 조회
select '차례 칸' as 항목,
       case when count(*) = 1 then '있음 ✓' else '없음 ✗' end as 상태
  from information_schema.columns
 where table_schema = 'public' and table_name = 'designers'
   and column_name = 'sort_order';
