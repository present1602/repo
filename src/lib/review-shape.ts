/* 후기 타입(028_reviews.sql).

   클라이언트 컴포넌트도 쓰므로 server-only 모듈에 두지 않는다 —
   reviews-db.ts 에 두면 supabase-admin(service_role) 이 브라우저 번들로
   끌려온다. portfolio-limits.ts 와 같은 이유다. */

export type ReviewStatus = 'pending' | 'approved' | 'rejected'

/* 본문 길이 — DB check 제약과 같은 값을 쓴다.
   한쪽만 고치면 화면은 통과시키고 서버가 거절한다. */
export const MIN_REVIEW_BODY = 10
export const MAX_REVIEW_BODY = 2000

/* 작성 링크가 살아 있는 기간. 메일이 늦게 열릴 수 있어 넉넉히 둔다. */
export const REVIEW_TOKEN_DAYS = 30

export type ReviewRow = {
  id: string
  created_at: string
  updated_at: string

  /* 문의 없이 만든 링크로 쓴 후기는 비어 있다 */
  inquiry_id: string | null
  /* 어떤 링크로 썼는지 — 문의가 없는 후기의 출처를 되짚는 데 쓴다 */
  token: string | null

  /* 외래키가 없다 — 디자이너가 지워져도 후기는 남는다.
     그때를 위해 이름을 함께 박아 둔다. */
  designer_id: string | null
  designer_name: string | null

  author_name: string
  /* 공개 화면으로 내보내면 안 된다 — 조회 계층에서 떼어낸다 */
  author_email: string

  body: string
  /* 지금은 받지 않아 늘 null. 나중에 별점을 켤 때 쓰는 자리. */
  rating: number | null

  status: ReviewStatus
  status_at: string | null
  status_memo: string | null

  /* 클라이언트 회원가입 도입 후 채워진다. null 이면 비회원 후기. */
  client_id: string | null
  linked_at: string | null

  /* SOOM 의뢰로 올린 포트폴리오와 이을 자리. 지금은 쓰지 않는다. */
  work_id: string | null
}

/* 공개 화면에 내보내는 모양 — 이메일처럼 남에게 보이면 안 되는 값을 뺀다.
   조회 계층(reviews-db.ts)의 strip 이 이 모양으로 바꿔 내보낸다. */
export type PublicReview = {
  id: string
  created_at: string
  /* 마스킹한 이름 — '김*연' */
  author: string
  body: string
  rating: number | null
}

export type ReviewTokenRow = {
  token: string
  created_at: string
  /* 문의 없이 만든 링크는 비어 있다 */
  inquiry_id: string | null
  expires_at: string
  used_at: string | null
  sent_count: number
  last_sent_at: string | null

  /* 아래 넷은 문의 없이 만든 링크에만 채워진다(029).
     문의에 매인 링크는 비워 두고 inquiries 를 읽는다. */
  designer_id: string | null
  designer_name: string | null
  author_name: string | null
  author_email: string | null
  memo: string | null
}

/* 링크를 열었을 때 화면이 알아야 하는 것.
   왜 못 쓰는지를 구분해 알려 준다 — "잘못된 링크입니다" 하나로 뭉치면
   기간이 지난 것인지 이미 쓴 것인지 몰라 다시 보내 달라고만 한다. */
export type ReviewLinkState =
  | {
      ok: true
      /* 문의 없이 만든 링크(전화·메신저로 직접 받은 의뢰)는 비어 있다 */
      inquiryId: string | null
      designerName: string | null
      authorName: string
    }
  | { ok: false; reason: 'notfound' | 'expired' | 'used' }
