'use server'

import { generalChoices, type CategoryChoice } from '@/lib/inquiry-choices'
import { listCategoryMetas } from '@/lib/specialties'
import { getPlanCopies } from '@/lib/site-settings'
import { signInquiryUpload } from '@/lib/inquiry-files'
import { getBudgetsByCategory } from '@/lib/specialty-budgets'
import type { BudgetsByCategory } from '@/lib/inquiry-budget'

/* 디자이너가 정해지지 않은 의뢰 폼(네비바·홈)의 선택지 — 폼을 열 때 묻는다.

   읽기만 하고 공개 화면에 이미 나가는 값(노출 분야·기본 금액)만 돌려주므로
   로그인 없이 불러도 된다. 네비바·홈은 여러 페이지에 걸려 있어 서버에서
   미리 읽어 내리면 모든 페이지가 분야 표를 기다리게 된다. */
export async function getGeneralInquiryChoices(): Promise<{
  choices: CategoryChoice[]
  /* 분야별 예산 구간(0022) — 구간을 둔 분야만 들어 있다 */
  budgets: BudgetsByCategory
}> {
  const [metas, copies, budgets] = await Promise.all([
    listCategoryMetas(),
    getPlanCopies(),
    getBudgetsByCategory(),
  ])
  return { choices: generalChoices(metas, copies), budgets }
}

/* 문의 첨부 업로드 주소 — 폼이 보내기 직전에 묻고, 받은 주소로 Storage 에 바로 올린다.
   로그인 없이 부른다(의뢰는 누구나 보낸다). 형식·크기는 여기서, 버킷 한도(0014)가 한 번 더 막는다 */
export async function prepareInquiryUpload(name: string, size: number) {
  return signInquiryUpload(String(name ?? ''), Number(size) || 0)
}
