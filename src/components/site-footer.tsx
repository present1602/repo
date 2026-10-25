'use client'

import { usePathname } from 'next/navigation'
import { Footer } from './footer'

/* 푸터를 붙일지 말지 정한다.

   관리 화면(/admin, /studio)은 로그인한 사람이 일하는 자리다 —
   사업자 정보가 매번 아래 붙어 있을 이유가 없고, 스튜디오는 좌측 메뉴가
   화면 끝까지 늘어나는 구조라 푸터가 끼면 그 짜임이 깨진다.

   제안서(/designers/proposal)는 자체 쪽번호 바와 끝맺음을 가진 한 권짜리
   문서다 — 그 아래 사이트 푸터가 또 붙으면 마무리가 두 번 난다. */
const HIDDEN = ['/admin', '/studio', '/designers/proposal']

export function SiteFooter() {
  const pathname = usePathname() ?? ''

  if (HIDDEN.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return null

  return <Footer />
}
