/* 의뢰 유형(014_inquiry_type.sql).

   클라이언트 컴포넌트와 API 라우트가 함께 쓰므로 server-only 모듈에
   두지 않는다. 화면의 라디오, API 검사, DB check 제약이 모두 같은
   글자를 써야 한다 — 한 곳이라도 어긋나면 저장이 조용히 거부된다.

   코드값(design_dev 같은)이 아니라 보이는 글자를 그대로 담는다.
   코드값으로 두면 화면·메일·어드민에서 매번 한글로 옮겨야 하고,
   그 표가 여러 곳에 흩어져 어긋난다. */

export const INQUIRY_TYPES = ['디자인 + 개발', '디자인', '메인화면 시안 먼저 의뢰'] as const

export type InquiryType = (typeof INQUIRY_TYPES)[number]

/* 라디오마다 한 줄 설명 — 무엇을 고르는지 이름만으로는 갈리지 않는다 */
export const INQUIRY_TYPE_HINTS: Record<InquiryType, string> = {
  '디자인 + 개발': '화면 디자인부터 실제 구현까지 함께 맡깁니다.',
  디자인: '디자인 결과물만 받습니다.',
  '메인화면 시안 먼저 의뢰': '',
}

export function isInquiryType(v: string): v is InquiryType {
  return (INQUIRY_TYPES as readonly string[]).includes(v)
}
