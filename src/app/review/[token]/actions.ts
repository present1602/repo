'use server'

import { submitReview } from '@/lib/reviews-db'

/* 후기 저장 — 로그인 없이 토큰만으로 들어온다.

   토큰 확인은 submitReview 안에서 한 번 더 한다. 화면을 열어 둔 채
   시간이 지났거나 두 탭에서 동시에 보낼 수 있기 때문이다. */
export async function saveReview(
  token: string,
  body: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  return submitReview(token, body)
}
