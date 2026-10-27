'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  type PopupRow,
  type PopupStatus,
  POPUP_STATUSES,
  STATUS_LABELS,
  inPeriod,
  periodText,
  publicUrl,
} from '@/lib/popup-shape'
import { deletePopup, setPopupStatus } from '@/app/admin/popups/actions'
import { ghostButton } from './form-bits'

type Filter = 'all' | PopupStatus
type Notice = { kind: 'ok' | 'error'; text: string } | null

const FILTERS: Filter[] = ['all', ...POPUP_STATUSES]

const BADGE: Record<PopupStatus, string> = {
  visible: 'bg-violet-600 text-white',
  hidden: 'bg-neutral-200 text-neutral-700',
  expired: 'bg-amber-100 text-amber-800',
}

export function PopupList({ popups }: { popups: PopupRow[] }) {
  const [filter, setFilter] = useState<Filter>('all')
  const [notice, setNotice] = useState<Notice>(null)

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: popups.length, visible: 0, hidden: 0, expired: 0 }
    for (const p of popups) c[p.status]++
    return c
  }, [popups])

  const shown = filter === 'all' ? popups : popups.filter((p) => p.status === filter)

  return (
    <section className="min-w-0">
      <nav className="mb-4 flex gap-1 border-b border-neutral-200">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            aria-current={filter === f ? 'page' : undefined}
            className={`-mb-px border-b-2 px-3 py-2.5 text-sm font-medium transition ${
              filter === f
                ? 'border-neutral-900 text-neutral-900'
                : 'border-transparent text-neutral-500 hover:text-neutral-800'
            }`}
          >
            {f === 'all' ? '전체' : STATUS_LABELS[f]}{' '}
            <span className={filter === f ? 'text-neutral-400' : 'text-neutral-300'}>{counts[f]}</span>
          </button>
        ))}
      </nav>

      {notice && (
        <p
          className={`mb-4 rounded-lg px-3.5 py-3 text-sm ${
            notice.kind === 'ok' ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'
          }`}
        >
          {notice.text}
        </p>
      )}

      {shown.length === 0 ? (
        <p className="rounded-xl border border-dashed border-neutral-300 py-16 text-center text-sm text-neutral-500">
          {filter === 'all' ? '아직 만든 팝업이 없습니다.' : `${STATUS_LABELS[filter]} 상태인 팝업이 없습니다.`}
        </p>
      ) : (
        <ul className="divide-y divide-neutral-200 overflow-hidden rounded-xl ring-1 ring-neutral-200">
          {shown.map((p) => (
            <PopupItem key={p.id} popup={p} onNotice={setNotice} />
          ))}
        </ul>
      )}
    </section>
  )
}

function PopupItem({ popup: p, onNotice }: { popup: PopupRow; onNotice: (n: Notice) => void }) {
  const [pending, start] = useTransition()
  const router = useRouter()

  const firstImage = p.body.find((b) => b.type === 'image')
  const firstText = p.body.find((b) => b.type === 'text')
  /* 노출인데 아직 시작 전이면 알린다 — "노출했는데 안 뜬다"를 막는다 */
  const waiting = p.status === 'visible' && !inPeriod(p)

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    onNotice(null)
    start(async () => {
      const r = await fn()
      if (!r.ok) {
        onNotice({ kind: 'error', text: r.error ?? '실패했습니다.' })
        return
      }
      router.refresh()
    })
  }

  const toggle = () => run(() => setPopupStatus(p.id, p.status === 'visible' ? 'hidden' : 'visible'))

  const remove = () => {
    if (!confirm('이 팝업을 지울까요? 본문 이미지와 첨부 파일도 함께 지워집니다.')) return
    run(() => deletePopup(p.id))
  }

  return (
    <li className={`flex items-center gap-4 p-4 ${p.status === 'visible' ? 'bg-white' : 'bg-neutral-50'}`}>
      <div className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-lg bg-neutral-100 text-[11px] text-neutral-400">
        {firstImage?.type === 'image' ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={publicUrl(firstImage.path)} alt="" className="size-full object-cover" />
        ) : (
          '글'
        )}
      </div>

      <Link href={`/admin/popups/${p.id}`} className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${BADGE[p.status]}`}>
            {STATUS_LABELS[p.status]}
          </span>
          {waiting && (
            <span className="rounded bg-sky-100 px-1.5 py-0.5 text-[11px] text-sky-800">게시 대기</span>
          )}
          <span className={`truncate text-sm font-medium ${p.title ? '' : 'text-neutral-400'}`}>
            {p.title || '(제목 없음)'}
          </span>
        </div>
        {firstText?.type === 'text' && (
          <p className="mt-1 line-clamp-1 text-xs text-neutral-600">{firstText.text}</p>
        )}
        <p className="mt-1 text-[11px] text-neutral-400">
          {periodText(p)}
          {p.files.length > 0 && ` · 첨부 ${p.files.length}개`}
        </p>
      </Link>

      <div className="flex shrink-0 gap-1.5">
        <button
          onClick={toggle}
          disabled={pending}
          className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition disabled:opacity-50 ${
            p.status === 'visible'
              ? 'border border-neutral-300 text-neutral-600 hover:bg-neutral-100'
              : 'bg-neutral-900 text-white hover:bg-violet-600'
          }`}
        >
          {pending ? '…' : p.status === 'visible' ? '숨기기' : '노출하기'}
        </button>
        <button onClick={remove} disabled={pending} className={`${ghostButton} text-red-600`}>
          삭제
        </button>
      </div>
    </li>
  )
}
