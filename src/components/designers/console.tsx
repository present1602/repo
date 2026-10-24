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
}: {
  designer: AdminDesigner
  works: WorkRow[]
  planCopy: PlanCopy
}) {
  /* 임시 비밀번호를 아직 쓰고 있으면 설정 탭을 먼저 연다 —
     비밀번호 변경이 그 안에 있다(다이얼로그도 함께 열린다). */
  const temp = Boolean(designer.temp_password)
  const [tab, setTab] = useState<Tab>(temp ? 'settings' : 'profile')

  return (
    <div>
      {temp && (
        <p className="mb-6 rounded-lg bg-amber-50 px-3.5 py-3 text-sm text-amber-800">
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

      <nav className="flex gap-1 border-b border-neutral-200">
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

      <div className="pt-6">
        {tab === 'profile' && <ProfileForm designer={designer} />}
        {tab === 'portfolio' && <PortfolioManager works={works} />}
        {tab === 'settings' && (
          <SettingsPanel designer={designer} copy={planCopy} openPasswordAtFirst={temp} />
        )}
      </div>
    </div>
  )
}

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
