/* 의뢰 유형(014_inquiry_type.sql, 031_inquiry_type_project.sql, 033_logo_design.sql).

   클라이언트 컴포넌트와 API 라우트가 함께 쓰므로 server-only 모듈에
   두지 않는다. 화면의 라디오, API 검사, DB check 제약이 모두 같은
   글자를 써야 한다 — 한 곳이라도 어긋나면 저장이 조용히 거부된다.

   코드값(design_dev 같은)이 아니라 보이는 글자를 그대로 담는다.
   코드값으로 두면 화면·메일·어드민에서 매번 한글로 옮겨야 하고,
   그 표가 여러 곳에 흩어져 어긋난다. */

export const INQUIRY_TYPES = ['메인화면 시안 먼저 의뢰', '로고 디자인', '디자인', '프로젝트 의뢰'] as const

export type InquiryType = (typeof INQUIRY_TYPES)[number]

/* 라디오 이름 아래 늘 보이는 한 줄 — 금액처럼 고르기 전에 바로 봐야 하는 것 */
export const INQUIRY_TYPE_HINTS: Record<InquiryType, string> = {
  '메인화면 시안 먼저 의뢰': '',
  '로고 디자인': '19,900원~',
  디자인: '179,000원~',
  '프로젝트 의뢰': '349,000원~',
}

/* 할인 전 금액 — 이름 아래 금액 뒤에 사선을 그어 함께 보여준다 */
export const INQUIRY_TYPE_WAS: Partial<Record<InquiryType, string>> = {
  '로고 디자인': '49,000원~',
  디자인: '399,000원~',
  '프로젝트 의뢰': '990,000원~',
}

/* 이름 옆 정보 아이콘을 눌러야 보이는 설명 — 무엇을 맡기는지 풀어 쓴 글 */
export const INQUIRY_TYPE_TIPS: Record<InquiryType, string> = {
  '메인화면 시안 먼저 의뢰': '',
  '로고 디자인': '로고 디자인을 의뢰합니다.',
  디자인: '디자인 전체 작업을 의뢰합니다.',
  '프로젝트 의뢰': '디자인, 개발(+기획) 전체 프로젝트를 의뢰합니다.',
}

export function isInquiryType(v: string): v is InquiryType {
  return (INQUIRY_TYPES as readonly string[]).includes(v)
}
  