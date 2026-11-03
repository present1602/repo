import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getDesignerUser } from '@/lib/designer-auth'
import { listWorks } from '@/lib/designers-db'
import {
  getDesignerOptionSetup,
  getDesignerPlanOptions,
  getDesignerPremiums,
  getPlanCopies,
  listOptionTemplates,
} from '@/lib/site-settings'
import { acceptsScope, SCOPES } from '@/lib/scopes'
import { PlanSetup, type SetupSlot } from '@/components/plan-setup'
import { OptionSetup } from '@/components/option-setup'
import { listCategoryMetas } from '@/lib/specialties'
import { optionCategories } from '@/lib/inquiry-choices'
import { displayName } from '@/lib/display-name'
import { LogoutButton } from '@/components/designers/logout-button'
import { DesignerConsole } from '@/components/designers/console'

export const metadata: Metadata = {
  title: '내 관리 페이지 · SOOM',
  robots: { index: false, follow: false },
}

export const instant = false

export default async function DesignerHomePage() {
  const d = await getDesignerUser()
  if (!d) redirect('/studio/login')

  const [works, planCopy, metas, templates, planOptions, premiums, optionSetup] =
    await Promise.all([
      listWorks(d.id),
      getPlanCopies(),
      listCategoryMetas(),
      listOptionTemplates({ designerId: d.id }),
      getDesignerPlanOptions(d.id),
      getDesignerPremiums(d.id),
      getDesignerOptionSetup(d.id),
    ])

  /* 기본 단계 포함 항목 — 공통 또는 의뢰 받는 분야마다(0004) */
  const options = (
    <OptionSetup
      mode="designer"
      designerId={d.id}
      setup={optionSetup}
      categories={optionCategories({ ...d, tags: d.tags ?? [] }, metas, planCopy)}
      templates={templates}
    />
  )

  /* 프리미엄 포함 항목 — 사이트에 보이고 받는 유형 중 유형 전체와 이 디자이너의
     프리미엄이 모두 켜졌을 때만(어드민이 켠다) */
  const slots = SCOPES.filter(
    (s) => planCopy[s].visible && acceptsScope(d, s) && planCopy[s].premium.enabled && premiums[s]?.enabled,
  ).map((s): SetupSlot => ({ scope: s, tier: 'premium' }))
  const planSetup = (
    <PlanSetup
      mode="designer"
      designerId={d.id}
      slots={slots}
      copies={planCopy}
      templates={templates}
      registered={planOptions}
    />
  )

  /* 비밀번호 해시는 화면으로 내려보내지 않는다 */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password_hash, ...safe } = d

  /* 이름 줄은 본문 칸 안에 들어가야 좌측 메뉴와 윗선이 맞는다 —
     콘솔이 레이아웃을 쥐고 있으므로 그려서 넘긴다. */
  const header = (
    <header className="min-w-0">
      <h1 className="text-2xl font-bold tracking-tight">{displayName(d)}</h1>
      <p className="mt-1 text-sm text-neutral-500">{d.email}</p>
    </header>
  )

  /* 로그아웃은 좌측 메뉴 맨 아래에 붙인다 — 자주 누르는 것이 아니라
     메뉴 사이에 끼면 실수로 눌리기 쉽다.

     좁은 화면에는 그 메뉴가 없어 이름 줄 옆으로 간다(console.tsx).
     폭을 메뉴 칸에서만 꽉 채운다 — 이름 옆에서 늘어나면 제목을 밀어낸다. */
  const footer = (
    <LogoutButton className="rounded-md border border-neutral-300 px-2.5 py-2 text-xs font-medium text-neutral-700 transition hover:bg-neutral-100 md:w-full" />
  )

  /* 메뉴를 화면 왼쪽 끝에 붙이려면 가운데로 모으는 컨테이너를 두지 않는다 —
     폭은 콘솔 안에서 본문에만 건다. */
  /* flex 로 둬야 안의 콘솔이 이 높이를 물려받는다 —
     그래야 좌측 메뉴가 바닥까지 늘어나 로그아웃이 아래에 붙는다 */
  return (
    <div className="flex flex-1 flex-col bg-white">
      <DesignerConsole
        designer={safe}
        works={works}
        planCopy={planCopy}
        categories={metas}
        optionSetup={options}
        planSetup={planSetup}
        header={header}
        footer={footer}
      />
    </div>
  )
}
