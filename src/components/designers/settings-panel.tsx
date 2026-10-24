'use client'

import { useState } from 'react'
import type { AdminDesigner } from '@/lib/designer-shape'
import type { PlanCopy } from '@/lib/plans'
import { PlanForm } from './plan-form'
import { ChangePasswordDialog } from './change-password-dialog'

/* 설정 탭 — 가격 플랜과 계정 관리를 한 화면에 모은다.
   비밀번호는 자주 건드리는 값이 아니라 버튼 하나로 두고 다이얼로그에서 바꾼다. */
export function SettingsPanel({
  designer: d,
  copy,
  openPasswordAtFirst,
}: {
  designer: AdminDesigner
  copy: PlanCopy
  /* 임시 비밀번호로 들어온 경우 — 먼저 바꾸도록 다이얼로그를 띄워 둔다 */
  openPasswordAtFirst?: boolean
}) {
  const [pwOpen, setPwOpen] = useState(Boolean(openPasswordAtFirst))

  return (
    <div className="space-y-8">
      <PlanForm designer={d} copy={copy} />

      <hr className="border-neutral-200" />

      <section>
        <h2 className="text-sm font-semibold">계정</h2>
        <p className="mt-1 text-xs text-neutral-500">
          로그인에 쓰는 비밀번호를 변경합니다.
        </p>

        <div className="mt-3.5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setPwOpen(true)}
            className="rounded-lg border border-neutral-300 px-4 py-2.5 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100"
          >
            비밀번호 변경
          </button>

          {d.temp_password && (
            <span className="text-xs text-amber-700">
              아직 임시 비밀번호를 쓰고 있습니다.
            </span>
          )}
        </div>
      </section>

      {pwOpen && <ChangePasswordDialog onClose={() => setPwOpen(false)} />}
    </div>
  )
}
