'use client'

import { useRef, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import {
  APPLICATION_FILES_BUCKET,
  APPLICATION_FILE_ACCEPT,
  APPLICATION_FILE_EXT,
  APPLICATION_FILE_KINDS,
  APPLICATION_FILE_LABELS,
  MAX_APPLICATION_FILE_BYTES,
  fileExt,
  type ApplicationFileKind,
} from '@/lib/application-shape'

/* 제안서 마지막 쪽의 지원 폼 — 이름·이메일과 이력서·포트폴리오 파일.

   파일은 서버를 거치지 않고 Storage 로 바로 올린다(app/api/apply/route.ts).
   prepare 로 받은 서명 주소에 올린 뒤 submit 으로 접수를 마친다. */

const HINTS: Record<ApplicationFileKind, string> = {
  resume: 'PDF · Word · 한글',
  portfolio: 'PDF · PPT · 이미지 · ZIP',
}

type Picked = Partial<Record<ApplicationFileKind, File>>

async function post(body: Record<string, unknown>) {
  const res = await fetch('/api/apply', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({ ok: false, error: '응답을 읽지 못했습니다.' }))
  if (!json.ok) throw new Error(json.error ?? '전송에 실패했습니다.')
  return json
}

export function ApplyForm() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [files, setFiles] = useState<Picked>({})
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  /* 봇만 채우는 숨은 칸 */
  const [trap, setTrap] = useState('')
  /* 한 번의 지원에 하나 — 실패해 다시 눌러도 같은 키라 중복 접수가 안 된다 */
  const submitKey = useRef<string | null>(null)

  const pick = (kind: ApplicationFileKind, f: File | undefined) => {
    setError(null)
    if (!f) return
    if (!APPLICATION_FILE_EXT.includes(fileExt(f.name))) {
      setError(`${APPLICATION_FILE_LABELS[kind]}: 허용되지 않는 형식입니다.`)
      return
    }
    if (f.size > MAX_APPLICATION_FILE_BYTES) {
      setError(`${APPLICATION_FILE_LABELS[kind]} 파일은 30MB를 넘을 수 없습니다.`)
      return
    }
    setFiles((p) => ({ ...p, [kind]: f }))
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const missing = APPLICATION_FILE_KINDS.find((k) => !files[k])
    if (missing) {
      setError(`${APPLICATION_FILE_LABELS[missing]} 파일을 첨부해 주세요.`)
      return
    }

    submitKey.current ??= crypto.randomUUID()
    const base = {
      submitKey: submitKey.current,
      name: name.trim(),
      email: email.trim(),
      company_website: trap,
      files: Object.fromEntries(
        APPLICATION_FILE_KINDS.map((k) => [k, { name: files[k]!.name, size: files[k]!.size }]),
      ),
    }

    setPending(true)
    try {
      const prep = await post({ ...base, step: 'prepare' })
      if (prep.skip || prep.duplicate) {
        setDone(true)
        return
      }

      const storage = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { auth: { persistSession: false } },
      ).storage.from(APPLICATION_FILES_BUCKET)

      for (const kind of APPLICATION_FILE_KINDS) {
        const { path, token } = prep.uploads[kind]
        const { error: upErr } = await storage.uploadToSignedUrl(path, token, files[kind]!, {
          contentType: files[kind]!.type || undefined,
        })
        if (upErr) {
          console.error('[apply] 업로드 실패:', upErr.message)
          throw new Error(`${APPLICATION_FILE_LABELS[kind]} 파일을 올리지 못했습니다. 다시 시도해 주세요.`)
        }
      }

      await post({ ...base, step: 'submit' })
      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : '전송에 실패했습니다.')
    } finally {
      setPending(false)
    }
  }

  if (done) {
    return (
      <div className="mt-5 border border-violet-600 bg-violet-50 px-5 py-6">
        <p className="text-[10px] tracking-[0.3em] text-violet-600">RECEIVED</p>
        <p className="mt-2 text-lg font-semibold">지원서가 접수되었습니다.</p>
        <p className="mt-1 text-sm leading-relaxed text-neutral-600">
          검토 후 입력하신 이메일로 연락드리겠습니다.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="mt-5 space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={100}
          placeholder="이름"
          autoComplete="name"
          className="h-11 w-full border border-neutral-300 bg-white px-4 text-sm outline-none transition focus:border-violet-600"
        />
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          maxLength={200}
          placeholder="이메일"
          autoComplete="email"
          className="h-11 w-full border border-neutral-300 bg-white px-4 text-sm outline-none transition focus:border-violet-600"
        />
      </div>

      {/* 봇 함정 — 사람에게는 보이지 않는다 */}
      <input
        value={trap}
        onChange={(e) => setTrap(e.target.value)}
        name="company_website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden
        className="hidden"
      />

      {/* 파일 두 개 — 이전 판의 '01 이력서 / 02 포트폴리오' 줄을 그대로 고르는 자리로 쓴다 */}
      {APPLICATION_FILE_KINDS.map((kind, i) => {
        const f = files[kind]
        return (
          <label
            key={kind}
            className={`flex cursor-pointer items-center gap-4 border px-4 py-3.5 transition md:px-5 ${
              f ? 'border-violet-600 bg-violet-50/50' : 'border-neutral-300 hover:border-neutral-400'
            }`}
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-violet-600 text-xs font-semibold text-white">
              {String(i + 1).padStart(2, '0')}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">{APPLICATION_FILE_LABELS[kind]}</span>
              <span className="block truncate text-xs text-neutral-500">
                {f ? f.name : HINTS[kind]}
              </span>
            </span>
            <span className="shrink-0 text-xs font-medium text-violet-600">
              {f ? '변경' : '파일 선택'}
            </span>
            <input
              type="file"
              accept={APPLICATION_FILE_ACCEPT}
              disabled={pending}
              onChange={(e) => {
                pick(kind, e.target.files?.[0])
                e.target.value = ''
              }}
              className="sr-only"
            />
          </label>
        )
      })}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="flex w-full items-center justify-between bg-violet-600 px-5 py-4 text-white transition hover:bg-violet-700 disabled:opacity-60"
      >
        <span className="text-[10px] tracking-[0.3em] text-violet-200">APPLY</span>
        <span className="text-base font-semibold">{pending ? '보내는 중…' : '지원서 보내기'}</span>
        <span>↗</span>
      </button>
      <p className="text-[11px] text-neutral-400">파일당 30MB까지 올릴 수 있습니다.</p>
    </form>
  )
}
