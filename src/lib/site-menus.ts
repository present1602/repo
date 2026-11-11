import 'server-only'
import { connection } from 'next/server'
import { supabaseAdmin } from './supabase-admin'
import { DEFAULT_SITE_MENUS, MAX_MENU_NAME, SITE_MENU_ITEMS, type SiteMenus } from './site-menu-shape'

export async function getSiteMenus(): Promise<{ menus: SiteMenus; error: string | null }> {
  await connection()
  const menus: SiteMenus = structuredClone(DEFAULT_SITE_MENUS)
  if (!supabaseAdmin) return { menus, error: '서버 설정이 완료되지 않아 메뉴를 저장할 수 없습니다.' }

  const { data, error } = await supabaseAdmin.from('site_menus').select('key, name, visible')
  if (error) {
    console.error('[menus] 메뉴 조회 실패:', error.message)
    return {
      menus,
      error: /site_menus|schema cache/i.test(error.message)
        ? '메뉴 설정 표가 없습니다. 0029_site_menus.sql 을 실행해 주세요.'
        : '메뉴 설정을 불러오지 못했습니다. 새로고침 후 다시 시도해 주세요.',
    }
  }

  for (const item of SITE_MENU_ITEMS) {
    const row = data?.find((row) => row.key === item.key)
    if (row && typeof row.name === 'string' && row.name.trim() && row.name.length <= MAX_MENU_NAME) {
      menus[item.key] = { name: row.name.trim(), visible: row.visible !== false }
    }
  }
  return { menus, error: null }
}
