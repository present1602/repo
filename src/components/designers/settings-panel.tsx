'use client'

import { useEffect, useState } from 'react'
import type { AdminDesigner } from '@/lib/designer-shape'
import type { PlanCopies } from '@/lib/plans'
import type { CategoryMeta } from '@/lib/inquiry-choices'
import { PlanForm } from './plan-form'
import { ChangePasswordDialog } from './change-password-dialog'
import { LogoutButton } from './logout-button'

/* 설정 탭 — 가격 플랜과 계정 관리를 한 화면에 모은다.
   비밀번호는 자주 건드리는 값이 아니라 버튼 하나로 두고 다이얼로그에서 바꾼다. */
export function SettingsPanel({
  designer: d,
  copy,
  categories,
  optionSetup,
  planSetup,
  openPasswordAtFirst,
}: {
  designer: AdminDesigner
  copy: PlanCopies
  /* 어드민이 만든 분야 전부 — 메뉴에 나오는 것은 의뢰 받는 분야, 나머지는 프로필 태그로 고른다 */
  categories: CategoryMeta[]
  /* 공통·분야별 포함 항목(option-setup.tsx) — 페이지가 그려 넘긴다 */
  optionSetup?: React.ReactNode
  /* 프리미엄 포함 항목(plan-setup.tsx) — 켜진 프리미엄이 없으면 비어 있다 */
  planSetup?: React.ReactNode
  /* 임시 비밀번호로 들어온 경우 — 먼저 바꾸도록 다이얼로그를 띄워 둔다 */
  openPasswordAtFirst?: boolean
}) {
  const [pwOpen, setPwOpen] = useState(Boolean(openPasswordAtFirst))
  const [toast, setToast] = useState<string | null>(null)

  /* 잠깐 보여주고 스스로 사라진다 */
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2500)
    return () => clearTimeout(t)
  }, [toast])

  return (
    <div className="space-y-8">
      <PlanForm designer={d} copy={copy} categories={categories} />

      {optionSetup}

      {planSetup}

      <hr className="border-neutral-200" />

      <section>
        <h2 className="text-sm font-semibold">계정</h2>
        <p className="mt-1 text-xs text-neutral-500">
          로그인에 쓰는 비밀번호를 변경하거나 로그아웃합니다.
        </p>

        <div className="mt-3.5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setPwOpen(true)}
            className="rounded-lg border border-neutral-300 px-4 py-2.5 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100"
          >
            비밀번호 변경
          </button>

          <LogoutButton className="rounded-lg border border-neutral-300 px-4 py-2.5 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100" />

          {d.temp_password && (
            <span className="text-xs text-amber-700">
              아직 임시 비밀번호를 쓰고 있습니다.
            </span>
          )}
        </div>
      </section>

      {pwOpen && (
        <ChangePasswordDialog
          onClose={() => setPwOpen(false)}
          onChanged={() => {
            setPwOpen(false)
            setToast('비밀번호를 변경했습니다.')
          }}
        />
      )}

      {toast && (
        <div
          role="status"
          className="pointer-events-none fixed inset-x-0 top-6 z-[60] flex justify-center px-4"
        >
          <p className="rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white shadow-lg">
            {toast}
          </p>
        </div>
      )}
    </div>
  )
}
