import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getDesignerUser } from '@/lib/designer-auth'
import { listWorks } from '@/lib/designers-db'
import {
  getDesignerOptionSetup,
  getDesignerPlanDetails,
  getDesignerPlanOptions,
  getDesignerPremiums,
  getPlanCopies,
  getShowDuration,
  listOptionTemplates,
} from '@/lib/site-settings'
import { acceptsScope, SCOPES } from '@/lib/scopes'
import { DEFAULT_FULL_DESIGN_PRICE, DEFAULT_PROJECT_PRICE } from '@/lib/plans'
import { PlanSetup, type SetupSlot } from '@/components/plan-setup'
import { OptionSetup, type OptionPreview } from '@/components/option-setup'
import { listCategoryMetas } from '@/lib/specialties'
import { getOwnPrices } from '@/lib/designer-specialty-prices'
import { optionCategories } from '@/lib/inquiry-choices'
import { displayName } from '@/lib/display-name'
import { LogoutButton } from '@/components/designers/logout-button'
import { DesignerConsole } from '@/components/designers/console'

export const metadata: Metadata = {
  title: '내 관리 페이지',
  robots: { index: false, follow: false },
}

export const instant = false

export default async function DesignerHomePage() {
  const d = await getDesignerUser()
  if (!d) redirect('/studio/login')

  const [
    works,
    planCopy,
    metas,
    templates,
    planOptions,
    premiums,
    optionSetup,
    planDetails,
    showDuration,
    ownPrices,
  ] = await Promise.all([
    listWorks(d.id),
    getPlanCopies(),
    listCategoryMetas(),
    listOptionTemplates({ designerId: d.id }),
    getDesignerPlanOptions(d.id),
    getDesignerPremiums(d.id),
    getDesignerOptionSetup(d.id),
    getDesignerPlanDetails(d.id),
    getShowDuration(),
    /* 어드민이 이 디자이너에게만 적어 둔 분야 시작가(0016) — 미리보기도 공개 화면과 같은 금액이어야 한다 */
    getOwnPrices(d.id),
  ])
  /* 0004 전 계정은 범위 가격이 비어 있다 — 공개 화면(public-designers.ts)처럼 기본값으로 */
  const tagged = {
    ...d,
    tags: d.tags ?? [],
    full_design_price: d.full_design_price ?? DEFAULT_FULL_DESIGN_PRICE,
    project_price: d.project_price ?? DEFAULT_PROJECT_PRICE,
  }

  /* 기본 단계 포함 항목 — 공통 또는 의뢰 받는 분야마다(0004) */
  const options = (
    <OptionSetup
      mode="designer"
      designerId={d.id}
      setup={optionSetup}
      categories={optionCategories(tagged, metas, planCopy, { premiums, ownPrices })}
      templates={templates}
    />
  )

  /* 설정 탭 오른쪽의 상세 페이지 의뢰 패널 미리보기 — 금액·유형은 저장된 값,
     포함 항목 체크는 화면에서 고친 값(option-setup.tsx 의 OptionDraftsContext) */
  const preview: OptionPreview = {
    designerId: d.id,
    designerName: displayName(d),
    /* 미리보기는 브라우저로 넘어간다 — 가격·스위치·분야만 골라 보낸다(비밀번호 해시 등은 빼고) */
    designer: {
      tags: tagged.tags,
      design_price: tagged.design_price,
      price_max: tagged.price_max,
      full_design_price: tagged.full_design_price,
      project_price: tagged.project_price,
      scope_sample: tagged.scope_sample,
      scope_full_design: tagged.scope_full_design,
      scope_with_dev: tagged.scope_with_dev,
      own_prices: ownPrices,
    },
    metas,
    copies: planCopy,
    premiums,
    planDetails,
    showDuration,
    templates,
    planOptions,
    optionSetup,
  }

  /* 프리미엄 포함 항목 — 사이트에 보이고 받는 유형 중 유형 전체와 이 디자이너의
     프리미엄이 모두 켜졌을 때만(어드민이 켠다).
     0017 부터는 위 포함 항목 표의 PREMIUM 열이 맡는다 — 그 전(premium 이 null)에만 플랜별로 */
  const slots =
    optionSetup?.premium != null
      ? []
      : SCOPES.filter(
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
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <h1 className="text-2xl font-bold tracking-tight">{displayName(d)}</h1>
        {/* 공개 페이지로 — 숨겨져 있으면 열어도 404 라 누르지 못하게 두고 이유를 띄운다 */}
        {d.visible && d.profile_public ? (
          <Link
            href={`/designers/${d.id}`}
            target="_blank"
            rel="noopener"
            className="rounded-md border border-neutral-300 px-2.5 py-1.5 text-xs font-medium text-neutral-700 transition hover:bg-neutral-100"
          >
            공개 페이지 보기 ↗
          </Link>
        ) : (
          <span
            title={!d.visible ? '계정이 비활성이라 공개 페이지가 열리지 않습니다.' : '프로필이 숨김 상태라 공개 페이지가 열리지 않습니다.'}
            className="cursor-not-allowed rounded-md border border-neutral-200 px-2.5 py-1.5 text-xs font-medium text-neutral-400"
          >
            공개 페이지 보기 ↗
          </span>
        )}
      </div>
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
        preview={preview}
        planSetup={planSetup}
        header={header}
        footer={footer}
      />
    </div>
  )
}
