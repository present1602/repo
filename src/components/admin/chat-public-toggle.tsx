'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useActionTransition } from '@/lib/use-action-transition'
import { setChatPublic } from '@/app/admin/chat/actions'

/* 챗봇 공개 스위치(0023_chat.sql).

   켜기 전에는 어드민으로 로그인한 사람에게만 우하단 단추가 보인다.
   ScopePromptToggle 과 같은 모양이지만 액션이 다른 폴더에 있어 따로 둔다 —
   누르면 바로 저장한다(저장 버튼을 두면 켜 놓고 잊어 화면과 실제가 어긋난다). */
export function ChatPublicToggle({ enabled, cards }: { enabled: boolean; cards: number }) {
  const [on, setOn] = useState(enabled)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [pending, start] = useActionTransition()
  const router = useRouter()

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2500)
    return () => clearTimeout(t)
  }, [toast])

  const toggle = () => {
    const next = !on
    /* 지식이 없는 채로 켜면 '모른다' 만 하는 챗봇이 손님의 첫인상이 된다 */
    if (next && cards === 0 && !confirm('지식 카드가 아직 없습니다. 그래도 공개할까요?')) {
      return
    }

    setOn(next)
    setError(null)
    setToast(null)
    start(async () => {
      const r = await setChatPublic(next)
      if (!r.ok) {
        /* 실패하면 스위치를 되돌린다 — 켜진 채로 두면 반영된 줄 안다 */
        setOn(!next)
        setError(r.error)
        return
      }
      setToast(next ? '손님에게도 보입니다' : '어드민에게만 보입니다')
      router.refresh()
    })
  }

  return (
    <div className="rounded-xl bg-white p-5 ring-1 ring-neutral-200">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold">
            챗봇 공개
            {!on && (
              <span className="ml-2 rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-semibold text-neutral-600">
                어드민에게만
              </span>
            )}
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-neutral-500">
            끈 동안에는 어드민으로 로그인한 사람에게만 우하단 단추가 보입니다. 직접 손님처럼
            물어보며 지식을 채우고 켜세요.
            <br />
            켜면 사이트에 들어온 모두에게 보입니다.
          </p>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label="챗봇 공개"
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
