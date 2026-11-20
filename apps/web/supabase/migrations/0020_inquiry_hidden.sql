-- 문의 목록에서 치우기 — 줄은 지우지 않는다.
--
-- 어드민이 확인함 탭에서 '삭제'를 누르면 이 칸에 시각을 남기고
-- 목록 조회(inquiries-db.ts)에서 빼기만 한다. 문의는 들어온 기록이고
-- 첨부 파일까지 묶여 있어 되돌릴 수 없게 지우면 안 된다 —
-- 치운 건은 SQL 로 다시 꺼낼 수 있다:
--   select * from public.inquiries where hidden_at is not null order by hidden_at desc;
-- 되돌리려면: update public.inquiries set hidden_at = null where id = '...';

alter table public.inquiries
  add column if not exists hidden_at timestamptz;

-- 치운 건을 뺀 목록 조회가 표를 다 훑지 않게
create index if not exists inquiries_hidden_at_idx
  on public.inquiries (hidden_at)
  where hidden_at is null;
