'use client'

import { useEffect } from 'react'
import { REF_PARAM, rememberRef } from '@/lib/invite-link'

/* 초대 링크(?ref=)로 들어오면 코드를 남겨 둔다 — 의뢰 폼이 꺼내 보낸다(invite-link.ts).
   searchParams 를 서버에서 읽으면 상세 페이지 전체가 주소마다 따로 그려지므로 여기서 읽는다. */
export function RefCapture({ designerId }: { designerId: string }) {
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get(REF_PARAM)?.trim()
    if (code) rememberRef(designerId, code)
  }, [designerId])
  return null
}
