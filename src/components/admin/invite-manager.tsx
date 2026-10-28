'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  DEFAULT_INVITE_DAYS,
  INVITE_STATUSES,
  INVITE_STATUS_LABELS,
  MAX_INVITE_DAYS,
  MAX_INVITE_MEMO,
  CODE_MAX,
  customCodeError,
  expiresText,
  isOpen,
  kstDateAfter,
  type InviteStatus,
  type InviteWithUser,
} from '@/lib/invite-shape'
import { dateTime } from '@/lib/format-date'
import { cancelInvite, createInvite } from '@/app/admin/invites/actions'
import { Field, ghostButton, input } from './form-bits'

type Filter = 'all' | InviteStatus
type Notice = { kind: 'ok' | 'error'; text: string } | null

const FILTERS: Filter[] = ['all', ...INVITE_STATUSES]

const BADGE: Record<InviteStatus, string> = {
  active: 'bg-violet-600 text-white',
  verified: 'bg-sky-100 text-sky-800',
  used: 'bg-emerald-100 text-emerald-800',
  expired: 'bg-amber-100 text-amber-800',
  canceled: 'bg-neutral-200 text-neutral-600',
}

export function InviteManager({ invites }: { invites: InviteWithUser[] }) {
  const [filter, setFilter] = useState<Filter>('all')
  const [notice, setNotice] = useState<Notice>(null)

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: invites.length, active: 0, verified: 0, used: 0, expired: 0, canceled: 0 }
    for (const i of invites) c[i.status]++
    return c
  }, [invites])

  const shown = filter === 'all' ? invites : invites.filter((i) => i.status === filter)

  return (
    <div className="space-y-6">
      <IssueForm onNotice={setNotice} />

      {notice && (
        <p
          className={`rounded-lg px-3.5 py-3 text-sm ${
            notice.kind === 'ok' ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'
          }`}
        >
          {notice.text}
        </p>
      )}

      <section className="min-w-0">
        <nav className="mb-4 flex gap-1 overflow-x-auto border-b border-neutral-200">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              aria-current={filter === f ? 'page' : undefined}
              className={`-mb-px shrink-0 border-b-2 px-3 py-2.5 text-sm font-medium transition ${
                filter === f
                  ? 'border-neutral-900 text-neutral-900'
                  : 'border-transparent text-neutral-500 hover:text-neutral-800'
              }`}
            >
              {f === 'all' ? '전체' : INVITE_STATUS_LABELS[f]}{' '}
              <span className={filter === f ? 'text-neutral-400' : 'text-neutral-300'}>{counts[f]}</span>
            </button>
          ))}
        </nav>

        {shown.length === 0 ? (
          <p className="rounded-xl border border-dashed border-neutral-300 py-16 text-center text-sm text-neutral-500">
            {filter === 'all' ? '아직 발행한 초대코드가 없습니다.' : `${INVITE_STATUS_LABELS[filter]} 상태인 코드가 없습니다.`}
          </p>
        ) : (
          <ul className="divide-y divide-neutral-200 overflow-hidden rounded-xl ring-1 ring-neutral-200">
            {shown.map((i) => (
              <InviteItem key={i.id} invite={i} onNotice={setNotice} />
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

/* ─────────── 발행 ─────────── */

function IssueForm({ onNotice }: { onNotice: (n: Notice) => void }) {
  /* 한국 날짜 기준 — 서버도 같은 기준으로 막는다 */
  const today = kstDateAfter(0)
  const last = kstDateAfter(MAX_INVITE_DAYS)
  const [expiresOn, setExpiresOn] = useState(kstDateAfter(DEFAULT_INVITE_DAYS))
  const [memo, setMemo] = useState('')
  const [code, setCode] = useState('')
  const [pending, start] = useTransition()
  const router = useRouter()

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    onNotice(null)
    const bad = customCodeError(code)
    if (bad) return onNotice({ kind: 'error', text: bad })
    start(async () => {
      const r = await createInvite(expiresOn, memo, code)
      if (!r.ok) return onNotice({ kind: 'error', text: r.error })
      onNotice({ kind: 'ok', text: `초대코드 ${r.code ?? ''} 를 발행했습니다.` })
      setMemo('')
      setCode('')
      router.refresh()
    })
  }

  return (
    <form onSubmit={submit} className="rounded-xl bg-white p-5 ring-1 ring-neutral-200">
      <h2 className="text-sm font-semibold">새 초대코드</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-[12rem_12rem_minmax(0,1fr)_auto] sm:items-end">
        <Field label="코드" hint={`선택 · 대문자·숫자·_ ${CODE_MAX}자 이내`}>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\s/g, ''))}
            maxLength={CODE_MAX}
            autoComplete="off"
            spellCheck={false}
            placeholder="비우면 자동 생성"
            className={`${input} font-mono tracking-wider`}
          />
        </Field>
        <Field label="만료일" hint={`최대 ${MAX_INVITE_DAYS}일`}>
          <input
            type="date"
            value={expiresOn}
            min={today}
            max={last}
            onChange={(e) => setExpiresOn(e.target.value)}
            required
            className={input}
          />
        </Field>
        <Field label="메모" hint="선택 · 누구에게 줬는지">
          <input
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            maxLength={MAX_INVITE_MEMO}
            placeholder="예: 김숨 디자이너 (지원서 10/27)"
            className={input}
          />
        </Field>
        <button
          type="submit"
          disabled={pending}
          className="h-9 rounded-lg bg-neutral-900 px-4 text-sm font-medium text-white transition hover:bg-violet-600 disabled:opacity-50"
        >
          {pending ? '발행 중…' : '발행'}
        </button>
      </div>
      <p className="mt-2 text-xs text-neutral-400">
        고른 날의 자정(한국 시간)까지 쓸 수 있습니다. 코드를 비우면 헷갈리는 글자를 뺀 8자리를 만듭니다.
      </p>
    </form>
  )
}

/* ─────────── 한 줄 ─────────── */

function InviteItem({ invite: i, onNotice }: { invite: InviteWithUser; onNotice: (n: Notice) => void }) {
  const [pending, start] = useTransition()
  const [copied, setCopied] = useState(false)
  const router = useRouter()

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(i.code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* 클립보드가 막힌 브라우저 — 코드는 화면에 그대로 있다 */
    }
  }

  const cancel = () => {
    if (!confirm(`초대코드 ${i.code} 를 취소할까요? 취소하면 이 코드로 가입할 수 없습니다.`)) return
    onNotice(null)
    start(async () => {
      const r = await cancelInvite(i.id)
      if (!r.ok) onNotice({ kind: 'error', text: r.error })
      router.refresh()
    })
  }

  /* 아직 가입에 쓸 수 있는 코드 — 사용 가능·인증함 */
  const open = isOpen(i.status)

  return (
    <li className={`flex flex-wrap items-center gap-x-4 gap-y-2 p-4 ${open ? 'bg-white' : 'bg-neutral-50'}`}>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${BADGE[i.status]}`}>
            {INVITE_STATUS_LABELS[i.status]}
          </span>
          <span
            className={`font-mono text-base font-semibold tracking-wider ${
              open ? '' : 'text-neutral-400 line-through decoration-neutral-300'
            }`}
          >
            {i.code}
          </span>
          {i.memo && <span className="truncate text-xs text-neutral-500">{i.memo}</span>}
        </div>

        <p className="mt-1 text-[11px] text-neutral-400">
          발행 {dateTime(i.created_at)} · {expiresText(i.expires_at)}
          {i.status === 'canceled' && i.status_at && ` · 취소 ${dateTime(i.status_at)}`}
        </p>

        {/* 인증함 — 누군가 이 코드로 인증까지는 했다. 아직 가입 전이라 계속 쓸 수 있다.
            가입·만료·취소로 넘어간 뒤에도 인증 기록은 남겨 보여 준다. */}
        {i.verified_at && i.status !== 'used' && (
          <p className="mt-1.5 text-xs text-sky-800">
            인증 {dateTime(i.verified_at)}
            {i.status === 'verified' && <span className="text-neutral-500"> · 아직 가입하지 않음</span>}
          </p>
        )}

        {/* 사용됨 — 누가 언제 가입했는지 */}
        {i.status === 'used' && (
          <p className="mt-1.5 text-xs text-neutral-700">
            가입 {dateTime(i.used_at)} ·{' '}
            {i.used_by ? (
              <Link href={`/admin/designers/${i.used_by}`} className="font-medium text-violet-600 hover:underline">
                {i.used_name || '이름 미입력'}
              </Link>
            ) : (
              <span className="text-neutral-400">삭제된 계정</span>
            )}{' '}
            · {i.used_email}
          </p>
        )}
      </div>

      {open && (
        <div className="flex shrink-0 gap-1.5">
          <button onClick={copy} className={ghostButton}>
            {copied ? '복사됨' : '복사'}
          </button>
          <button onClick={cancel} disabled={pending} className={`${ghostButton} text-red-600`}>
            {pending ? '…' : '취소'}
          </button>
        </div>
      )}
    </li>
  )
}
