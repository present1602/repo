'use client'

import { useCallback, useTransition } from 'react'
import { unstable_rethrow } from 'next/navigation'
import { reportError } from '@/components/error-toast'

/* useTransition 그대로 쓰되, 안에서 던진 예외를 잡아 전역 에러 토스트로 넘긴다.

   서버 액션은 실패를 보통 { ok: false, error } 로 돌려주지만, 요청이 서버에 닿지
   못하거나(인터넷·1MB 한도·배포 직후) 서버가 예외로 죽으면 promise 가 거절된다.
   트랜지션 안의 거절은 에러 경계까지 올라가 화면 전체가 "This page couldn't load"
   로 바뀐다 — 저장 버튼 하나 실패로 쓰던 화면을 잃지 않게 여기서 멈춘다.

   what — 무엇을 하다 실패했는지('프로필 이미지 저장'). 토스트 제목에 들어간다.
   redirect()·notFound() 는 Next 가 처리하도록 다시 던진다. */
export function useActionTransition(): [
  boolean,
  (fn: () => void | Promise<void>, what?: string) => void,
] {
  const [pending, start] = useTransition()

  const safeStart = useCallback(
    (fn: () => void | Promise<void>, what?: string) => {
      start(async () => {
        try {
          await fn()
        } catch (err) {
          unstable_rethrow(err)
          reportError(err, what)
        }
      })
    },
    [start],
  )

  return [pending, safeStart]
}
