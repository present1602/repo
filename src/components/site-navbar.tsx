'use client'

import { usePathname } from 'next/navigation'
import { Navbar } from './navbar'

/* 사이트 바를 붙일지 말지 정한다(site-footer.tsx 와 같은 방침).

   제안서는 자체 바(ProposalNav)와 쪽 번호를 가진 한 권짜리 문서다 —
   위에 사이트 바가 또 붙으면 바가 둘로 겹치고, 한 장씩 멈추는
   스크롤(proposal-snap)이 쓸 높이도 그만큼 줄어든다. */
const HIDDEN = ['/designers/proposal']

export function SiteNavbar() {
  const pathname = usePathname() ?? ''

  if (HIDDEN.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return null

  return <Navbar />
}
