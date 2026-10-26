'use client'

import { useLayoutEffect, useRef, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import {
  APPLICATION_FILES_BUCKET,
  APPLICATION_FILE_ACCEPT,
  APPLICATION_FILE_EXT,
  MAX_APPLICATION_FILE_BYTES,
  MAX_INTRO,
  fileExt,
  isHttpUrl,
  type ApplicationFileKind,
} from '@/lib/application-shape'

/* 디자이너 신청 폼(designers/apply).

   제안서 v1-3 의 지원 폼(proposal/apply-form.tsx)과 같은 접수 API 를 쓰되,
   두 가지를 파일 대신 글로 낼 수 있다 —
     이력서     파일  또는  짧은 자기소개(500자)
     포트폴리오  파일  또는  URL
   파일은 서버를 거치지 않고 Storage 로 바로 올린다(app/api/apply/route.ts). */

type ResumeMode = 'file' | 'intro'
type PortfolioMode = 'file' | 'url'

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

const INPUT =
  'w-full rounded-lg border border-neutral-300 bg-white px-3.5 text-sm outline-none ring-violet-500 transition focus:ring-2'

export function DesignerApplyForm() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [resumeMode, setResumeMode] = useState<ResumeMode>('file')
  const [portfolioMode, setPortfolioMode] = useState<PortfolioMode>('file')
  const [resume, setResume] = useState<File | null>(null)
  const [intro, setIntro] = useState('')
  const [portfolio, setPortfolio] = useState<File | null>(null)
  const [url, setUrl] = useState('')
  const [trap, setTrap] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  /* 한 번의 신청에 하나 — 실패해 다시 눌러도 같은 키라 중복 접수가 안 된다 */
  const submitKey = useRef<string | null>(null)

  /* 접수를 마치고 떠나면 처음 상태로 되돌린다.

     cacheComponents 는 떠난 페이지를 지우지 않고 숨겨 두었다가(React Activity)
     돌아오면 그대로 보여준다 — 그대로 두면 다시 들어와도 '접수되었습니다'만
     남는다. 숨겨질 때 정리 함수가 돌므로 거기서 비운다.
     접수 전에 쓰던 내용은 남긴다 — 잠깐 다른 화면을 보고 와도 잃지 않게. */
  useLayoutEffect(() => {
    if (!done) return
    return () => {
      setName('')
      setEmail('')
      setResumeMode('file')
      setPortfolioMode('file')
      setResume(null)
      setIntro('')
      setPortfolio(null)
      setUrl('')
      setError(null)
      setDone(false)
      submitKey.current = null
    }
  }, [done])

  /* 고를 때 바로 거른다 — 올리기를 눌러서야 알면 다시 고르러 가야 한다 */
  const pick = (label: string, f: File | undefined, set: (f: File) => void) => {
    setError(null)
    if (!f) return
    if (!APPLICATION_FILE_EXT.includes(fileExt(f.name))) {
      setError(`${label}: 허용되지 않는 형식입니다.`)
      return
    }
    if (f.size > MAX_APPLICATION_FILE_BYTES) {
      setError(`${label} 파일은 30MB를 넘을 수 없습니다.`)
      return
    }
    set(f)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    /* 고른 쪽 값만 보낸다 — 라디오를 바꾸기 전에 넣어 둔 값이 함께 가지 않게 */
    const files: Partial<Record<ApplicationFileKind, File>> = {}
    if (resumeMode === 'file') {
      if (!resume) return setError('이력서(자기소개서) 파일을 첨부해 주세요.')
      files.resume = resume
    } else if (!intro.trim()) {
      return setError('짧은 자기소개를 적어 주세요.')
    }
    if (portfolioMode === 'file') {
      if (!portfolio) return setError('포트폴리오 파일을 첨부해 주세요.')
      files.portfolio = portfolio
    } else if (!isHttpUrl(url.trim())) {
      return setError('포트폴리오 주소를 확인해 주세요. (http:// 또는 https://로 시작)')
    }

    submitKey.current ??= crypto.randomUUID()
    const kinds = Object.keys(files) as ApplicationFileKind[]
    const base = {
      submitKey: submitKey.current,
      name: name.trim(),
      email: email.trim(),
      company_website: trap,
      intro: resumeMode === 'intro' ? intro.trim() : '',
      portfolioUrl: portfolioMode === 'url' ? url.trim() : '',
      files: Object.fromEntries(kinds.map((k) => [k, { name: files[k]!.name, size: files[k]!.size }])),
    }

    setPending(true)
    try {
      /* 올릴 파일이 있을 때만 업로드 주소를 받는다 */
      if (kinds.length > 0) {
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

        for (const k of kinds) {
          const { path, token } = prep.uploads[k]
          const { error: upErr } = await storage.uploadToSignedUrl(path, token, files[k]!, {
            contentType: files[k]!.type || undefined,
          })
          if (upErr) {
            console.error('[apply] 업로드 실패:', upErr.message)
            throw new Error('파일을 올리지 못했습니다. 다시 시도해 주세요.')
          }
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
      <div className="rounded-xl border border-violet-200 bg-violet-50 px-5 py-8 text-center">
        <p className="text-lg font-semibold">신청이 접수되었습니다.</p>
        <p className="mt-1.5 text-sm leading-relaxed text-neutral-600">
          검토 후 입력하신 이메일로 연락드리겠습니다.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="space-y-7">
      {/* 연락받을 곳 — 결과를 알려 드릴 길이 이것뿐이다 */}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-neutral-600">이름</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={100}
            autoComplete="name"
            className={`${INPUT} h-10`}
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-neutral-600">이메일</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            maxLength={200}
            autoComplete="email"
            className={`${INPUT} h-10`}
          />
        </label>
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

      <fieldset>
        <legend className="text-sm font-semibold">이력서</legend>
        <Choice
          name="resume-mode"
          value={resumeMode}
          onChange={setResumeMode}
          options={[
            ['file', '이력서(자기소개서) 업로드'],
            ['intro', '짧은 자기소개'],
          ]}
        />
        {resumeMode === 'file' ? (
          <FilePick
            file={resume}
            hint="PDF · Word · 한글"
            disabled={pending}
            onPick={(f) => pick('이력서', f, setResume)}
          />
        ) : (
          <div className="mt-3">
            <textarea
              value={intro}
              onChange={(e) => setIntro(e.target.value)}
              maxLength={MAX_INTRO}
              rows={6}
              placeholder="경력, 주로 하는 작업, 쓰는 도구 등을 자유롭게 적어 주세요."
              className={`${INPUT} resize-none py-2.5 leading-relaxed`}
            />
            <p className="mt-1 text-right text-xs text-neutral-400">
              {intro.length} / {MAX_INTRO}
            </p>
          </div>
        )}
      </fieldset>

      <fieldset>
        <legend className="text-sm font-semibold">포트폴리오</legend>
        <Choice
          name="portfolio-mode"
          value={portfolioMode}
          onChange={setPortfolioMode}
          options={[
            ['file', '파일 첨부'],
            ['url', 'URL'],
          ]}
        />
        {portfolioMode === 'file' ? (
          <FilePick
            file={portfolio}
            hint="PDF · PPT · 이미지 · ZIP"
            disabled={pending}
            onPick={(f) => pick('포트폴리오', f, setPortfolio)}
          />
        ) : (
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            maxLength={500}
            placeholder="https://"
            className={`${INPUT} mt-3 h-10`}
          />
        )}
      </fieldset>

      {error && <p className="rounded-lg bg-red-50 px-3.5 py-2.5 text-sm text-red-700">{error}</p>}

      <div>
        <button
          type="submit"
          disabled={pending}
          className="h-11 w-full rounded-lg bg-violet-600 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:opacity-60"
        >
          {pending ? '보내는 중…' : '신청하기'}
        </button>
        <p className="mt-2 text-center text-xs text-neutral-400">파일은 30MB까지 올릴 수 있습니다.</p>
      </div>
    </form>
  )
}

/* 둘 중 하나를 고르는 라디오 — 나란히 놓은 두 칸 */
function Choice<T extends string>({
  name,
  value,
  onChange,
  options,
}: {
  name: string
  value: T
  onChange: (v: T) => void
  options: [T, string][]
}) {
  return (
    <div className="mt-2.5 grid grid-cols-2 gap-2">
      {options.map(([v, label]) => (
        <label
          key={v}
          className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition ${
            value === v
              ? 'border-violet-600 bg-violet-50 font-medium text-violet-800'
              : 'border-neutral-300 text-neutral-700 hover:bg-neutral-50'
          }`}
        >
          <input
            type="radio"
            name={name}
            checked={value === v}
            onChange={() => onChange(v)}
            className="accent-violet-600"
          />
          {label}
        </label>
      ))}
    </div>
  )
}

/* 파일 고르는 칸 — 고른 뒤에는 파일 이름을 보여준다 */
function FilePick({
  file,
  hint,
  disabled,
  onPick,
}: {
  file: File | null
  hint: string
  disabled: boolean
  onPick: (f: File | undefined) => void
}) {
  return (
    <label
      className={`mt-3 flex cursor-pointer items-center gap-3 rounded-lg border border-dashed px-4 py-3.5 transition ${
        file ? 'border-violet-400 bg-violet-50/50' : 'border-neutral-300 hover:border-neutral-400'
      }`}
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{file ? file.name : '파일 선택'}</span>
        <span className="block text-xs text-neutral-500">{hint}</span>
      </span>
      <span className="shrink-0 text-xs font-medium text-violet-600">{file ? '변경' : '찾아보기'}</span>
      <input
        type="file"
        accept={APPLICATION_FILE_ACCEPT}
        disabled={disabled}
        onChange={(e) => {
          onPick(e.target.files?.[0])
          e.target.value = ''
        }}
        className="sr-only"
      />
    </label>
  )
}
