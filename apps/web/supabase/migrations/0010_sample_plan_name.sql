-- ════════════════════════════════════════════════════════
-- 메인화면 시안 의뢰 이름 → '메인화면 먼저 의뢰'
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 Run
-- 여러 번 실행해도 안전합니다 (멱등). 0009_designer_images_50mb.sql 다음에 돌린다.
-- ════════════════════════════════════════════════════════
--
-- 공개 화면의 의뢰 유형 목록에 '<분야> + 이름'으로 나온다(예: 모바일앱 메인화면 먼저 의뢰).
-- 어드민이 문구를 직접 고쳐 둔 경우는 건드리지 않는다 — 예전 기본값일 때만 바꾼다.
-- 코드의 기본값(src/lib/plans.ts 의 FALLBACK_PLAN_COPIES)도 같은 이름으로 맞춘다.

update plan_copy
  set name = '메인화면 먼저 의뢰'
  where plan = 'sample' and tier = 'basic'
    and name in ('메인화면 우선 의뢰', '메인화면 의뢰');

update plan_copy
  set name = '메인화면 먼저 의뢰 프리미엄'
  where plan = 'sample' and tier = 'premium'
    and name in ('메인화면 우선 의뢰 프리미엄', '메인화면 의뢰 프리미엄');
