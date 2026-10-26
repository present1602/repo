'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  APPLICATION_FILE_KINDS,
  APPLICATION_FILE_LABELS,
  type ApplicationWithLinks,
} from '@/lib/application-shape'
import { shortDate } from '@/lib/format-date'
import { setApplicationStatus } from '@/app/admin/applications/actions'

function mb(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`
}

/* 들어온 지원서 목록.

   펼칠 내용이 없다 — 이름·이메일·파일 두 개가 전부라 한 줄에 다 싣는다.
   파일을 내려받으면 확인한 것으로 본다: 열어 봤는데 '미확인'으로 남으면
   다음에 다시 열어 보게 된다. */
export function ApplicationList({ applications }: { applications: ApplicationWithLinks[] }) {
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const router = useRouter()

  const mark = (id: string, status: 'read' | 'unread') => {
    setError(null)
    start(async () => {
      const r = await setApplicationStatus(id, status)
      if (!r.ok) {
        setError(r.error)
        return
      }
      router.refresh()
    })
  }

  if (applications.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-neutral-300 py-16 text-center text-sm text-neutral-500">
        아직 들어온 지원서가 없습니다.
      </p>
    )
  }

  return (
    <section className="min-w-0">
      {error && <p className="mb-4 rounded-lg bg-red-50 px-3.5 py-3 text-sm text-red-700">{error}</p>}

      <ul className="divide-y divide-neutral-200 overflow-hidden rounded-xl ring-1 ring-neutral-200">
        {applications.map((a) => {
          const unread = a.status === 'unread'
          return (
            <li key={a.id} className="flex flex-wrap items-center gap-x-5 gap-y-3 bg-white px-4 py-4 md:px-5">
              <div className="min-w-0 flex-1 basis-56">
                <div className="flex items-center gap-2">
                  {unread && <span className="size-1.5 shrink-0 rounded-full bg-violet-600" />}
                  <span className={`text-sm ${unread ? 'font-semibold' : 'font-medium'}`}>{a.name}</span>
                  <span className="text-xs text-neutral-400">{shortDate(a.created_at)}</span>
                </div>
                <a
                  href={`mailto:${a.email}`}
                  className="mt-0.5 block truncate text-xs text-neutral-500 hover:text-violet-600"
                >
                  {a.email}
                </a>
              </div>

              <div className="flex flex-wrap gap-2">
                {APPLICATION_FILE_KINDS.map((k) => {
                  const href = a.links[k]
                  const f = a[k]
                  return href ? (
                    <a
                      key={k}
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      /* 내려받기 = 확인 — 미확인일 때만 바꾼다 */
                      onClick={() => unread && mark(a.id, 'read')}
                      title={`${f.name} · ${mb(f.size)}`}
                      className="flex max-w-56 items-center gap-1.5 rounded-lg border border-neutral-300 px-3 py-1.5 text-xs transition hover:border-violet-600 hover:text-violet-700"
                    >
                      <span className="shrink-0 font-semibold">{APPLICATION_FILE_LABELS[k]}</span>
                      <span className="truncate text-neutral-500">{f.name}</span>
                    </a>
                  ) : (
                    <span
                      key={k}
                      className="rounded-lg border border-dashed border-neutral-300 px-3 py-1.5 text-xs text-neutral-400"
                    >
                      {APPLICATION_FILE_LABELS[k]} 링크 없음
                    </span>
                  )
                })}
              </div>

              <button
                onClick={() => mark(a.id, unread ? 'read' : 'unread')}
                disabled={pending}
                className="shrink-0 rounded-md px-2 py-1 text-xs text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900 disabled:opacity-50"
              >
                {unread ? '확인함으로' : '미확인으로'}
              </button>
            </li>
          )
        })}
      </ul>
      <p className="mt-3 text-xs text-neutral-400">
        내려받기 링크는 1시간 동안 유효합니다. 지나면 새로고침해 주세요.
      </p>
    </section>
  )
}
