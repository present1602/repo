-- ════════════════════════════════════════════════════════
-- 디자이너 초대 링크 — 디자이너가 직접 데려온 고객의 의뢰를 가린다
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 Run
-- 여러 번 실행해도 안전합니다 (멱등). 0005_custom_options.sql 다음에 돌린다.
-- ════════════════════════════════════════════════════════
--
-- 디자이너마다 짧은 링크(/r/{ref_code})가 하나씩 있다 — 열면 /designers/{id}?ref={ref_code} 로
-- 넘어간다. 그 링크로 들어온 고객이 그 디자이너에게 의뢰하면 inquiries.via_ref 가 true 가 된다 — 어드민은 다른
-- 디자이너에게 넘기지 않고 그 디자이너에게 전달하고, 본계약이 되면 섭외 보너스를 준다.
--
-- 가입용 초대코드(designer_invites)와는 다른 것이다 — 섞이지 않게 이름을 ref 로 둔다.
--
-- 1. designers.ref_code — 추측하기 어려운 8자리(소문자·숫자). 새 디자이너도 기본값으로 자동으로 받는다.
-- 2. inquiries.via_ref — 서버가 코드를 그 디자이너 것과 맞춰 본 뒤에만 true.

alter table public.designers
  add column if not exists ref_code text
  default substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);

-- 칸이 이미 있었으면 기본값만 바꾼다(위 줄은 건너뛴다)
alter table public.designers
  alter column ref_code set default substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);

-- 칸이 이미 있었는데 비어 있는 행이 있으면 채운다
update public.designers
   set ref_code = substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)
 where ref_code is null;

alter table public.designers
  alter column ref_code set not null;

alter table public.designers
  drop constraint if exists designers_ref_code_key;

alter table public.designers
  add constraint designers_ref_code_key unique (ref_code);

comment on column public.designers.ref_code is
  '고객 초대 링크 코드(0006). 가입 초대코드(designer_invites)와 다르다.';

alter table public.inquiries
  add column if not exists via_ref boolean not null default false;

comment on column public.inquiries.via_ref is
  '그 디자이너의 초대 링크로 들어와 그 디자이너에게 보낸 의뢰(0006). 섭외 보너스 대상 후보.';

-- 확인용 조회
select '디자이너 초대 코드' as 항목,
       case when count(*) = 0 then '모두 있음 ✓' else count(*) || '명 비어 있음 ✗' end as 상태
  from public.designers
 where ref_code is null
union all
select '의뢰 초대 표시 칸',
       case when count(*) = 1 then '있음 ✓' else '없음 ✗' end
  from information_schema.columns
 where table_schema = 'public' and table_name = 'inquiries' and column_name = 'via_ref';
