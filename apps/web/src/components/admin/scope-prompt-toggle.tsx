'use client'

import { useEffect, useState } from 'react'
import { useActionTransition } from '@/lib/use-action-transition'
import { useRouter } from 'next/navigation'
import { setScopePrompt, setShowDuration, type Result } from '@/app/admin/settings/actions'

/* 탐색의 의뢰유형 묻기 */
export function ScopePromptToggle({ enabled }: { enabled: boolean }) {
  return (
    <SettingSwitch
      title="탐색 의뢰유형 선택"
      enabled={enabled}
      save={setScopePrompt}
      toastOn="탐색 의뢰유형 선택을 켰어요"
      toastOff="탐색 의뢰유형 선택을 껐어요"
    >
      탐색에 들어오면 &lsquo;어떤 의뢰를 원하시나요?&rsquo;를 먼저 묻고, 제목 옆에 의뢰유형을
      보여줍니다.
      <br />
      끄면 둘 다 나오지 않고 디자이너 목록을 바로 보여줍니다.
    </SettingSwitch>
  )
}

/* 작업 기간 노출 — 끄면 플랜에 넣어 둔 기간이 상세 화면에 모두 나가지 않는다 */
export function ShowDurationToggle({ enabled }: { enabled: boolean }) {
  return (
    <SettingSwitch
      title="작업 기간 노출"
      enabled={enabled}
      save={setShowDuration}
      toastOn="작업 기간을 보여줘요"
      toastOff="작업 기간을 숨겼어요"
    >
      켜면 디자이너 상세의 의뢰 패널에 유형별 작업 기간(예: 3–5일)이 나갑니다.
      <br />
      끄면 아래 문구와 디자이너별로 넣어 둔 기간이 모두 나가지 않습니다.
    </SettingSwitch>
  )
}

/* 누르면 바로 저장한다. 저장 버튼을 따로 두면 켜 놓고 저장을 잊어
   화면과 실제가 어긋난다. */
function SettingSwitch({
  title,
  enabled,
  save,
  toastOn,
  toastOff,
  children,
}: {
  title: string
  enabled: boolean
  save: (on: boolean) => Promise<Result>
  toastOn: string
  toastOff: string
  children: React.ReactNode
}) {
  const [on, setOn] = useState(enabled)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [pending, start] = useActionTransition()
  const router = useRouter()

  /* 잠깐 보여주고 스스로 사라진다 — 디자이너 설정(settings-panel.tsx)과 같은 모양 */
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2500)
    return () => clearTimeout(t)
  }, [toast])

  const toggle = () => {
    const next = !on
    setOn(next)
    setError(null)
    setToast(null)
    start(async () => {
      const r = await save(next)
      if (!r.ok) {
        /* 실패하면 스위치를 되돌린다 — 켜진 채로 두면 반영된 줄 안다 */
        setOn(!next)
        setError(r.error)
        return
      }
      setToast(next ? toastOn : toastOff)
      router.refresh()
    })
  }

  return (
    <div className="rounded-xl bg-white p-5 ring-1 ring-neutral-200">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          <p className="mt-1 text-xs leading-relaxed text-neutral-500">{children}</p>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label={title}
          onClick={toggle}
          disabled={pending}
          className={`relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-60 ${
            on ? 'bg-violet-600' : 'bg-neutral-300'
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition ${
              on ? 'translate-x-5' : ''
            }`}
          />
        </button>
      </div>

      {error && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700">{error}</p>
      )}

      {toast && (
        <div
          role="status"
          className="pointer-events-none fixed inset-x-0 top-6 z-[60] flex justify-center px-4"
        >
          <p className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg">
            {toast}
          </p>
        </div>
      )}
    </div>
  )
}
