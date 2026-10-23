'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createDesigner } from '@/app/admin/designers/actions'
import { Field, input } from './form-bits'

export function DesignerCreateForm() {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [oneLiner, setOneLiner] = useState('')
  const [tags, setTags] = useState('')
  const [error, setError] = useState<string | null>(null)
  /* 메일이 실패하면 임시 비밀번호를 직접 전달해야 하므로 화면에 남겨둔다 */
  const [mailWarning, setMailWarning] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const router = useRouter()

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setMailWarning(null)

    start(async () => {
      const r = await createDesigner({ email, name, oneLiner, tags })
      if (!r.ok) {
        setError(r.error)
        return
      }

      if (r.mailed) {
        /* 메일이 나갔으면 바로 상세로 — 더 보여줄 것이 없다 */
        router.push(`/admin/designers/${r.id}`)
        return
      }

      setMailWarning(
        `계정은 만들어졌지만 메일 발송에 실패했습니다 (${r.mailError}). ` +
          `임시 비밀번호 ${r.tempPassword} 를 직접 전달해 주세요.`,
      )
    })
  }

  return (
    <form onSubmit={submit} className="rounded-xl bg-white p-5 ring-1 ring-neutral-200">
      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700">{error}</p>}

      {mailWarning && (
        <div className="mb-4 rounded-lg bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
          <p>{mailWarning}</p>
          <button
            type="button"
            onClick={() => router.push('/admin/designers')}
            className="mt-2 font-semibold underline"
          >
            목록으로 이동
          </button>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        <Field label="이메일" required hint="로그인 아이디">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="designer@example.com"
            className={input}
          />
        </Field>
        <Field label="이름" hint="선택">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="비워두면 디자이너가 직접 입력"
            className={input}
          />
        </Field>
        <Field label="한 줄 소개" hint="선택">
          <input
            value={oneLiner}
            onChange={(e) => setOneLiner(e.target.value)}
            placeholder="복잡한 서비스를 단정한 화면으로 정리합니다."
            className={input}
          />
        </Field>
        <Field label="전문 분야" hint="선택 · 쉼표로 구분">
          <input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="UX/UI, 브랜딩"
            className={input}
          />
        </Field>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="mt-5 rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-600 disabled:opacity-50"
      >
        {pending ? '등록 중…' : '등록하고 메일 발송'}
      </button>
    </form>
  )
}
