/* 자주 묻는 질문의 모양(0015_faqs.sql).

   클라이언트 컴포넌트도 이 타입을 쓰므로 server-only 모듈에 두지 않는다 —
   faqs.ts 에서 가져오면 supabase-admin(service_role) 이 브라우저 번들로 끌려온다. */

export type Faq = {
  id: string
  /* 접혀 있을 때 보이는 제목 */
  question: string
  /* 펼치면 나오는 내용. 줄바꿈을 그대로 살려 내보낸다 */
  answer: string
  sort_order: number
  /* 끄면 공개 화면에서 빠진다. 어드민 목록에는 '숨김' 으로 남는다 */
  visible: boolean
}

/* 0015 의 check 제약과 같은 길이 — 함께 고쳐야 한다 */
export const MAX_FAQ_QUESTION = 200
export const MAX_FAQ_ANSWER = 4000
