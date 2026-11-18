import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPaymentLinkByToken } from '@/lib/payment-links-db'
import { missingPayupEnv, payupMode, payupSdkUrl } from '@/lib/payup'
import { isExpired, won, type PaymentLinkRow } from '@/lib/payment-link-shape'
import { PayForm } from './pay-form'

export const metadata: Metadata = {
  title: '결제',
  /* 링크를 받은 사람만 여는 화면이다 */
  robots: { index: false, follow: false },
}

/* 결제 링크(0031_payment_links.sql) — 고객이 메일·문자로 받은 주소로 들어온다.
   상태를 매번 DB 에서 확인하므로 즉시 그려지는 화면이 아니다. */
export const instant = false

const CONTACT = 'manager@soom.it'

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

export default async function PayPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>
  searchParams: Promise<{ error?: string | string[] }>
}) {
  const { token } = await params
  const q = await searchParams
  const returnError = typeof q.error === 'string' ? q.error.slice(0, 300) : null

  const { row, error } = await getPaymentLinkByToken(token)
  if (error) {
    return <Notice title="결제 페이지를 열 수 없습니다" text={`잠시 후 다시 열어 주세요. 계속되면 ${CONTACT} 로 알려 주세요.`} />
  }
  if (!row) notFound()

  if (row.status === 'paid') return <Paid row={row} />
  if (row.status === 'cancelled') {
    return (
      <Notice
        title="환불된 결제입니다"
        text={`${row.title} (${won(row.amount)}) 결제는 환불 처리되었습니다. 카드사에 따라 반영까지 3~7영업일이 걸릴 수 있습니다.`}
      />
    )
  }
  if (row.status === 'void') {
    return <Notice title="취소된 결제 요청입니다" text={`담당자가 이 결제 요청을 취소했습니다. 결제가 필요하시면 ${CONTACT} 로 문의해 주세요.`} />
  }
  if (isExpired(row)) {
    return (
      <Notice
        title="결제 기한이 지났습니다"
        text={`${when(row.expires_at)}까지 결제할 수 있는 요청이었습니다. 새 결제 링크가 필요하시면 ${CONTACT} 로 알려 주세요.`}
      />
    )
  }

  const configured = missingPayupEnv().length === 0

  return (
    <Shell>
      <p className="text-xs font-semibold tracking-widest text-violet-600">PAYMENT</p>
      <h1 className="mt-3 text-2xl font-bold tracking-tight">결제 요청</h1>

      <div className="mt-6 rounded-xl bg-neutral-50 p-5">
        <p className="text-sm text-neutral-500">상품</p>
        <p className="mt-0.5 font-semibold">{row.title}</p>
        {row.description && (
          <p className="mt-3 whitespace-pre-wrap border-t border-neutral-200 pt-3 text-sm leading-relaxed text-neutral-700">
            {row.description}
          </p>
        )}
        <div className="mt-4 flex items-baseline justify-between border-t border-neutral-200 pt-4">
          <span className="text-sm text-neutral-500">결제 금액</span>
          <span className="text-xl font-bold">{won(row.amount)}</span>
        </div>
      </div>
      <p className="mt-2 text-xs text-neutral-400">{when(row.expires_at)}까지 결제할 수 있습니다.</p>

      {configured ? (
        <PayForm
          token={row.token}
          amount={row.amount}
          sdkUrl={payupSdkUrl()}
          testMode={payupMode() === 'test'}
          initial={{
            name: row.buyer_name ?? row.customer_name ?? '',
            email: row.buyer_email ?? row.customer_email ?? '',
            tel: row.buyer_tel ?? row.customer_tel ?? '',
          }}
          initialError={returnError}
        />
      ) : (
        <p className="mt-6 rounded-lg bg-amber-50 px-3.5 py-3 text-sm text-amber-800">
          결제 설정이 아직 끝나지 않아 지금은 결제할 수 없습니다. {CONTACT} 로 알려 주세요.
        </p>
      )}
    </Shell>
  )
}

function Paid({ row }: { row: PaymentLinkRow }) {
  return (
    <Shell>
      <p className="text-xs font-semibold tracking-widest text-emerald-600">PAID</p>
      <h1 className="mt-3 text-2xl font-bold tracking-tight">결제가 완료되었습니다</h1>
      <p className="mt-3 text-sm leading-relaxed text-neutral-600">
        {row.buyer_name ? `${row.buyer_name}님, ` : ''}결제해 주셔서 감사합니다. 담당자가 확인 후 진행 일정을 안내드리겠습니다.
        {row.buyer_email && <> 결제 내역은 {row.buyer_email} 로도 보내 드렸습니다.</>}
      </p>
      <dl className="mt-6 divide-y divide-neutral-200 rounded-xl bg-neutral-50 px-5 text-sm">
        <Line k="상품" v={row.title} />
        <Line k="결제 금액" v={won(row.amount)} strong />
        <Line k="결제 일시" v={when(row.paid_at)} />
        {(row.card_name || row.card_no) && <Line k="카드" v={[row.card_name, row.card_no].filter(Boolean).join(' ')} />}
        {row.auth_number && <Line k="승인번호" v={row.auth_number} />}
      </dl>
    </Shell>
  )
}

function Line({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-4 py-3">
      <dt className="shrink-0 text-neutral-500">{k}</dt>
      <dd className={`min-w-0 break-all text-right ${strong ? 'font-bold' : ''}`}>{v}</dd>
    </div>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex-1 bg-neutral-50">
      <div className="mx-auto max-w-lg px-4 py-10 md:py-16">
        <div className="rounded-2xl border border-neutral-200 bg-white p-6 md:p-8">{children}</div>
        <p className="mt-4 text-center text-xs text-neutral-400">
          문의 <a href={`mailto:${CONTACT}`} className="underline">{CONTACT}</a>
        </p>
      </div>
    </main>
  )
}

function Notice({ title, text }: { title: string; text: string }) {
  return (
    <Shell>
      <h1 className="text-xl font-bold tracking-tight">{title}</h1>
      <p className="mt-3 text-sm leading-relaxed text-neutral-600">{text}</p>
      <Link
        href="/"
        className="mt-6 inline-block rounded-xl bg-neutral-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-600"
      >
        SOOM 둘러보기
      </Link>
    </Shell>
  )
}
