'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useActionTransition } from '@/lib/use-action-transition'
import { dateTime } from '@/lib/format-date'
import {
  DEFAULT_EXPIRE_DAYS,
  EXPIRE_OPTIONS,
  MAX_DESCRIPTION,
  MAX_TITLE,
  STATUS_LABELS,
  checkLinkInput,
  isExpired,
  won,
  type BadgeStatus,
  type LinkInput,
  type PaymentLinkRow,
} from '@/lib/payment-link-shape'
import {
  createPaymentLink,
  refundPaymentLink,
  resendLinkMail,
  voidPaymentLink,
} from '@/app/admin/payments/actions'
import { Field, ghostButton, input } from './form-bits'
import { Flash } from '@/components/flash'

export type Row = PaymentLinkRow & { url: string }
type Notice = { kind: 'ok' | 'warn' | 'error'; text: string } | null
type Filter = 'all' | 'pending' | 'paid' | 'cancelled' | 'closed'

const FILTERS: [Filter, string][] = [
  ['all', '전체'],
  ['pending', '결제 대기'],
  ['paid', '결제 완료'],
  ['cancelled', '환불됨'],
  ['closed', '만료·취소'],
]

const BADGE: Record<BadgeStatus, string> = {
  pending: 'bg-violet-600 text-white',
  paid: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-neutral-200 text-neutral-700',
  expired: 'bg-amber-100 text-amber-800',
  void: 'bg-neutral-200 text-neutral-500',
}

const badgeOf = (r: Row): BadgeStatus => (isExpired(r) ? 'expired' : r.status)

function matches(r: Row, f: Filter) {
  const b = badgeOf(r)
  if (f === 'all') return true
  if (f === 'closed') return b === 'expired' || b === 'void'
  return b === f
}

