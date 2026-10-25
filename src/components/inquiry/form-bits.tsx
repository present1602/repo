'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'

/* 문의 폼의 공통 부품.

   모양은 ref/soom-design 의 폼을 따르되 색과 글꼴은 이 프로젝트 결에
   맞춘다 — 저쪽은 stone + serif, 여기는 neutral + indigo + sans 다.
   참고 코드를 그대로 옮기면 이 화면만 다른 사이트처럼 보인다. */

/* 밑줄만 있는 입력칸 — 테두리를 두르면 칸이 많아 보여 답답하다 */
export const inputCls =
  'mt-2 w-full border-0 border-b border-neutral-300 bg-transparent px-0 py-2 text-[15px] outline-none transition placeholder:text-neutral-400 focus:border-neutral-900'

/* 첨부파일 한 개당 상한 */
const MAX_MB = 20

/* 모바일은 아래에서 올라오는 시트, 데스크톱은 가운데 모달 */
export function Dialog({
  eyebrow,
  title,
  onClose,
  children,
}: {
  eyebrow: string
  title: string
  onClose: () => void
  children: ReactNode
}) {
  /* Esc 로 닫고, 열려 있는 동안 뒤쪽이 스크롤되지 않게 한다 */
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  return (
    /* 바깥 칸이 스크롤을 맡고, 모달은 내용만큼 늘어난다 —
       높이를 묶고 안쪽만 스크롤하면 내용이 길 때 위쪽이 화면 밖으로
       밀려 닿을 수 없게 된다.

       자리잡기는 flex 의 justify/items 가 아니라 바깥 여백(mt-auto)으로
       한다. flex 의 end 정렬은 내용이 칸보다 클 때 위쪽을 넘쳐 잘라내고,
       그 부분은 스크롤로도 닿지 않는다. auto 여백은 남는 공간이 있을 때만
       밀어내므로 그런 일이 없다. */
    <div
      className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-neutral-950/70"
      onClick={onClose}
    >
      <div className="flex min-h-full flex-col md:p-8">
        <div
          role="dialog"
          aria-modal="true"
          onClick={(e) => e.stopPropagation()}
          className="mt-auto w-full rounded-t-2xl bg-white md:mx-auto md:mb-auto md:max-w-2xl md:rounded-2xl"
        >
          {/* 손잡이 — 아래에서 올라온 시트라는 걸 알린다 */}
          <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-neutral-300 md:hidden" />

          <div className="flex items-start justify-between gap-3 border-b border-neutral-200 px-6 py-4 md:px-10 md:py-5">
            <div className="min-w-0">
              <p className="text-[11px] font-medium tracking-[0.2em] text-neutral-400">
                {eyebrow}
              </p>
              <h2 className="mt-0.5 truncate text-xl font-bold tracking-tight md:text-2xl">
                {title}
              </h2>
            </div>
            <button
              onClick={onClose}
              aria-label="닫기"
              className="-mr-1 shrink-0 rounded p-1 text-2xl leading-none text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-900"
            >
              ×
            </button>
          </div>

          {children}
        </div>
      </div>
    </div>
  )
}

/* 입력칸 한 줄의 이름표 — 필수는 별표, 아니면 (선택) */
export function Field({
  label,
  req,
  hint,
  children,
}: {
  label: string
  req?: boolean
  hint?: string
  children: ReactNode
}) {
  return (
    <label className="block">
      <span className="flex items-baseline justify-between gap-2 text-xs font-medium text-neutral-700">
        <span>
          {label}{' '}
          {req ? (
            <span className="text-red-600">*</span>
          ) : (
            <span className="font-normal text-neutral-400">(선택)</span>
          )}
        </span>
        {hint && <span className="shrink-0 font-normal text-neutral-400">{hint}</span>}
      </span>
      {children}
    </label>
  )
}

