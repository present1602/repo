'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  type InquiryRow,
  type InquiryFilter,
  INQUIRY_FILTERS,
  FILTER_LABELS,
} from '@/lib/inquiry-shape'
import { setInquiryStatus } from '@/app/admin/inquiries/actions'

type Notice = { kind: 'ok' | 'error'; text: string } | null

/* 들어온 문의 목록.

   한 줄에 요약을 깔고, 누르면 그 자리에서 펼쳐 전문을 본다 —
   상세 페이지로 넘기면 목록으로 돌아올 때마다 보던 자리를 잃는다. */
export function InquiryList({ inquiries }: { inquiries: InquiryRow[] }) {
  const [filter, setFilter] = useState<InquiryFilter>('all')
  const [openId, setOpenId] = useState<string | null>(null)
  const [notice, setNotice] = useState<Notice>(null)

  const counts = useMemo(
    () => ({
      all: inquiries.length,
      unread: inquiries.filter((i) => i.status === 'unread').length,
      read: inquiries.filter((i) => i.status === 'read').length,
    }),
    [inquiries],
  )

  const shown = useMemo(
    () => (filter === 'all' ? inquiries : inquiries.filter((i) => i.status === filter)),
    [inquiries, filter],
  )

  return (
    <section className="min-w-0">
      <nav className="mb-4 flex gap-1 border-b border-neutral-200">
        {INQUIRY_FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            aria-current={filter === f ? 'page' : undefined}
            /* 밑줄이 테두리 위에 겹치도록 -1px 내린다 */
            className={`-mb-px border-b-2 px-3 py-2.5 text-sm font-medium transition ${
              filter === f
                ? 'border-neutral-900 text-neutral-900'
                : 'border-transparent text-neutral-500 hover:text-neutral-800'
            }`}
          >
            {FILTER_LABELS[f]}{' '}
            <span className={filter === f ? 'text-neutral-400' : 'text-neutral-300'}>
              {counts[f]}
            </span>
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
          {filter === 'all' ? '아직 들어온 문의가 없습니다.' : `${FILTER_LABELS[filter]} 문의가 없습니다.`}
        </p>
      ) : (
        <ul className="divide-y divide-neutral-200 overflow-hidden rounded-xl ring-1 ring-neutral-200">
          {shown.map((q) => (
            <InquiryItem
              key={q.id}
              inquiry={q}
              open={openId === q.id}
              onToggle={() => setOpenId(openId === q.id ? null : q.id)}
              onNotice={setNotice}
            />
          ))}
        </ul>
      )}
    </section>
  )
}

/* ─────────── 한 건 ─────────── */

function InquiryItem({
  inquiry: q,
  open,
  onToggle,
  onNotice,
}: {
  inquiry: InquiryRow
  open: boolean
  onToggle: () => void
  onNotice: (n: Notice) => void
}) {
  const [pending, start] = useTransition()
  const router = useRouter()
  const unread = q.status === 'unread'

  const toggleStatus = () => {
    onNotice(null)
    start(async () => {
      const r = await setInquiryStatus(q.id, unread ? 'read' : 'unread')
      if (!r.ok) {
        onNotice({ kind: 'error', text: r.error })
        return
      }
      router.refresh()
    })
  }

  return (
    <li className={unread ? 'bg-white' : 'bg-neutral-50'}>
      <div className="flex items-start gap-3 p-4">
        {/* 요약 — 누르면 펼쳐진다 */}
        <button onClick={onToggle} className="min-w-0 flex-1 text-left">
          <div className="flex flex-wrap items-center gap-2">
            {unread && (
              <span className="rounded bg-violet-600 px-1.5 py-0.5 text-[11px] font-medium text-white">
                미확인
              </span>
            )}
            {q.inquiry_type && (
              <span className="rounded bg-neutral-200 px-1.5 py-0.5 text-[11px] text-neutral-700">
                {q.inquiry_type}
              </span>
            )}
            <span className={`text-sm ${unread ? 'font-semibold' : 'font-medium'}`}>{q.name}</span>
            {q.designer_name && (
              <span className="text-xs text-neutral-500">→ {q.designer_name}</span>
            )}
            {/* 메일이 안 나갔으면 알린다 — 메일만 보는 사람은 놓친다 */}
            {!q.mailed && (
              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] text-amber-800">
                메일 미발송
              </span>
            )}
          </div>

          <p className="mt-1 line-clamp-1 text-xs text-neutral-600">{q.message}</p>

          <p className="mt-1 text-[11px] text-neutral-400">
            {new Date(q.created_at).toLocaleString('ko-KR')}
            {q.files.length > 0 && ` · 첨부 ${q.files.length}개`}
          </p>
        </button>

        <button
          onClick={toggleStatus}
          disabled={pending}
          className={`shrink-0 rounded-md px-2.5 py-1.5 text-xs font-medium transition disabled:opacity-50 ${
            unread
              ? 'bg-neutral-900 text-white hover:bg-violet-600'
              : 'border border-neutral-300 text-neutral-600 hover:bg-neutral-100'
          }`}
        >
          {pending ? '…' : unread ? '확인' : '확인됨'}
        </button>
      </div>

      {open && <Detail inquiry={q} />}
    </li>
  )
}

