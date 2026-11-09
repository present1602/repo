-- ════════════════════════════════════════════════════════
-- 개별 포함 항목 — 분야마다 한 목록(디자인만·프로젝트를 나누지 않는다)
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 Run
-- 여러 번 실행해도 안전합니다 (멱등). 0017_premium_options.sql 다음에 돌린다.
-- 코드 배포보다 먼저 돌린다 — 새 코드는 새 목록(<분야 id>)만 읽고 쓴다.
-- ════════════════════════════════════════════════════════
--
-- 지금까지 개별 항목은 분야 × 범위마다 따로였다.
--   '<분야 id>:full_design'  디자인만 의뢰
--   '<분야 id>:with_dev'     디자인 + 개발(프로젝트) 의뢰
--   '<분야 id>:sample'       메인화면 먼저 의뢰
-- 같은 분야면 디자인만이든 프로젝트든 같은 디자이너가 맡으므로 포함 항목을 나눌 까닭이 없다.
-- 이제 둘을 한 목록 '<분야 id>' 로 합친다. 메인화면 먼저 의뢰는 본계약 전에 따로 받는
-- 작은 의뢰라 '<분야 id>:sample' 그대로 둔다.
--
-- 합치는 법 — 두 목록을 새 목록에 옮겨 적는다. 같은 템플릿이 두 곳에 있으면 디자인만 쪽 숫자,
-- 같은 직접 입력 글은 한 번만. 예전 줄은 지우지 않는다 — 배포 전까지 돌고 있는 예전 코드가
-- 계속 읽는다(새 코드는 읽지 않는다). 다 바뀐 뒤 아래 맨 끝의 정리 SQL 로 지워도 된다.
--
-- 옮겨 적기는 bucket 모양 제약을 새로(_v2) 바꿀 때 한 번만 돈다 — 다시 돌려도
-- 디자이너가 새 화면에서 지운 항목이 되살아나지 않게.

-- bucket 모양 — 'common', '<분야 id>'(합친 개별 목록), '<분야 id>:<plan>'(메인 시안·예전 목록).
-- 제약을 먼저 넓혀야 새 목록을 적을 수 있다. 처음(_v2 가 없을 때)에만 옮겨 적는다.
do $$
declare
  first_run boolean := not exists (
    select 1 from pg_constraint where conname = 'designer_category_options_bucket_shape_v2'
  );
begin
  alter table public.designer_category_options drop constraint if exists designer_category_options_bucket_shape;
  alter table public.designer_category_options drop constraint if exists designer_category_options_bucket_shape_v2;
  alter table public.designer_category_options add constraint designer_category_options_bucket_shape_v2 check (
    bucket = 'common' or bucket ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(:(sample|full_design|with_dev))?$'
  );

  alter table public.designer_premium_options drop constraint if exists designer_premium_options_bucket_shape;
  alter table public.designer_premium_options add constraint designer_premium_options_bucket_shape check (
    bucket = 'common' or bucket ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(:(sample|full_design|with_dev))?$'
  );

  alter table public.designer_custom_options drop constraint if exists designer_custom_options_bucket_shape;
  alter table public.designer_custom_options add constraint designer_custom_options_bucket_shape check (
    bucket = 'common' or bucket ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(:(sample|full_design|with_dev))?$'
  );

  if first_run then
    -- 템플릿 항목(기본 단계) — 같은 템플릿이 두 곳에 있으면 디자인만 쪽 숫자
    insert into public.designer_category_options (designer_id, bucket, template_id, n)
    select distinct on (o.designer_id, split_part(o.bucket, ':', 1), o.template_id)
           o.designer_id, split_part(o.bucket, ':', 1), o.template_id, o.n
      from public.designer_category_options o
     where o.bucket ~ ':(full_design|with_dev)$'
     order by o.designer_id, split_part(o.bucket, ':', 1), o.template_id,
              case split_part(o.bucket, ':', 2) when 'full_design' then 0 else 1 end
    on conflict do nothing;

    -- 템플릿 항목(프리미엄 단계)
    insert into public.designer_premium_options (designer_id, bucket, template_id, n)
    select distinct on (o.designer_id, split_part(o.bucket, ':', 1), o.template_id)
           o.designer_id, split_part(o.bucket, ':', 1), o.template_id, o.n
      from public.designer_premium_options o
     where o.bucket ~ ':(full_design|with_dev)$'
     order by o.designer_id, split_part(o.bucket, ':', 1), o.template_id,
              case split_part(o.bucket, ':', 2) when 'full_design' then 0 else 1 end
    on conflict do nothing;

    -- 직접 입력 — 같은 글은 한 번만. 단계 체크는 어느 쪽이든 켜져 있으면 켠다
    insert into public.designer_custom_options (designer_id, bucket, text, in_basic, in_premium, created_at)
    select o.designer_id, split_part(o.bucket, ':', 1), o.text,
           bool_or(o.in_basic), bool_or(o.in_premium), min(o.created_at)
      from public.designer_custom_options o
     where o.bucket ~ ':(full_design|with_dev)$'
     group by o.designer_id, split_part(o.bucket, ':', 1), o.text;
  end if;
end $$;

comment on table public.designer_category_options is
  '디자이너의 포함 항목(기본 단계). bucket — common(공통), <분야 id>(그 분야의 본계약), <분야 id>:sample(메인화면 먼저 의뢰). <분야 id>:full_design·with_dev 는 0018 전 목록이다.';

-- 확인용 조회
select '합친 개별 목록(기본) ' || count(*) || '줄' as 항목, '✓' as 상태
  from public.designer_category_options where bucket !~ ':' and bucket <> 'common'
union all
select '합친 개별 목록(프리미엄) ' || count(*) || '줄', '✓'
  from public.designer_premium_options where bucket !~ ':' and bucket <> 'common'
union all
select '합친 직접 입력 ' || count(*) || '줄', '✓'
  from public.designer_custom_options where bucket !~ ':' and bucket <> 'common';

-- ── 정리(선택) — 새 코드를 배포하고 확인한 뒤에만. 예전 목록 줄을 지운다 ──
-- delete from public.designer_category_options where bucket ~ ':(full_design|with_dev)$';
-- delete from public.designer_premium_options  where bucket ~ ':(full_design|with_dev)$';
-- delete from public.designer_custom_options   where bucket ~ ':(full_design|with_dev)$';
