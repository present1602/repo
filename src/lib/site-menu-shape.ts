export const MAX_MENU_NAME = 20

export const SITE_MENU_ITEMS = [
  { key: 'about', href: '/about', label: '소개' },
  { key: 'explore', href: '/explore', label: '탐색' },
  { key: 'faq', href: '/faq', label: 'FAQ' },
] as const

export type SiteMenuKey = (typeof SITE_MENU_ITEMS)[number]['key']
export type SiteMenus = Record<SiteMenuKey, { name: string; visible: boolean }>

export const DEFAULT_SITE_MENUS: SiteMenus = {
  about: { name: '소개', visible: true },
  explore: { name: '탐색', visible: true },
  faq: { name: 'FAQ', visible: true },
}
