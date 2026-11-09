/* 간편 의뢰의 예산 범위(0021_inquiry_budget.sql).

   홈·네비바에서 여는 의뢰는 1차 분야만 고르고 2차 범위는 묻지 않는다.
   범위가 없으면 금액대를 알 수 없으므로 그 자리를 이 값이 대신한다.

   선택사항이다 — 기본은 고르지 않음이고, 비워 둔 채 보낼 수 있다.
   예산을 캐물으면 아직 정하지 못한 쪽이 폼을 닫는다.

   클라이언트 폼도 이 목록을 쓰므로 server-only 모듈에 두지 않는다.
   DB check 제약(inquiries_budget_allowed)과 같은 값을 쓴다 —
   한쪽만 늘리면 저장이 조용히 거부된다. */

export const INQUIRY_BUDGETS = [
  '50만원 이하',
  '50~200만원',
  '200~1000만원',
  '1000만원 이상',
] as const

export type InquiryBudget = (typeof INQUIRY_BUDGETS)[number]

export function isInquiryBudget(v: string): v is InquiryBudget {
  return (INQUIRY_BUDGETS as readonly string[]).includes(v)
}
