'use server'

import { revalidatePath } from 'next/cache'
import { getAdminUser } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { MAX_MENU_NAME, SITE_MENU_ITEMS, type SiteMenus } from '@/lib/site-menu-shape'

type Result = { ok: true } | { ok: false; error: string }

export async function updateSiteMenus(input: SiteMenus): Promise<Result> {
  if (!(await getAdminUser())) return { ok: false, error: '권한이 없습니다. 다시 로그인해 주세요.' }
  if (!supabaseAdmin) return { ok: false, error: '서버 설정이 완료되지 않았습니다.' }

  const rows = []
  for (const { key } of SITE_MENU_ITEMS) {
    const item = input?.[key]
    if (typeof item?.name !== 'string' || typeof item?.visible !== 'boolean') {
      return { ok: false, error: '메뉴 설정 값이 올바르지 않습니다.' }
    }
    const name = item.name.trim()
    if (!name || name.length > MAX_MENU_NAME) {
      return { ok: false, error: `메뉴 이름은 1~${MAX_MENU_NAME}자로 입력해 주세요.` }
    }
    rows.push({ key, name, visible: item.visible })
  }

  const { error } = await supabaseAdmin.from('site_menus').upsert(rows, { onConflict: 'key' })
  if (error) {
    console.error('[menus] 메뉴 저장 실패:', error.message)
    return {
      ok: false,
      error: /site_menus|schema cache/i.test(error.message)
        ? '메뉴 설정 표가 없습니다. 0029_site_menus.sql 을 실행해 주세요.'
        : '메뉴 저장에 실패했습니다. 잠시 후 다시 시도해 주세요.',
    }
  }

  revalidatePath('/', 'layout')
  return { ok: true }
}
