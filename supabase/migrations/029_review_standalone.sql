-- ════════════════════════════════════════════════════════
-- 후기 — 문의 없이도 링크를 만들 수 있게
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 Run
-- 여러 번 실행해도 안전합니다 (멱등).
-- ════════════════════════════════════════════════════════
--
-- 028 은 '플랫폼 문의(inquiries)에 달린 후기' 만 상정했다.
-- 실제로는 전화·메신저로 직접 받은 의뢰도 있고, 그때도 후기는 받아야 한다.
-- 그래서 문의 없이 어드민이 바로 링크를 만들 수 있게 연다.
--
--   문의에서 만든 링크   inquiry_id 있음 · 신원을 의뢰에서 가져온다
--   직접 만든 링크       inquiry_id 없음 · 어드민이 적은 값을 쓴다
--
-- 어느 쪽이든 후기 1건은 링크 1개에 매인다.

-- ─────────────────────────────────────────
-- 1. review_tokens — 문의 없이도 만들 수 있게
-- ─────────────────────────────────────────

alter table public.review_tokens
  alter column inquiry_id drop not null;

-- 직접 만든 링크가 들고 있을 정보.
-- 문의에서 만든 링크는 이 칸들을 비워 두고 inquiries 를 읽는다 —
-- 한곳에만 적어야 나중에 의뢰 쪽이 고쳐져도 어긋나지 않는다.
alter table public.review_tokens
  add column if not exists designer_id   uuid,
  add column if not exists designer_name text,
  add column if not exists author_name   text,
  add column if not exists author_email  text,
  -- 어드민이 "누구에게 왜 보냈는지" 적어 두는 칸. 목록에서 구분용.
  add column if not exists memo          text;

comment on column public.review_tokens.designer_id is
  '직접 만든 링크의 대상 디자이너. 문의에서 만든 링크는 비어 있고 inquiries 를 따른다.';
comment on column public.review_tokens.author_name is
  '직접 만든 링크의 작성자 이름. 문의에서 만든 링크는 비어 있다.';
comment on column public.review_tokens.memo is
  '어드민 메모. 직접 만든 링크를 목록에서 구분하는 데 쓴다.';

-- 둘 중 하나는 있어야 한다 — 의뢰에 매이거나, 작성자 이름이 적혀 있거나.
-- 아무것도 없으면 누구의 후기인지 알 수 없는 링크가 된다.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'review_tokens_origin_chk'
  ) then
    alter table public.review_tokens
      add constraint review_tokens_origin_chk
      check (inquiry_id is not null or char_length(trim(coalesce(author_name, ''))) > 0);
  end if;
end $$;

-- inquiry_id 가 null 인 행이 여럿 생기므로, 기존 unique 인덱스를
-- '문의가 있는 경우'에만 적용되도록 부분 인덱스로 바꾼다.
-- (postgres 에서 unique 는 null 을 서로 다른 값으로 보지만, 뜻을 분명히 둔다)
drop index if exists public.review_tokens_inquiry_uniq;
create unique index if not exists review_tokens_inquiry_uniq
  on public.review_tokens (inquiry_id) where inquiry_id is not null;

-- ─────────────────────────────────────────
-- 2. reviews — 문의 없이 쓴 후기도 담을 수 있게
-- ─────────────────────────────────────────

alter table public.reviews
  alter column inquiry_id drop not null;

-- inquiry_id 가 null 인 후기가 생기므로 unique 도 부분 인덱스로.
-- (028 에서 컬럼에 직접 unique 를 걸었으므로 그 제약을 떼고 다시 만든다)
alter table public.reviews drop constraint if exists reviews_inquiry_id_key;

create unique index if not exists reviews_inquiry_uniq
  on public.reviews (inquiry_id) where inquiry_id is not null;

-- 어떤 링크로 쓴 후기인지. 직접 만든 링크로 쓴 후기는 inquiry_id 가 없으므로
-- 이 값으로만 출처를 되짚을 수 있다.
-- 토큰이 지워져도 후기는 남아야 하므로 외래키를 걸지 않는다.
alter table public.reviews
  add column if not exists token uuid;

comment on column public.reviews.token is
  '후기를 쓴 링크의 토큰. 문의 없이 만든 링크의 출처를 되짚는 데 쓴다.';

create index if not exists reviews_token_idx
  on public.reviews (token) where token is not null;

-- ─────────────────────────────────────────
-- 3. 확인용 조회
-- ─────────────────────────────────────────

select 'review_tokens.inquiry_id nullable' as 항목,
       case when is_nullable = 'YES' then '예 ✓' else '아니오 ✗' end as 상태
  from information_schema.columns
 where table_schema = 'public' and table_name = 'review_tokens'
   and column_name = 'inquiry_id'

union all
select 'reviews.inquiry_id nullable',
       case when is_nullable = 'YES' then '예 ✓' else '아니오 ✗' end
  from information_schema.columns
 where table_schema = 'public' and table_name = 'reviews'
   and column_name = 'inquiry_id'

union all
select 'review_tokens.author_name 컬럼',
       case when count(*) > 0 then '있음 ✓' else '없음 ✗' end
  from information_schema.columns
 where table_schema = 'public' and table_name = 'review_tokens'
   and column_name = 'author_name'

union all
select 'reviews.token 컬럼',
       case when count(*) > 0 then '있음 ✓' else '없음 ✗' end
  from information_schema.columns
 where table_schema = 'public' and table_name = 'reviews'
   and column_name = 'token'

order by 1;
