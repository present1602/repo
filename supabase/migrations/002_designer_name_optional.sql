-- ════════════════════════════════════════════════════════
-- 이름을 선택값으로
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 Run
-- 여러 번 실행해도 안전합니다 (멱등).
-- ════════════════════════════════════════════════════════

-- 어드민은 이메일만으로 등록할 수 있어야 한다.
-- 이름은 디자이너가 첫 로그인 후 직접 채우는 쪽이 자연스럽다.
-- 비어 있는 동안 목록·상세에서는 이메일 앞부분을 임시로 보여준다.

alter table public.designers
  alter column name drop not null;

-- 빈 문자열로 들어온 과거 데이터는 null 로 맞춰둔다 —
-- "미입력"을 두 가지 모양으로 두면 화면에서 매번 둘 다 검사해야 한다.
update public.designers set name = null where btrim(name) = '';

comment on column public.designers.name is
  '표시 이름. 선택값 — 비어 있으면 화면에서 이메일 앞부분을 대신 쓴다.';

-- 확인
select '이름 null 허용' as 항목,
       case when is_nullable = 'YES' then '허용 ✓' else '불가 ✗' end as 상태
  from information_schema.columns
 where table_schema = 'public' and table_name = 'designers' and column_name = 'name';