/* 문자·카톡에 붙여 넣을 문구 — 링크만 보내면 스팸처럼 보인다 */
function smsText(r: { title: string; amount: number; url: string }) {
  return `[soom] ${r.title} 결제 요청 (${won(r.amount)})\n아래 링크에서 결제해 주세요.\n${r.url}`
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

export function PaymentLinkManager({ rows, mailReady }: { rows: Row[]; mailReady: boolean }) {
  const [filter, setFilter] = useState<Filter>('all')
  const counts = useMemo(() => {
    const c = { all: 0, pending: 0, paid: 0, cancelled: 0, closed: 0 } as Record<Filter, number>
    for (const r of rows) for (const [f] of FILTERS) if (matches(r, f)) c[f]++
    return c
  }, [rows])
  const shown = rows.filter((r) => matches(r, filter))

  return (
    <div className="space-y-6">
      <CreateForm mailReady={mailReady} />

      <section className="min-w-0">
        <nav className="mb-4 flex gap-1 overflow-x-auto border-b border-neutral-200">
          {FILTERS.map(([f, label]) => (
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
              {label} <span className={filter === f ? 'text-neutral-400' : 'text-neutral-300'}>{counts[f]}</span>
            </button>
          ))}
        </nav>

        {shown.length === 0 ? (
          <p className="rounded-xl border border-dashed border-neutral-300 py-16 text-center text-sm text-neutral-500">
            {rows.length === 0 ? '아직 만든 결제 링크가 없습니다.' : '해당하는 결제 링크가 없습니다.'}
          </p>
        ) : (
          <ul className="divide-y divide-neutral-200 overflow-hidden rounded-xl ring-1 ring-neutral-200">
            {shown.map((r) => (
              <Item key={r.id} r={r} mailReady={mailReady} />
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

/* ─────────── 만들기 ─────────── */

const EMPTY: LinkInput = {
  title: '',
  amount: 0,
  description: '',
  customerName: '',
  customerEmail: '',
  customerTel: '',
  expiresInDays: DEFAULT_EXPIRE_DAYS,
}

function CreateForm({ mailReady }: { mailReady: boolean }) {
  const [v, setV] = useState<LinkInput>(EMPTY)
  const [amountText, setAmountText] = useState('')
  const [touched, setTouched] = useState<Partial<Record<keyof LinkInput, boolean>>>({})
  const [sendMail, setSendMail] = useState(true)
  const [notice, setNotice] = useState<Notice>(null)
  const [made, setMade] = useState<{ url: string; title: string; amount: number } | null>(null)
  const [copied, setCopied] = useState<'url' | 'sms' | null>(null)
  const [pending, start] = useActionTransition()
  const router = useRouter()

  const bad = checkLinkInput(v)
  const invalid = Object.keys(bad).length > 0
  const willMail = mailReady && sendMail && Boolean(v.customerEmail.trim())

  const set = <K extends keyof LinkInput>(k: K, value: LinkInput[K]) => {
    setV((s) => ({ ...s, [k]: value }))
    setTouched((s) => ({ ...s, [k]: true }))
  }

  const onAmount = (raw: string) => {
    const digits = raw.replace(/[^\d]/g, '').replace(/^0+/, '').slice(0, 9)
    setAmountText(digits ? Number(digits).toLocaleString('ko-KR') : '')
    set('amount', digits ? Number(digits) : 0)
  }

  const hint = (k: keyof LinkInput) =>
    touched[k] && bad[k] ? <p className="mt-1 text-xs text-red-600">{bad[k]}</p> : null

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setTouched({ title: true, amount: true, description: true, customerEmail: true, customerTel: true, customerName: true })
    setNotice(null)
    if (invalid) return setNotice({ kind: 'error', text: Object.values(bad)[0]! })
    start(async () => {
      const r = await createPaymentLink(v, willMail)
      if (!r.ok) return setNotice({ kind: 'error', text: r.error })
      setMade({ url: r.url, title: v.title.trim(), amount: v.amount })
      setCopied(null)
      if (r.mailError) setNotice({ kind: 'warn', text: `링크는 만들었지만 메일을 보내지 못했습니다: ${r.mailError}` })
      else setNotice({ kind: 'ok', text: r.mailed ? '결제 링크를 만들고 고객에게 메일을 보냈습니다.' : '결제 링크를 만들었습니다.' })
      setV(EMPTY)
      setAmountText('')
      setTouched({})
      router.refresh()
    }, '결제 링크 만들기')
  }

  const copy = async (kind: 'url' | 'sms') => {
    if (!made) return
    const ok = await copyText(kind === 'url' ? made.url : smsText(made))
    if (ok) {
      setCopied(kind)
      setTimeout(() => setCopied(null), 1500)
    } else setNotice({ kind: 'warn', text: '클립보드를 쓸 수 없는 브라우저입니다. 주소를 직접 선택해 복사해 주세요.' })
  }

  return (
    <form onSubmit={submit} className="rounded-xl bg-white p-5 ring-1 ring-neutral-200">
      <h2 className="text-sm font-semibold">새 결제 링크</h2>

      <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem]">
        <div>
          <Field label="상품명" required hint={`결제창에 보입니다 · ${MAX_TITLE}자 이내`}>
            <input
              value={v.title}
              onChange={(e) => set('title', e.target.value)}
              maxLength={MAX_TITLE + 10}
              placeholder="예: 로고 디자인 (프리미엄)"
              className={input}
            />
          </Field>
          {hint('title')}
        </div>
        <div>
          <Field label="금액" required hint="원">
            <input
              value={amountText}
              onChange={(e) => onAmount(e.target.value)}
              inputMode="numeric"
              placeholder="예: 550,000"
              className={`${input} text-right tabular-nums`}
            />
          </Field>
          {hint('amount')}
        </div>
      </div>

      <div className="mt-3">
        <Field label="상세 설명" hint="선택 · 결제 페이지에 보입니다">
          <textarea
            value={v.description}
            onChange={(e) => set('description', e.target.value)}
            maxLength={MAX_DESCRIPTION}
            rows={3}
            placeholder={'예: 로고 시안 3종 + 수정 2회\n작업 기간 2주'}
            className={`${input} h-auto py-2 leading-relaxed`}
          />
        </Field>
        {hint('description')}
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_8rem]">
        <div>
          <Field label="고객명" hint="선택">
            <input value={v.customerName} onChange={(e) => set('customerName', e.target.value)} maxLength={50} className={input} />
          </Field>
          {hint('customerName')}
        </div>
        <div>
          <Field label="고객 이메일" hint="선택 · 링크 메일 발송">
            <input
              type="email"
              value={v.customerEmail}
              onChange={(e) => set('customerEmail', e.target.value)}
              className={input}
            />
          </Field>
          {hint('customerEmail')}
        </div>
        <div>
          <Field label="고객 휴대폰" hint="선택">
            <input
              type="tel"
              value={v.customerTel}
              onChange={(e) => set('customerTel', e.target.value)}
              placeholder="010-1234-5678"
              className={input}
            />
          </Field>
          {hint('customerTel')}
        </div>
        <Field label="유효기간">
          <select
            value={v.expiresInDays}
            onChange={(e) => set('expiresInDays', Number(e.target.value))}
            className={input}
          >
            {EXPIRE_OPTIONS.map((o) => (
              <option key={o.days} value={o.days}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <label
          className={`flex items-center gap-2 text-sm ${v.customerEmail.trim() && mailReady ? 'text-neutral-700' : 'text-neutral-400'}`}
        >
          <input
            type="checkbox"
            checked={sendMail}
            onChange={(e) => setSendMail(e.target.checked)}
            disabled={!mailReady || !v.customerEmail.trim()}
            className="size-4 accent-violet-600"
          />
          만들면서 고객 이메일로 링크 보내기
          {!v.customerEmail.trim() && <span className="text-xs">(이메일을 적으면 켜집니다)</span>}
        </label>
        <button
          type="submit"
          disabled={pending || invalid}
          className="h-9 rounded-lg bg-neutral-900 px-4 text-sm font-medium text-white transition hover:bg-violet-600 disabled:opacity-50"
        >
          {pending ? '만드는 중…' : willMail ? '링크 만들고 메일 보내기' : '결제 링크 만들기'}
        </button>
      </div>

      <Flash msg={notice} onDone={() => setNotice(null)} className="mt-4" />

      {made && (
        <div className="mt-4 rounded-lg bg-violet-50 p-4">
          <p className="text-xs font-medium text-violet-700">
            만든 링크 · {made.title} · {won(made.amount)}
          </p>
          <p className="mt-1.5 select-all break-all font-mono text-sm text-neutral-900">{made.url}</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <button type="button" onClick={() => copy('url')} className={`${ghostButton} bg-white`}>
              {copied === 'url' ? '복사됨' : '링크 복사'}
            </button>
            <button type="button" onClick={() => copy('sms')} className={`${ghostButton} bg-white`}>
              {copied === 'sms' ? '복사됨' : '문자용 문구 복사'}
            </button>
            <a href={made.url} target="_blank" rel="noopener noreferrer" className={`${ghostButton} bg-white`}>
              결제 페이지 열기 ↗
            </a>
          </div>
        </div>
      )}
    </form>
  )
}

/* ─────────── 한 줄 ─────────── */

function Item({ r, mailReady }: { r: Row; mailReady: boolean }) {
  const [pending, start] = useActionTransition()
  const [notice, setNotice] = useState<Notice>(null)
  const [copied, setCopied] = useState<'url' | 'sms' | null>(null)
  const [open, setOpen] = useState(false)
  const router = useRouter()

  const b = badgeOf(r)
  const live = b === 'pending'

  const copy = async (kind: 'url' | 'sms') => {
    const ok = await copyText(kind === 'url' ? r.url : smsText(r))
    if (ok) {
      setCopied(kind)
      setTimeout(() => setCopied(null), 1500)
    } else setNotice({ kind: 'warn', text: '클립보드를 쓸 수 없습니다. 펼쳐서 주소를 직접 복사해 주세요.' })
  }

  const run = (fn: () => Promise<{ ok: true } | { ok: false; error: string }>, okText: string, what: string) => {
    setNotice(null)
    start(async () => {
      const res = await fn()
      if (!res.ok) return setNotice({ kind: 'error', text: res.error })
      setNotice({ kind: 'ok', text: okText })
      router.refresh()
    }, what)
  }

  const mail = () => run(() => resendLinkMail(r.id), `${r.customer_email} 로 링크를 보냈습니다.`, '링크 메일 발송')
  const cancel = () => {
    if (!confirm(`"${r.title}" 결제 링크를 취소할까요? 고객이 더는 결제할 수 없습니다.`)) return
    run(() => voidPaymentLink(r.id), '링크를 취소했습니다.', '링크 취소')
  }
  const refund = () => {
    const reason = prompt(`${r.buyer_name ?? ''} · ${won(r.amount)} 결제를 전액 환불합니다.\n환불 사유를 적어 주세요.`, '고객 요청')
    if (reason === null) return
    run(() => refundPaymentLink(r.id, reason), '전액 환불했습니다.', '환불')
  }

  const who = r.status === 'paid' || r.status === 'cancelled' ? r.buyer_name : r.customer_name

  return (
    <li className={`p-4 ${live || r.status === 'paid' ? 'bg-white' : 'bg-neutral-50'}`}>
      <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
        {/* 모바일에서는 버튼이 옆에 붙으면 제목 칸이 한 글자 폭으로 눌린다 — 한 줄을 다 쓰고 버튼은 아래로 */}
        <button type="button" onClick={() => setOpen((o) => !o)} className="w-full min-w-0 text-left sm:w-auto sm:flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${BADGE[b]}`}>{STATUS_LABELS[b]}</span>
            <span className="font-semibold">{r.title}</span>
            <span className="font-semibold tabular-nums">{won(r.amount)}</span>
            {who && <span className="text-sm text-neutral-500">{who}</span>}
          </div>
          <p className="mt-1 text-[11px] text-neutral-400">
            생성 {dateTime(r.created_at)}
            {r.status === 'paid' && r.paid_at && <span className="text-emerald-700"> · 결제 {dateTime(r.paid_at)}</span>}
            {r.status === 'cancelled' && r.cancelled_at && ` · 환불 ${dateTime(r.cancelled_at)}`}
            {r.status === 'pending' && ` · 기한 ${dateTime(r.expires_at)}`}
            {r.link_mailed_at && ` · 링크 메일 ${dateTime(r.link_mailed_at)}`}
          </p>
          {live && r.last_error && <p className="mt-1 text-xs text-amber-700">최근 결제 시도 실패: {r.last_error}</p>}
          {r.mail_error && <p className="mt-1 text-xs text-amber-700">메일 실패 — {r.mail_error}</p>}
        </button>

        <div className="flex shrink-0 flex-wrap gap-1.5">
          {live && (
            <>
              <button onClick={() => copy('url')} className={ghostButton}>
                {copied === 'url' ? '복사됨' : '링크 복사'}
              </button>
              <button onClick={() => copy('sms')} className={ghostButton}>
                {copied === 'sms' ? '복사됨' : '문자용 복사'}
              </button>
              {mailReady && r.customer_email && (
                <button onClick={mail} disabled={pending} className={ghostButton}>
                  {pending ? '…' : r.link_mailed_at ? '메일 다시' : '메일 보내기'}
                </button>
              )}
              <button onClick={cancel} disabled={pending} className={`${ghostButton} text-red-600`}>
                취소
              </button>
            </>
          )}
          {r.status === 'paid' && (
            <button onClick={refund} disabled={pending} className={`${ghostButton} text-red-600`}>
              {pending ? '환불 중…' : '환불'}
            </button>
          )}
        </div>
      </div>

      <Flash msg={notice} onDone={() => setNotice(null)} className="mt-3" />

      {open && (
        <dl className="mt-3 grid gap-x-6 gap-y-1.5 rounded-lg bg-neutral-50 p-3 text-xs sm:grid-cols-2">
          <Detail k="결제 링크" v={r.url} mono />
          <Detail k="주문번호" v={r.order_number ?? r.order_no} mono />
          {r.description && <Detail k="상세 설명" v={r.description} wide />}
          {(r.customer_email || r.customer_tel) && (
            <Detail k="고객 연락처" v={[r.customer_email, r.customer_tel].filter(Boolean).join(' · ')} />
          )}
          {r.buyer_name && (
            <Detail k="결제자" v={[r.buyer_name, r.buyer_email, r.buyer_tel].filter(Boolean).join(' · ')} />
          )}
          {r.transaction_id && <Detail k="페이업 거래번호" v={r.transaction_id} mono />}
          {r.auth_number && <Detail k="승인번호" v={r.auth_number} mono />}
          {(r.card_name || r.card_no) && (
            <Detail
              k="카드"
              v={`${[r.card_name, r.card_no].filter(Boolean).join(' ')} · ${!r.quota || r.quota === '0' ? '일시불' : `${r.quota}개월`}`}
            />
          )}
          {r.paid_mailed_at && <Detail k="결제 알림 메일" v={dateTime(r.paid_mailed_at)} />}
          {r.created_by && <Detail k="만든 사람" v={r.created_by} />}
        </dl>
      )}
    </li>
  )
}

function Detail({ k, v, mono, wide }: { k: string; v: string; mono?: boolean; wide?: boolean }) {
  return (
    <div className={`min-w-0 ${wide ? 'sm:col-span-2' : ''}`}>
      <dt className="text-neutral-400">{k}</dt>
      <dd className={`select-all whitespace-pre-wrap break-all text-neutral-800 ${mono ? 'font-mono' : ''}`}>{v}</dd>
    </div>
  )
}
