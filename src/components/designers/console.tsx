'use client'

import { useState } from 'react'
import type { AdminDesigner } from '@/lib/designer-shape'
import type { WorkRow } from '@/lib/portfolio-limits'
import type { PlanCopy } from '@/lib/plans'
import { ProfileForm } from './profile-form'
import { PortfolioManager } from './portfolio-manager'
import { SettingsPanel } from './settings-panel'

type Tab = 'profile' | 'portfolio' | 'settings'

export function DesignerConsole({
  designer,
  works,
  planCopy,
  specialties,
  header,
  footer,
}: {
  designer: AdminDesigner
  works: WorkRow[]
  planCopy: PlanCopy
  /* 고를 수 있는 전문 분야 — 어드민이 켜 둔 것만 온다(011_specialties.sql) */
  specialties: string[]
  /* 이름 줄. 본문 칸 안에 들어가야 좌측 메뉴와 윗선이 맞는다 —
     페이지에서 그려 넘긴다(서버에서 받은 값을 쓰는 부분이 섞여 있다). */
  header: React.ReactNode
  /* 좌측 메뉴 맨 아래에 붙는 것(로그아웃). 폼 action 이라 서버에서 만든다. */
  footer: React.ReactNode
}) {
  /* 임시 비밀번호를 아직 쓰고 있으면 설정 탭을 먼저 연다 —
     비밀번호 변경이 그 안에 있다(다이얼로그도 함께 열린다). */
  const temp = Boolean(designer.temp_password)
  const [tab, setTab] = useState<Tab>(temp ? 'settings' : 'profile')

  return (
    /* 어드민(admin/layout.tsx)과 같은 짜임 — 메뉴를 화면 왼쪽 끝에 붙이고
       본문만 가운데로 모은다. 메뉴까지 가운데 묶음에 넣으면 넓은 화면에서
       화면 한복판에 떠 있게 된다. */
    <div className="flex flex-1">
      {/* 좁은 화면에서는 세로 메뉴가 본문을 다 밀어내므로 숨기고,
          대신 본문 위에 가로 탭을 띄운다(아래 MobileTabs). */}
      <aside className="hidden w-48 shrink-0 flex-col border-r border-neutral-200 bg-white p-4 md:flex">
        <nav className="flex flex-col gap-0.5">
          <TabButton on={tab === 'profile'} onClick={() => setTab('profile')}>
            프로필
          </TabButton>
          <TabButton on={tab === 'portfolio'} onClick={() => setTab('portfolio')}>
            포트폴리오 <span className="text-neutral-400">{works.length}</span>
          </TabButton>
          <TabButton on={tab === 'settings'} onClick={() => setTab('settings')}>
            설정
          </TabButton>
        </nav>

        {/* mt-auto 로 남은 공간을 밀어내 맨 아래에 붙인다 */}
        <div className="mt-auto pt-6">{footer}</div>
      </aside>

      <main className="min-w-0 flex-1">
        <div className="mx-auto max-w-4xl px-5 py-8 md:px-8 md:py-10">
          {/* 좁은 화면에는 좌측 메뉴가 없어 로그아웃이 갈 곳이 없다 —
              이름 줄 옆에 둔다. 넓은 화면에서는 사이드바 아래에만 있다. */}
          <div className="flex items-start justify-between gap-3">
            {header}
            <div className="shrink-0 md:hidden">{footer}</div>
          </div>

          {temp && (
            <p className="mt-6 rounded-lg bg-amber-50 px-3.5 py-3 text-sm text-amber-800">
              아직 임시 비밀번호를 쓰고 있습니다. 먼저{' '}
              <button
                onClick={() => setTab('settings')}
                className="font-semibold underline underline-offset-2"
              >
                설정
              </button>
              에서 비밀번호를 변경해 주세요.
            </p>
          )}

          {/* 좁은 화면용 가로 탭 */}
          <nav className="mt-6 flex gap-1 border-b border-neutral-200 md:hidden">
            <MobileTab on={tab === 'profile'} onClick={() => setTab('profile')}>
              프로필
            </MobileTab>
            <MobileTab on={tab === 'portfolio'} onClick={() => setTab('portfolio')}>
              포트폴리오 <span className="text-neutral-400">{works.length}</span>
            </MobileTab>
            <MobileTab on={tab === 'settings'} onClick={() => setTab('settings')}>
              설정
            </MobileTab>
          </nav>

          <div className="mt-6 md:mt-8">
            {tab === 'profile' && (
              <ProfileForm designer={designer} options={specialties} />
            )}
            {tab === 'portfolio' && <PortfolioManager works={works} />}
            {tab === 'settings' && (
              <SettingsPanel designer={designer} copy={planCopy} openPasswordAtFirst={temp} />
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

/* 좌측 세로 메뉴의 한 칸 */
function TabButton({
  on,
  onClick,
  children,
}: {
  on: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      aria-current={on ? 'page' : undefined}
      className={`rounded-md px-2.5 py-2 text-left text-sm font-medium transition ${
        on ? 'bg-neutral-900 text-white' : 'text-neutral-600 hover:bg-neutral-100'
      }`}
    >
      {children}
    </button>
  )
}

/* 좁은 화면용 밑줄 탭 */
function MobileTab({
  on,
  onClick,
  children,
}: {
  on: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      aria-current={on ? 'page' : undefined}
      /* 밑줄이 테두리 위에 겹치도록 -1px 내린다 */
      className={`-mb-px border-b-2 px-3 py-2.5 text-sm font-medium transition ${
        on
          ? 'border-neutral-900 text-neutral-900'
          : 'border-transparent text-neutral-500 hover:text-neutral-800'
      }`}
    >
      {children}
    </button>
  )
}
