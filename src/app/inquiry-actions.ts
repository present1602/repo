'use server'

import { generalChoices, type CategoryChoice } from '@/lib/inquiry-choices'
import { listCategoryMetas } from '@/lib/specialties'
import { getPlanCopies } from '@/lib/site-settings'

/* 디자이너가 정해지지 않은 의뢰 폼(네비바·홈)의 선택지 — 폼을 열 때 묻는다.

   읽기만 하고 공개 화면에 이미 나가는 값(노출 분야·기본 금액)만 돌려주므로
   로그인 없이 불러도 된다. 네비바·홈은 여러 페이지에 걸려 있어 서버에서
   미리 읽어 내리면 모든 페이지가 분야 표를 기다리게 된다. */
export async function getGeneralInquiryChoices(): Promise<CategoryChoice[]> {
  const [metas, copies] = await Promise.all([listCategoryMetas(), getPlanCopies()])
  return generalChoices(metas, copies)
}
