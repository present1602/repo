import { SiteNavbar } from './site-navbar'
import { getSiteMenus } from '@/lib/site-menus'

/* 마이그레이션 전에는 기본 메뉴를 보여준다. */
export async function SiteNavbarData() {
  const { menus } = await getSiteMenus()
  return <SiteNavbar menus={menus} />
}
