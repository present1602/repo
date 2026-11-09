-- 간편 의뢰의 예산 범위.
--
-- 홈·네비바에서 여는 의뢰(디자이너를 지정하지 않은 것)는 1차 분야만 고르고
-- 2차 범위는 묻지 않는다. 범위를 안 고르면 금액대를 알 수 없으므로
-- 그 자리를 예산 범위가 대신한다 — 선택사항이라 비어 있을 수 있다.
--
-- 고른 값을 그대로 담는다. 숫자 두 칸(min·max)으로 쪼개지 않는 것은
-- 화면에 다시 '50~200만원'으로 보여줘야 하고, 구간이 바뀌면 옛 접수의
-- 뜻까지 흔들리기 때문이다 — 고른 그때의 문구가 기록으로 남는 편이 낫다.

alter table public.inquiries
  add column if not exists budget text;

-- 화면이 보낸 값을 그대로 믿지 않는다 — 접수 API 도 같은 목록으로 거른다.
-- 구간을 늘릴 때는 inquiry-budget.ts 의 목록과 이 제약을 함께 고친다.
alter table public.inquiries
  drop constraint if exists inquiries_budget_allowed;

alter table public.inquiries
  add constraint inquiries_budget_allowed check (
    budget is null
    or budget in ('50만원 이하', '50~200만원', '200~1000만원', '1000만원 이상')
  );

comment on column public.inquiries.budget is
  '간편 의뢰에서 고른 예산 범위. 선택사항이라 비어 있을 수 있다(0021).';
