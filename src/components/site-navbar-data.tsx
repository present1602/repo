import { getPlanCopies } from '@/lib/site-settings'
import { hiddenScopes } from '@/lib/plans'
import { SCOPE_INQUIRY_TYPE } from '@/lib/inquiry-types'
import { SiteNavbar } from './site-navbar'

/* 네비바에 서버에서 읽은 값을 얹는다 — '의뢰하기' 폼에서 사이트에서 숨긴 플랜
   (038_plan_visibility.sql)을 빼려면 어느 유형이 숨었는지 알아야 한다.
   SiteNavbar 는 현재 경로를 보는 클라이언트 컴포넌트라 여기서 읽어 넘긴다. */
export async function SiteNavbarData() {
  const copies = await getPlanCopies()
  return <SiteNavbar hiddenTypes={hiddenScopes(copies).map((s) => SCOPE_INQUIRY_TYPE[s])} />
}
