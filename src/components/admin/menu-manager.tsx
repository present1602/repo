'use client'

import { useState } from 'react'
import { updateSiteMenus } from '@/app/admin/menus/actions'
import { Flash, type FlashMsg } from '@/components/flash'
import { useActionTransition } from '@/lib/use-action-transition'
import { MAX_MENU_NAME, SITE_MENU_ITEMS, type SiteMenus } from '@/lib/site-menu-shape'

export function MenuManager({ menus, loadError }: { menus: SiteMenus; loadError: string | null }) {
  const [draft, setDraft] = useState(menus)
  const [saved, setSaved] = useState(menus)
  const [msg, setMsg] = useState<FlashMsg>(null)
  const [pending, start] = useActionTransition()
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved)
  const invalid = SITE_MENU_ITEMS.some(({ key }) => !draft[key].name.trim() || draft[key].name.trim().length > MAX_MENU_NAME)

  return (
    <form
      className="rounded-xl bg-white p-5 ring-1 ring-neutral-200"
      onSubmit={(e) => {
        e.preventDefault()
        if (pending || invalid || !dirty || loadError) return
        setMsg(null)
        start(async () => {
          const result = await updateSiteMenus(draft)
          if (!result.ok) {
            setMsg({ ok: false, text: result.error })
            return
          }
          const clean = Object.fromEntries(SITE_MENU_ITEMS.map(({ key }) => [key, { ...draft[key], name: draft[key].name.trim() }])) as SiteMenus
          setDraft(clean)
          setSaved(clean)
          setMsg({ ok: true, text: '저장했습니다. 상단 메뉴에 반영되었습니다.' })
        }, '메뉴 저장')
      }}
    >
      <p className="text-sm leading-relaxed text-neutral-500">
        소개·탐색·FAQ 메뉴를 관리합니다. 숨김으로 설정하면 상단 메뉴에서 빠지며, 페이지 주소로는 계속 접근할 수 있습니다.
      </p>
      {loadError && <p role="alert" className="mt-4 rounded-lg bg-amber-50 px-3.5 py-3 text-sm text-amber-800">{loadError}</p>}
      <fieldset disabled={pending || !!loadError} className="mt-5 space-y-4 disabled:opacity-60">
        {SITE_MENU_ITEMS.map(({ key, label, href }) => {
          const badName = !draft[key].name.trim() || draft[key].name.trim().length > MAX_MENU_NAME
          return (
            <div key={key} className="rounded-lg border border-neutral-200 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold">{label} <span className="ml-1 text-xs font-normal text-neutral-400">{href}</span></div>
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input type="checkbox" role="switch" aria-label={`${label} 메뉴 노출`} checked={draft[key].visible}
                    onChange={(e) => setDraft({ ...draft, [key]: { ...draft[key], visible: e.target.checked } })}
                    className="size-4 accent-violet-600" />
                  <span className={draft[key].visible ? 'text-violet-700' : 'text-neutral-400'}>{draft[key].visible ? '노출' : '숨김'}</span>
                </label>
              </div>
              <label htmlFor={`menu-${key}`} className="mb-1.5 mt-3 block text-xs font-medium text-neutral-600">메뉴 이름</label>
              <input id={`menu-${key}`} value={draft[key].name} maxLength={MAX_MENU_NAME} required
                aria-invalid={badName} aria-describedby={badName ? `menu-${key}-error` : undefined}
                onChange={(e) => setDraft({ ...draft, [key]: { ...draft[key], name: e.target.value } })}
                className="h-10 w-full rounded-lg border border-neutral-300 px-3 text-sm outline-none focus:ring-2 focus:ring-violet-500" />
              {badName && <p id={`menu-${key}-error`} className="mt-1.5 text-xs text-red-600">메뉴 이름은 1~{MAX_MENU_NAME}자로 입력해 주세요.</p>}
            </div>
          )
        })}
      </fieldset>
      <div aria-live="polite"><Flash msg={msg} onDone={() => setMsg(null)} className="mt-4" /></div>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending || !dirty || invalid || !!loadError}
          className="rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-600 disabled:opacity-40">
          {pending ? '저장 중…' : '저장'}
        </button>
        {dirty && !pending && <span className="text-xs text-neutral-400">저장하지 않은 변경이 있습니다</span>}
      </div>
    </form>
  )
}