/* 펼친 내용 — 연락처와 전문, 첨부 */
function Detail({ inquiry: q }: { inquiry: InquiryRow }) {
  return (
    <div className="border-t border-neutral-200 bg-white px-4 py-4">
      <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        <Row k="이메일">
          <a href={`mailto:${q.email}`} className="text-violet-600 hover:underline">
            {q.email}
          </a>
        </Row>
        <Row k="연락처">
          {q.phone ? (
            <a href={`tel:${q.phone}`} className="text-violet-600 hover:underline">
              {q.phone}
            </a>
          ) : (
            <span className="text-neutral-400">없음</span>
          )}
        </Row>
        {q.designer_name && (
          <Row k="디자이너">
            {q.designer_id ? (
              <Link
                href={`/admin/designers/${q.designer_id}`}
                className="text-violet-600 hover:underline"
              >
                {q.designer_name}
              </Link>
            ) : (
              q.designer_name
            )}
          </Row>
        )}
        {q.status_at && (
          <Row k="확인 시각">
            <span className="text-neutral-500">
              {new Date(q.status_at).toLocaleString('ko-KR')}
            </span>
          </Row>
        )}
      </dl>

      <div className="mt-4">
        <p className="text-xs font-medium text-neutral-600">문의 내용</p>
        <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed">{q.message}</p>
      </div>

      {q.files.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-medium text-neutral-600">첨부 파일</p>
          <ul className="mt-1.5 space-y-1">
            {q.files.map((f) => (
              <li key={f.path} className="text-sm">
                <a
                  href={f.url}
                  target="_blank"
                  rel="noopener"
                  className="text-violet-600 hover:underline"
                >
                  {f.name}
                </a>
                <span className="ml-2 text-[11px] text-neutral-400">
                  {(f.size / 1024 / 1024).toFixed(1)}MB
                </span>
              </li>
            ))}
          </ul>
          {/* 서명 링크는 7일짜리다 — 만료된 줄 모르고 "안 열린다"고 하지 않게 */}
          <p className="mt-1.5 text-[11px] text-neutral-400">
            링크는 접수 후 7일간 열립니다. 만료되면 Supabase 대시보드에서 받을 수 있습니다.
          </p>
        </div>
      )}

      <a
        href={`mailto:${q.email}?subject=${encodeURIComponent(`[soom] ${q.name}님 문의 회신`)}`}
        className="mt-4 inline-block rounded-lg bg-neutral-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-violet-600"
      >
        메일로 답장
      </a>
    </div>
  )
}

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <dt className="shrink-0 text-neutral-500">{k}</dt>
      <dd className="min-w-0 truncate">{children}</dd>
    </div>
  )
}
