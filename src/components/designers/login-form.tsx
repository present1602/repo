'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { login } from '@/app/studio/actions'

export function DesignerLoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const router = useRouter()

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    start(async () => {
      const r = await login(email, password)
      if (!r.ok) {
        setError(r.error)
        return
      }
      /* 쿠키가 막 심어졌으므로 서버 쪽을 다시 읽게 한다 */
      router.refresh()
      router.replace('/studio')
    })
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      {error && <p className="rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700">{error}</p>}

      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-neutral-600">이메일</span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          className={input}
        />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-neutral-600">비밀번호</span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
          className={input}
        />
      </label>

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-neutral-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-600 disabled:opacity-50"
      >
        {pending ? '로그인 중…' : '로그인'}
      </button>
    </form>
  )
}

const input =
  'h-10 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm outline-none ring-indigo-500 focus:ring-2'
