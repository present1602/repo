'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import type { ReviewRow, ReviewTokenRow } from '@/lib/review-shape'
import { createReviewLink, setReviewStatus } from '@/app/admin/reviews/actions'
import { Flash } from '@/components/flash'

type Notice = { kind: 'ok' | 'error'; text: string } | null
type DesignerOption = { id: string; name: string | null; label: string }

type Tab = 'pending' | 'approved' | 'rejected' | 'links'

const TABS: { key: Tab; label: string }[] = [
  { key: 'pending', label: '승인 대기' },
  { key: 'approved', label: '공개 중' },
  { key: 'rejected', label: '내림' },
  { key: 'links', label: '보낸 링크' },
]

/* 후기 관리 — 링크 만들기와 승인을 한 화면에 둔다.

   둘을 다른 페이지로 나누면 "링크를 보냈나" 와 "후기가 왔나" 를
   오가며 봐야 한다. 같은 일의 앞뒤라 한곳에 둔다. */
export function ReviewAdmin({
  reviews,
  tokens,
  designers,
}: {
  reviews: ReviewRow[]
  tokens: ReviewTokenRow[]
  designers: DesignerOption[]
}) {
  const [tab, setTab] = useState<Tab>('pending')
  const [notice, setNotice] = useState<Notice>(null)

  const counts = useMemo(
    () => ({
      pending: reviews.filter((r) => r.status === 'pending').length,
      approved: reviews.filter((r) => r.status === 'approved').length,
      rejected: reviews.filter((r) => r.status === 'rejected').length,
      links: tokens.filter((t) => !t.used_at).length,
    }),
    [reviews, tokens],
  )

  const shown = useMemo(
    () => (tab === 'links' ? [] : reviews.filter((r) => r.status === tab)),
    [reviews, tab],
  )

  return (
    <section className="min-w-0">
      <NewLink designers={designers} onNotice={setNotice} />

      <Flash msg={notice} onDone={() => setNotice(null)} className="mb-4" />

      <nav className="mb-4 flex gap-1 border-b border-neutral-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            aria-current={tab === t.key ? 'page' : undefined}
            className={`-mb-px border-b-2 px-3 py-2.5 text-sm font-medium transition ${
              tab === t.key
                ? 'border-neutral-900 text-neutral-900'
                : 'border-transparent text-neutral-500 hover:text-neutral-800'
            }`}
          >
            {t.label}{' '}
            <span className={tab === t.key ? 'text-neutral-400' : 'text-neutral-300'}>
              {counts[t.key]}
            </span>
          </button>
        ))}
      </nav>

      {tab === 'links' ? (
        <TokenList tokens={tokens} />
      ) : shown.length === 0 ? (
        <p className="rounded-xl border border-dashed border-neutral-300 py-16 text-center text-sm text-neutral-500">
          {tab === 'pending' ? '승인을 기다리는 후기가 없습니다.' : '해당하는 후기가 없습니다.'}
        </p>
      ) : (
        <ul className="divide-y divide-neutral-200 overflow-hidden rounded-xl ring-1 ring-neutral-200">
          {shown.map((r) => (
            <ReviewItem key={r.id} review={r} onNotice={setNotice} />
          ))}
        </ul>
      )}
    </section>
  )
}

/* ─────────── 직접 링크 만들기 ─────────── */

/* 전화·메신저로 받은 의뢰용. 플랫폼에 문의가 없으므로 가져올 신원이 없어
   어드민이 직접 적는다. 이름만 필수다. */
