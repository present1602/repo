-- ════════════════════════════════════════════════════════
-- 플랜 노출 / 숨김 — 플랜마다 사이트 전체에서 켜고 끈다
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 Run
-- 여러 번 실행해도 안전합니다 (멱등). 036·037 다음에 돌린다.
-- ════════════════════════════════════════════════════════
--
-- 숨긴 플랜은 공개 화면 어디에도 나가지 않는다 — 디자이너 상세의 의뢰 패널,
-- 의뢰 폼의 유형, 탐색 필터·'어떤 의뢰를 원하시나요?', 디자이너 스튜디오.
-- 디자이너별 설정(받는지·가격·포함 항목)은 지우지 않는다 — 다시 노출하면 돌아온다.
--
-- 기본 줄(tier = 'basic')의 값만 쓴다. 프리미엄 줄은 따로 숨기지 않는다 —
-- 플랜을 숨기면 그 프리미엄도 함께 빠진다.

alter table public.plan_copy
  add column if not exists visible boolean not null default true;

comment on column public.plan_copy.visible is
  '기본 줄: 이 플랜을 사이트에 보여주는지. 끄면 공개 화면 어디에도 나가지 않는다. 프리미엄 줄: 쓰지 않는다.';

-- 확인용 조회
select plan, visible
  from public.plan_copy
 where tier = 'basic'
 order by plan;
