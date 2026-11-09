/* 간편 의뢰의 예산 범위(0021_inquiry_budget.sql · 0022_specialty_budgets.sql).

   홈·네비바에서 여는 의뢰는 1차 분야만 고르고 2차 범위는 묻지 않는다.
   범위가 없으면 금액대를 알 수 없으므로 그 자리를 이 값이 대신한다.

   구간은 분야마다 다르다(앱은 300만원, 이커머스는 200만원이 경계다) —
   고정 목록이 아니라 어드민이 분야마다 적는다(설정 > 기본 설정 > 전문 분야).
   줄이 없는 분야는 예산을 아예 묻지 않는다.

   선택사항이다 — 기본은 고르지 않음이고, 비워 둔 채 보낼 수 있다.
   예산을 캐물으면 아직 정하지 못한 쪽이 폼을 닫는다.

   클라이언트 폼도 이 타입을 쓰므로 server-only 모듈에 두지 않는다. */

/* 구간 한 줄 — 화면에 그대로 나가고 inquiries.budget 에 그대로 담긴다 */
export type BudgetChoice = {
  id: string
  label: string
  sort_order: number
}

/* 분야 이름 → 그 분야의 구간들. 비었거나 없는 분야는 묻지 않는다 */
export type BudgetsByCategory = Record<string, BudgetChoice[]>

/* 적을 수 있는 구간 문구의 길이 — DB check(specialty_budgets_label_len)와 같은 값 */
export const BUDGET_LABEL_MAX = 40

/* 한 분야에 둘 수 있는 구간 수 — 폼에서 고르는 칸이라 길어지면 읽기 어렵다 */
export const BUDGET_MAX_PER_CATEGORY = 8