function NewLink({
  designers,
  onNotice,
}: {
  designers: DesignerOption[]
  onNotice: (n: Notice) => void
}) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [pick, setPick] = useState('')
  const [memo, setMemo] = useState('')
  const [url, setUrl] = useState<string | null>(null)
  const [pending, start] = useTransition()

  const submit = () => {
    onNotice(null)
    start(async () => {
      const r = await createReviewLink({
        authorName: name,
        authorEmail: email,
        designerId: pick || null,
        memo,
      })
      if (!r.ok) {
        onNotice({ kind: 'error', text: r.error })
        return
      }
      setUrl(r.url)
      onNotice(
        r.mailed
          ? { kind: 'ok', text: `${email} 로 후기 요청을 보냈습니다.` }
          : {
              kind: 'ok',
              text: '링크를 만들었습니다. 아래 주소를 복사해 전달해 주세요.',
            },
      )
      setName('')
      setEmail('')
      setMemo('')
    })
  }

  if (!open) {
    return (
      <div className="mb-5">
        <button
          onClick={() => setOpen(true)}
          className="rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-600"
        >
          후기 링크 직접 만들기
        </button>
        <p className="mt-2 text-xs text-neutral-500">
          플랫폼을 거치지 않고 받은 의뢰도 후기를 받을 수 있습니다. 문의에 달린 건은{' '}
          <Link href="/admin/inquiries" className="text-violet-600 hover:underline">
            문의
          </Link>{' '}
          화면에서 보냅니다.
        </p>
      </div>
    )
  }

  return (
    <div className="mb-5 rounded-xl border border-neutral-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">후기 링크 직접 만들기</p>
        <button
          onClick={() => setOpen(false)}
          className="text-xs text-neutral-500 hover:text-neutral-900"
        >
          닫기
        </button>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Field label="고객 이름" required>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="김수연"
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-violet-500"
          />
        </Field>

        <Field label="이메일" hint="적으면 메일로 보냅니다">
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="비우면 링크만 만듭니다"
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-violet-500"
          />
        </Field>

        <Field label="디자이너" hint="선택">
          <select
            value={pick}
            onChange={(e) => setPick(e.target.value)}
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-violet-500"
          >
            <option value="">선택 안 함</option>
            {designers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="메모" hint="목록에서 구분용">
          <input
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="카톡으로 받은 의뢰"
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-violet-500"
          />
        </Field>
      </div>

      {!pick && (
        <p className="mt-3 text-[11px] text-amber-700">
          디자이너를 고르지 않으면 어느 디자이너 페이지에도 붙지 않는 후기가 됩니다.
        </p>
      )}

      <button
        onClick={submit}
        disabled={pending || !name.trim()}
        className="mt-3 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-600 disabled:opacity-40"
      >
        {pending ? '만드는 중…' : '링크 만들기'}
      </button>

      {url && <LinkBox url={url} />}
    </div>
  )
}

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string
  hint?: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-neutral-600">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
        {hint && <span className="ml-1.5 font-normal text-neutral-400">{hint}</span>}
      </span>
      {children}
    </label>
  )
}

/* ─────────── 후기 한 건 ─────────── */

function ReviewItem({
  review: r,
  onNotice,
}: {
  review: ReviewRow
  onNotice: (n: Notice) => void
}) {
  const [pending, start] = useTransition()
  const [memo, setMemo] = useState('')
  const [asking, setAsking] = useState(false)

  const change = (status: 'approved' | 'rejected' | 'pending', m?: string) => {
    onNotice(null)
    start(async () => {
      const res = await setReviewStatus(r.id, status, m)
      if (!res.ok) onNotice({ kind: 'error', text: res.error })
      else {
        setAsking(false)
        setMemo('')
      }
    })
  }

  return (
    <li className="bg-white px-4 py-3.5">
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="font-semibold">{r.author_name}</span>
        {r.designer_name ? (
          <span className="text-xs text-neutral-500">→ {r.designer_name}</span>
        ) : (
          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] text-amber-800">
            디자이너 미지정
          </span>
        )}
        {!r.inquiry_id && (
          <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[11px] text-neutral-500">
            직접 발급
          </span>
        )}
        <span className="ml-auto text-[11px] text-neutral-400">
          {new Date(r.created_at).toLocaleString('ko-KR')}
        </span>
      </div>

      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-neutral-700">
        {r.body}
      </p>

      {r.status_memo && (
        <p className="mt-2 rounded bg-neutral-50 px-2.5 py-1.5 text-xs text-neutral-500">
          내린 사유: {r.status_memo}
        </p>
      )}

      {asking ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="내리는 사유 (선택)"
            autoFocus
            className="min-w-0 flex-1 rounded-md border border-neutral-300 px-3 py-1.5 text-xs outline-none focus:border-violet-500"
          />
          <button
            onClick={() => change('rejected', memo)}
            disabled={pending}
            className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-red-700 disabled:opacity-50"
          >
            내리기
          </button>
          <button
            onClick={() => setAsking(false)}
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs transition hover:bg-neutral-100"
          >
            취소
          </button>
        </div>
      ) : (
        <div className="mt-3 flex gap-2">
          {r.status !== 'approved' && (
            <button
              onClick={() => change('approved')}
              disabled={pending}
              className="rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-violet-600 disabled:opacity-50"
            >
              {pending ? '…' : '승인'}
            </button>
          )}
          {r.status !== 'rejected' && (
            <button
              onClick={() => setAsking(true)}
              disabled={pending}
              className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-medium transition hover:bg-neutral-100 disabled:opacity-50"
            >
              내리기
            </button>
          )}
          {r.status === 'rejected' && (
            <button
              onClick={() => change('pending')}
              disabled={pending}
              className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-medium transition hover:bg-neutral-100 disabled:opacity-50"
            >
              대기로 되돌리기
            </button>
          )}
        </div>
      )}
    </li>
  )
}

