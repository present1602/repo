/* 어드민 디자이너 상세의 탭.

   서버 페이지(주소의 ?tab= 을 읽는다)와 클라이언트 화면(탭 줄을 그린다)이
   함께 쓰므로 'use client' 파일에 두지 않는다 — 거기서 내보낸 함수는
   서버에서 부를 수 없다. */

export const DESIGNER_TABS = [
  { key: 'profile', label: '프로필' },
  { key: 'portfolio', label: '포트폴리오' },
  { key: 'settings', label: '설정' },
] as const

export type DesignerTab = (typeof DESIGNER_TABS)[number]['key']

export function isDesignerTab(v: unknown): v is DesignerTab {
  return DESIGNER_TABS.some((t) => t.key === v)
}
