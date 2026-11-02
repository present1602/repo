import { SiteNavbar } from './site-navbar'

/* 네비바 자리. 의뢰 폼의 선택지(숨긴 플랜·분야)는 폼을 열 때 서버에서 받아 오므로
   (app/inquiry-actions.ts) 여기서 미리 읽을 것이 없다 — 모든 페이지가 DB 를
   기다리지 않게. 서버에서 얹을 값이 다시 생기면 여기서 읽어 넘긴다. */
export function SiteNavbarData() {
  return <SiteNavbar />
}