/* ─────────── 보낸 링크 ─────────── */

function TokenList({ tokens }: { tokens: ReviewTokenRow[] }) {
  /* 화면을 연 시각 하나로 모든 링크의 만료를 판단한다 */
  const [now] = useState(() => Date.now())

  if (tokens.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-neutral-300 py-16 text-center text-sm text-neutral-500">
        아직 만든 링크가 없습니다.
      </p>
    )
  }

  const base =
    typeof window === 'undefined' ? '' : `${window.location.protocol}//${window.location.host}`

  return (
    <ul className="divide-y divide-neutral-200 overflow-hidden rounded-xl ring-1 ring-neutral-200">
      {tokens.map((t) => {
        /* 기간이 지났는지는 그릴 때마다 시계를 보지 않고 한 번만 잰다 —
           렌더 중에 Date.now() 를 부르면 같은 입력이 다른 결과를 낸다. */
        const expired = new Date(t.expires_at).getTime() < now
        return (
          <li key={t.token} className="bg-white px-4 py-3.5">
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="text-sm font-medium">
                {t.author_name ?? (t.inquiry_id ? '문의에서 발급' : '이름 없음')}
              </span>
              {t.designer_name && (
                <span className="text-xs text-neutral-500">→ {t.designer_name}</span>
              )}
              {t.used_at ? (
                <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[11px] text-emerald-800">
                  작성 완료
                </span>
              ) : expired ? (
                <span className="rounded bg-neutral-200 px-1.5 py-0.5 text-[11px] text-neutral-600">
                  기간 지남
                </span>
              ) : (
                <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[11px] text-violet-700">
                  대기 중
                </span>
              )}
              {t.memo && <span className="text-[11px] text-neutral-400">{t.memo}</span>}
              <span className="ml-auto text-[11px] text-neutral-400">
                {t.sent_count > 0 && `${t.sent_count}회 발송 · `}
                {new Date(t.created_at).toLocaleDateString('ko-KR')}
              </span>
            </div>

            {!t.used_at && !expired && <LinkBox url={`${base}/review/${t.token}`} />}
          </li>
        )
      })}
    </ul>
  )
}

/* 만든 링크 — 메일이 실패했거나 카카오로 보낼 때 복사해 쓴다 */
function LinkBox({ url }: { url: string }) {
  const [copied, setCopied] = useState(false)

  return (
    <div className="mt-2.5 flex items-center gap-2 rounded-lg bg-neutral-50 px-3 py-2">
      <code className="min-w-0 flex-1 truncate text-[11px] text-neutral-600">{url}</code>
      <button
        onClick={() => {
          navigator.clipboard.writeText(url).then(
            () => {
              setCopied(true)
              window.setTimeout(() => setCopied(false), 1500)
            },
            () => setCopied(false),
          )
        }}
        className="shrink-0 rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-[11px] font-medium transition hover:bg-neutral-100"
      >
        {copied ? '복사됨' : '복사'}
      </button>
    </div>
  )
}
