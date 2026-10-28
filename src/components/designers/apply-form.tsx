'use client'

import { Fragment, useLayoutEffect, useRef, useState } from 'react'
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
   둘 다 파일 또는 URL 로 낸다 —
     포트폴리오  필수
     기타 자료   선택 — 이력서·자소서 등 지원자를 소개할 자료. 파일·URL·직접 입력
                (파일은 resume, 직접 입력은 intro 칸에 담는다)
   파일은 서버를 거치지 않고 Storage 로 바로 올린다(app/api/apply/route.ts). */

type Mode = 'file' | 'url'
/* 기타 자료는 직접 적을 수도 있다 */
type ExtraMode = Mode | 'text'

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
  const [portfolioMode, setPortfolioMode] = useState<Mode>('file')
  const [portfolio, setPortfolio] = useState<File | null>(null)
  const [url, setUrl] = useState('')
  /* 기타 자료 — 선택 */
  const [extraMode, setExtraMode] = useState<ExtraMode>('file')
  const [extra, setExtra] = useState<File | null>(null)
  const [extraUrl, setExtraUrl] = useState('')
  const [extraText, setExtraText] = useState('')
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
      setPortfolioMode('file')
      setPortfolio(null)
      setUrl('')
      setExtraMode('file')
      setExtra(null)
      setExtraUrl('')
      setExtraText('')
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
    if (portfolioMode === 'file') {
      if (!portfolio) return setError('포트폴리오 파일을 첨부해 주세요.')
      files.portfolio = portfolio
    } else if (!isHttpUrl(url.trim())) {
      return setError('포트폴리오 주소를 확인해 주세요. (http:// 또는 https://로 시작)')
    }
    /* 기타 자료는 비워도 된다 — 적었을 때만 확인한다 */
    const extraLink = extraMode === 'url' ? extraUrl.trim() : ''
    if (extraMode === 'file' && extra) files.resume = extra
    if (extraLink && !isHttpUrl(extraLink)) {
      return setError('기타 자료 주소를 확인해 주세요. (http:// 또는 https://로 시작)')
    }

    submitKey.current ??= crypto.randomUUID()
    const kinds = Object.keys(files) as ApplicationFileKind[]
    const base = {
      submitKey: submitKey.current,
      name: name.trim(),
      email: email.trim(),
      company_website: trap,
      portfolioUrl: portfolioMode === 'url' ? url.trim() : '',
      resumeUrl: extraLink,
      intro: extraMode === 'text' ? extraText.trim() : '',
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
        <legend className="text-sm font-semibold">
          포트폴리오 <span className="text-violet-600">*</span>
        </legend>
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

      <fieldset>
        <legend className="text-sm font-semibold">
          기타 <span className="font-normal text-neutral-400">(선택)</span>
        </legend>
        <p className="mt-1 text-xs leading-relaxed text-neutral-500">
          포트폴리오 외 지원자님을 소개해 줄 수 있는 자료가 있다면 자유롭게 첨부해 주세요.<br/>
          (이력서, 자소서 등 첨부해 주셔도 좋아요)
        </p>
        <Choice
          name="extra-mode"
          value={extraMode}
          onChange={setExtraMode}
          options={[
            ['file', '파일 첨부'],
            ['url', 'URL'],
            ['text', '직접 입력할게요'],
          ]}
        />
        {extraMode === 'text' ? (
          <div className="mt-3">
            <textarea
              value={extraText}
              onChange={(e) => setExtraText(e.target.value)}
              maxLength={MAX_INTRO}
              rows={6}
              placeholder="경력, 주로 하는 작업, 쓰는 도구 등을 자유롭게 적어 주세요."
              className={`${INPUT} resize-none py-2.5 leading-relaxed`}
            />
            <p className="mt-1 text-right text-xs text-neutral-400">
              {extraText.length} / {MAX_INTRO}
            </p>
          </div>
        ) : extraMode === 'file' ? (
          <FilePick
            file={extra}
            hint="PDF · Word · 한글 · 이미지 · ZIP"
            disabled={pending}
            onPick={(f) => pick('기타 자료', f, setExtra)}
          />
        ) : (
          <input
            type="url"
            value={extraUrl}
            onChange={(e) => setExtraUrl(e.target.value)}
            maxLength={500}
            placeholder="https:// (노션·구글 드라이브·링크드인 등)"
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

/* 선택지 아이콘 — 값의 종류마다 하나. 선 굵기·크기를 맞춰 한 벌로 보이게 */
const CHOICE_ICONS: Record<string, React.ReactNode> = {
  /* 클립 */
  file: <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />,
  /* 사슬 */
  url: (
    <>
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </>
  ),
  /* 연필 */
  text: (
    <>
      <path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z" />
    </>
  ),
}

/* 여럿 중 하나를 고르는 타일 — 위에 아이콘과 라디오 원, 아래에 이름.
   타일 사이에 세로선과 'or' 를 세워 "하나만" 이 읽히게 한다.
   고른 타일만 연보라 바탕에 보라 글씨, 원 안에 점이 찬다.
   라디오의 키보드 동작(방향키로 옮기기)은 그대로 두고 기본 동그라미만 감춘다. */
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
    <div role="radiogroup" className="mt-2.5 flex items-stretch">
      {options.map(([v, label], i) => {
        const on = value === v
        return (
          <Fragment key={v}>
            {i > 0 && (
              <span aria-hidden className="flex w-8 shrink-0 flex-col items-center sm:w-10">
                <span className="w-px flex-1 bg-neutral-200" />
                <span className="py-1 text-[11px] font-medium text-neutral-400">or</span>
                <span className="w-px flex-1 bg-neutral-200" />
              </span>
            )}
            <label
              className={`relative flex min-w-0 flex-1 cursor-pointer flex-col gap-2 rounded-xl px-3 py-2.5 transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-violet-500 sm:px-3.5 sm:py-3 ${
                on ? 'bg-violet-50 text-violet-700' : 'text-neutral-500 hover:bg-neutral-50 hover:text-neutral-700'
              }`}
            >
              <input
                type="radio"
                name={name}
                checked={on}
                onChange={() => onChange(v)}
                className="sr-only"
              />

              <span className="flex items-start justify-between">
                <svg
                  viewBox="0 0 24 24"
                  className={`size-4 shrink-0 ${on ? 'text-violet-600' : 'text-neutral-400'}`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  {CHOICE_ICONS[v]}
                </svg>
                {/* 라디오 원 — 고르면 안쪽 점이 찬다 */}
                <span
                  aria-hidden
                  className={`grid size-4 shrink-0 place-items-center rounded-full border-2 bg-white transition ${
                    on ? 'border-violet-600' : 'border-neutral-300'
                  }`}
                >
                  <span className={`size-1.5 rounded-full bg-violet-600 transition ${on ? 'scale-100' : 'scale-0'}`} />
                </span>
              </span>

              <span className={`text-[13px] leading-snug sm:text-sm ${on ? 'font-semibold' : ''}`}>{label}</span>
            </label>
          </Fragment>
        )
      })}
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
