'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updatePassword } from '@/app/studio/actions'

export function ChangePasswordForm({ onChanged }: { onChanged?: () => void }) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [pending, start] = useTransition()
  const router = useRouter()

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setMsg(null)

    if (next !== confirm) {
      setMsg({ ok: false, text: '새 비밀번호가 서로 다릅니다.' })
      return
    }

    start(async () => {
      const r = await updatePassword(current, next)
      if (!r.ok) {
        setMsg({ ok: false, text: r.error })
        return
      }
      setCurrent('')
      setNext('')
      setConfirm('')
      /* 임시 비밀번호 안내 배너가 사라져야 한다 */
      router.refresh()
      /* 띄운 쪽이 알림을 맡으면(다이얼로그를 닫고 토스트) 여기서는 띄우지 않는다 */
      if (onChanged) onChanged()
      else setMsg({ ok: true, text: '비밀번호를 변경했습니다.' })
    })
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      {msg && (
        <p
          className={`rounded-lg px-3 py-2.5 text-sm ${
            msg.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'
          }`}
        >
          {msg.text}
        </p>
      )}

      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-neutral-600">현재 비밀번호</span>
        <input
          type="password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          required
          autoComplete="current-password"
          className={input}
        />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-neutral-600">
          새 비밀번호 <span className="font-normal text-neutral-400">(8자 이상)</span>
        </span>
        <input
          type="password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          required
          minLength={8}
          autoComplete="new-password"
          className={input}
        />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-neutral-600">새 비밀번호 확인</span>
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          minLength={8}
          autoComplete="new-password"
          className={input}
        />
      </label>

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-600 disabled:opacity-50"
      >
        {pending ? '변경 중…' : '비밀번호 변경'}
      </button>
    </form>
  )
}

const input =
  'h-10 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm outline-none ring-violet-500 focus:ring-2'