/* 첨부파일 — 고른 파일을 목록으로 보여주고 하나씩 뺄 수 있다 */
export function FileField({ max }: { max: number }) {
  const [files, setFiles] = useState<File[]>([])
  const [err, setErr] = useState('')
  const ref = useRef<HTMLInputElement>(null)

  const add = (list: FileList | null) => {
    if (!list) return
    const picked = Array.from(list)

    /* 큰 파일은 빼고 받되, 왜 빠졌는지 알려준다 —
       조용히 사라지면 올라간 줄 알고 넘어간다 */
    const big = picked.filter((f) => f.size > MAX_MB * 1024 * 1024)
    const ok = picked.filter((f) => f.size <= MAX_MB * 1024 * 1024)

    setErr(
      big.length > 0
        ? `${MAX_MB}MB를 넘는 파일은 제외했습니다.`
        : files.length + ok.length > max
          ? `최대 ${max}개까지 첨부할 수 있습니다.`
          : '',
    )
    setFiles([...files, ...ok].slice(0, max))

    /* 같은 파일을 다시 고를 수 있게 비운다 */
    if (ref.current) ref.current.value = ''
  }

  const full = files.length >= max

  return (
    <div>
      <span className="flex items-baseline justify-between gap-2 text-xs font-medium text-neutral-700">
        <span>
          첨부파일 <span className="font-normal text-neutral-400">(선택)</span>
        </span>
        <span className="shrink-0 font-normal text-neutral-400">
          {files.length}/{max} · 파일당 {MAX_MB}MB 이하
        </span>
      </span>

      <div className="mt-2 rounded-lg border border-dashed border-neutral-300 p-3">
        {files.length > 0 && (
          <ul className="mb-3 space-y-1.5">
            {files.map((f, i) => (
              <li
                key={`${f.name}-${i}`}
                className="flex items-center gap-3 rounded-md bg-neutral-100 px-3 py-2 text-sm"
              >
                <span className="min-w-0 flex-1 truncate">{f.name}</span>
                <span className="shrink-0 text-[11px] text-neutral-400">
                  {(f.size / 1024 / 1024).toFixed(1)}MB
                </span>
                <button
                  type="button"
                  aria-label={`${f.name} 삭제`}
                  onClick={() => setFiles(files.filter((_, k) => k !== i))}
                  className="shrink-0 text-neutral-400 transition hover:text-neutral-900"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}

        <label
          className={`inline-block rounded-md border px-4 py-2 text-xs font-medium transition ${
            full
              ? 'cursor-not-allowed border-neutral-200 text-neutral-300'
              : 'cursor-pointer border-neutral-900 hover:bg-neutral-100'
          }`}
        >
          {full ? '첨부 한도 도달' : '파일 선택'}
          <input
            ref={ref}
            type="file"
            multiple={max > 1}
            disabled={full}
            className="hidden"
            onChange={(e) => add(e.target.files)}
          />
        </label>

        {files.length === 0 && (
          <span className="ml-3 text-sm text-neutral-500">선택된 파일 없음</span>
        )}
      </div>

      {err && <p className="mt-1 text-[11px] text-red-600">{err}</p>}
    </div>
  )
}

/* 개인정보 동의 — 없으면 보낼 수 없다 */
export function Consent() {
  return (
    <label className="mt-8 flex cursor-pointer items-start gap-3 text-sm">
      <input required type="checkbox" className="mt-0.5 size-4 shrink-0 accent-indigo-600" />
      <span>
        <span className="text-red-600">*</span> 개인정보 수집 및 이용에 동의합니다.{' '}
        <span className="text-neutral-500 underline underline-offset-2">처리방침 보기</span>
      </span>
    </label>
  )
}

/* 보낸 뒤 화면 */
export function Done({
  title,
  body,
  onClose,
}: {
  title: string
  body: ReactNode
  onClose: () => void
}) {
  return (
    <div className="px-6 py-16 text-center md:px-10 md:py-20">
      <div className="mx-auto grid size-16 place-items-center rounded-full bg-indigo-50 text-2xl text-indigo-600">
        ✓
      </div>
      <h3 className="mt-7 text-2xl font-bold tracking-tight md:text-3xl">{title}</h3>
      <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-neutral-600">{body}</p>
      <button
        onClick={onClose}
        className="mt-9 rounded-lg bg-neutral-900 px-10 py-3 text-sm font-semibold text-white transition hover:bg-indigo-600"
      >
        확인
      </button>
    </div>
  )
}
