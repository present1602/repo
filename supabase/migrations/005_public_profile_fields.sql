-- ════════════════════════════════════════════════════════
-- 공개 프로필 — 소개글 · 작업 메타(클라이언트 · 연도)
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 Run
-- 여러 번 실행해도 안전합니다 (멱등).
-- ════════════════════════════════════════════════════════

-- ─────────────────────────────────────────
-- 1. 긴 소개글
-- ─────────────────────────────────────────
-- one_liner 는 목록 카드에 한 줄로 들어간다.
-- bio 는 상세 화면 이름 밑에 들어가는 문단이다 — 줄바꿈을 살려 보여준다.

alter table public.designers
  add column if not exists bio text;

comment on column public.designers.bio is
  '상세 화면용 긴 소개글. 목록 카드의 한 줄 소개는 one_liner 를 쓴다.';

-- 상세 화면이 길어지면 읽히지 않는다 — 입력 단계에서 막는다.
-- textarea 의 maxLength 와 같은 값을 쓴다(profile-limits.ts).
do $$
begin
  alter table public.designers
    add constraint designers_bio_len check (char_length(coalesce(bio, '')) <= 2000);
exception
  when duplicate_object then null;  -- 이미 있으면 그대로 둔다
end $$;

-- ─────────────────────────────────────────
-- 2. 작업 메타 — 클라이언트 · 연도
-- ─────────────────────────────────────────
-- 둘 다 선택 입력이다. 비워두면 상세 화면에서 해당 표기가 사라진다.

alter table public.designer_works
  add column if not exists client text;

alter table public.designer_works
  add column if not exists year    integer;

comment on column public.designer_works.client is
  '클라이언트명 또는 작업 성격(예: 개인 작업). 선택 입력.';
comment on column public.designer_works.year is
  '작업 연도. 선택 입력.';

-- 오타로 들어간 연도가 화면에 그대로 박히는 일을 막는다.
-- 상한을 고정값으로 두면 해가 바뀔 때 막히므로 넉넉히 잡는다.
do $$
begin
  alter table public.designer_works
    add constraint designer_works_year_range check (year is null or year between 1900 and 2200);
exception
  when duplicate_object then null;
end $$;

-- ─────────────────────────────────────────
-- 3. 확인용 조회
-- ─────────────────────────────────────────

select '컬럼 ' || table_name || '.' || column_name as 항목,
       '있음 ✓ (' || data_type || ')' as 상태
  from information_schema.columns
 where table_schema = 'public'
   and (  (table_name = 'designers'      and column_name = 'bio')
       or (table_name = 'designer_works' and column_name in ('client', 'year')))

union all
select '제약 ' || conname,
       case when count(*) > 0 then '있음 ✓' else '없음 ✗' end
  from pg_constraint
 where conname in ('designers_bio_len', 'designer_works_year_range')
 group by conname

order by 1;
