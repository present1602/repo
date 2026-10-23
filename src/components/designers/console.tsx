'use client'

import { useState } from 'react'
import type { AdminDesigner } from '@/lib/designer-shape'
import type { WorkRow } from '@/lib/portfolio-limits'
import { ProfileForm } from './profile-form'
import { PortfolioManager } from './portfolio-manager'
import { ChangePasswordForm } from './change-password-form'

type Tab = 'profile' | 'portfolio' | 'password'

export function DesignerConsole({
  designer,
  works,
}: {
  designer: AdminDesigner
  works: WorkRow[]
}) {
  /* 임시 비밀번호를 아직 쓰고 있으면 비밀번호 탭부터 열어준다 */
  const [tab, setTab] = useState<Tab>(designer.temp_password ? 'password' : 'profile')

  return (
    <div>
      {designer.temp_password && (
        <p className="mb-6 rounded-lg bg-amber-50 px-3.5 py-3 text-sm text-amber-800">
          아직 임시 비밀번호를 쓰고 있습니다. 먼저 비밀번호를 변경해 주세요.
        </p>
      )}

      <nav className="flex gap-1 border-b border-neutral-200">
        <TabButton on={tab === 'profile'} onClick={() => setTab('profile')}>
          프로필
        </TabButton>
        <TabButton on={tab === 'portfolio'} onClick={() => setTab('portfolio')}>
          포트폴리오 <span className="text-neutral-400">{works.length}</span>
        </TabButton>
        <TabButton on={tab === 'password'} onClick={() => setTab('password')}>
          비밀번호
        </TabButton>
      </nav>

      <div className="pt-6">
        {tab === 'profile' && <ProfileForm designer={designer} />}
        {tab === 'portfolio' && <PortfolioManager works={works} />}
        {tab === 'password' && <ChangePasswordForm onChanged={() => setTab('profile')} />}
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
