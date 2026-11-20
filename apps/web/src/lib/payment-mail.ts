import 'server-only'
import { Resend } from 'resend'
import { allowedEmails } from './admin-auth'
import { won, type PaymentLinkRow } from './payment-link-shape'

const FROM = process.env.MAIL_FROM_EMAIL ?? 'onboarding@resend.dev'

/* 결제 링크 메일 — 둘이다.
   1) 링크 발송: 어드민이 고객에게 결제 링크를 보낸다.
   2) 결제 완료: 관리자(ADMIN_EMAILS 또는 PAYMENT_NOTIFY_EMAILS)와 결제한 고객에게 보낸다.
   어느 쪽이 실패해도 링크·결제는 이미 유효하다 — 성공 여부만 돌려준다. */

type Sent = { ok: true } | { ok: false; error: string }

function notifyTo(): string[] {
  const own = (process.env.PAYMENT_NOTIFY_EMAILS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  return own.length > 0 ? own : allowedEmails()
}

function when(iso: string | null) {
  if (!iso) return '-'
  return new Date(iso).toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

async function send(msg: { to: string | string[]; subject: string; html: string; replyTo?: string }): Promise<Sent> {
  if (!process.env.RESEND_API_KEY) return { ok: false, error: '메일 설정(RESEND_API_KEY)이 없습니다.' }
  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    const { error } = await resend.emails.send({ from: `soom <${FROM}>`, ...msg })
    if (error) throw error
    return { ok: true }
  } catch (err) {
    console.error('[payment-mail] 발송 실패:', msg.subject, err)
    return { ok: false, error: err instanceof Error ? err.message : '알 수 없는 오류' }
  }
}

const wrap = (body: string) =>
  `<div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;line-height:1.7;color:#18181b">${body}</div>`

function table(rows: [string, string][]) {
  return `<table style="border-collapse:collapse;font-size:14px;margin:0 0 20px;width:100%">${rows
    .map(
      ([k, v]) =>
        `<tr><th style="text-align:left;color:#71717a;font-weight:500;padding:6px 16px 6px 0;white-space:nowrap;vertical-align:top">${esc(k)}</th><td style="padding:6px 0;white-space:pre-wrap">${esc(v)}</td></tr>`,
    )
    .join('')}</table>`
}

export async function sendLinkMail(row: PaymentLinkRow, url: string): Promise<Sent> {
  if (!row.customer_email) return { ok: false, error: '고객 이메일이 없습니다.' }
  const name = row.customer_name ? `${esc(row.customer_name)}님, ` : ''
  const html = wrap(`
    <h2 style="margin:0 0 18px;font-size:18px">결제 요청이 도착했습니다</h2>
    <p style="margin:0 0 18px;font-size:14px">${name}상담하신 내용으로 결제 링크를 보내 드립니다.</p>
    ${table([
      ['상품', row.title],
      ['금액', won(row.amount)],
      ...(row.description ? ([['내용', row.description]] as [string, string][]) : []),
      ['결제 기한', `${when(row.expires_at)}까지`],
    ])}
    <p style="margin:0 0 22px">
      <a href="${url}" style="display:inline-block;background:#18181b;color:#fff;text-decoration:none;padding:13px 26px;border-radius:10px;font-size:14px;font-weight:600">${won(row.amount)} 결제하기</a>
    </p>
    <p style="font-size:13px;color:#777;margin:0 0 6px">버튼이 눌리지 않으면 아래 주소를 복사해 주소창에 붙여 넣어 주세요.</p>
    <p style="font-size:12px;color:#999;margin:0;word-break:break-all">${esc(url)}</p>`)
  return send({ to: row.customer_email, subject: `[soom] ${row.title} 결제 요청 (${won(row.amount)})`, html })
}

export async function sendPaidMail(row: PaymentLinkRow, url: string): Promise<Sent> {
  const detail: [string, string][] = [
    ['상품', row.title],
    ['결제 금액', won(row.amount)],
    ['결제 일시', when(row.paid_at)],
    ['결제자', row.buyer_name ?? '-'],
    ['이메일', row.buyer_email ?? '-'],
    ...(row.buyer_tel ? ([['연락처', row.buyer_tel]] as [string, string][]) : []),
    ['카드', [row.card_name, row.card_no].filter(Boolean).join(' ') || '-'],
    ['할부', !row.quota || row.quota === '0' ? '일시불' : `${row.quota}개월`],
    ['승인번호', row.auth_number ?? '-'],
    ['거래번호', row.transaction_id ?? '-'],
  ]

  const errors: string[] = []

  const admins = notifyTo()
  if (admins.length > 0) {
    const r = await send({
      to: admins,
      replyTo: row.buyer_email ?? undefined,
      subject: `[결제 완료] ${row.buyer_name ?? ''} · ${row.title} · ${won(row.amount)}`,
      html: wrap(`
        <h2 style="margin:0 0 18px;font-size:18px">결제가 완료되었습니다</h2>
        ${table(detail)}
        ${row.description ? `<p style="font-size:13px;color:#555;margin:0 0 12px;white-space:pre-wrap">${esc(row.description)}</p>` : ''}
        <p style="font-size:12px;color:#999;margin:0">결제 페이지: ${esc(url)}</p>`),
    })
    if (!r.ok) errors.push(`관리자: ${r.error}`)
  } else {
    errors.push('관리자 알림 주소(ADMIN_EMAILS)가 없습니다.')
  }

  if (row.buyer_email) {
    const r = await send({
      to: row.buyer_email,
      subject: `[soom] 결제가 완료되었습니다 — ${row.title}`,
      html: wrap(`
        <h2 style="margin:0 0 18px;font-size:18px">결제가 완료되었습니다</h2>
        <p style="margin:0 0 18px;font-size:14px">${esc(row.buyer_name ?? '')}님, 결제해 주셔서 감사합니다. 담당자가 확인 후 진행 일정을 안내드리겠습니다.</p>
        ${table(detail.filter(([k]) => k !== '이메일' && k !== '연락처'))}
        <p style="font-size:13px;color:#777;margin:0">결제 내역은 언제든 이 페이지에서 다시 볼 수 있습니다.<br><a href="${url}" style="color:#7c3aed">${esc(url)}</a></p>`),
    })
    if (!r.ok) errors.push(`고객: ${r.error}`)
  }

  return errors.length === 0 ? { ok: true } : { ok: false, error: errors.join(' / ') }
}

function esc(s: string) {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  )
}
