'use client'

import Script from 'next/script'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { checkBuyer, won, type BuyerInput } from '@/lib/payment-link-shape'
import { useActionTransition } from '@/lib/use-action-transition'
import { confirmFromWindow, startPayment } from './actions'

/* 결제 페이지 본체 — 결제자 정보, 동의, 결제하기.

   페이업 SDK(goPayupPay)가 결제창을 띄운다. PC 는 이 페이지 위에 레이어로 뜨고,
   인증이 끝나면 SDK 가 전역 함수 payupPaymentSubmit(form) 을 부른다 — 그 폼을
   /api/payup/return 으로 보내면 서버가 승인하고 이 페이지로 되돌린다.
   모바일은 결제창으로 페이지 자체가 넘어갔다가 returnUrl 로 돌아온다. */

declare global {
  interface Window {
    goPayupPay?: (data: Record<string, string>) => void
    payupPaymentSubmit?: (form: HTMLFormElement) => void
    payupPaymentClose?: (form?: HTMLFormElement) => void
  }
}

const label = 'mb-1.5 block text-xs font-medium text-neutral-600'
const field =
  'h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 text-[15px] outline-none ring-violet-500 focus:ring-2'

export function PayForm(p: {
  token: string
  amount: number
  sdkUrl: string
  testMode: boolean
  initial: BuyerInput
  initialError: string | null
}) {
  const [v, setV] = useState<BuyerInput>(p.initial)
  const [touched, setTouched] = useState<Partial<Record<keyof BuyerInput, boolean>>>({})
  const [agree, setAgree] = useState(false)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState(p.initialError ?? '')
  /* 결제창이 떠 있거나, 승인 요청으로 페이지를 떠나는 중 */
  const [paying, setPaying] = useState(false)
  const [preparing, start] = useActionTransition()
  /* 같은 트랜지션을 결제 준비·승인 둘 다에 쓴다 — 버튼 글자를 가르려고 */
  const [phase, setPhase] = useState<'prepare' | 'confirm'>('prepare')
  const router = useRouter()

  const bad = checkBuyer(v)
  const invalid = Object.keys(bad).length > 0

  /* SDK 가 부르는 전역 콜백 — 이름을 바꾸면 안 된다.
     SDK 는 이걸 부르기 전에 결제창 레이어를 이미 걷어 낸다. 폼을 그대로 submit 하면
     페이지가 통째로 다시 열려(승인 거절 시) 적어 둔 값이 날아가므로, 값만 꺼내
     서버 액션으로 승인하고 이 화면에 머문다. */
  useEffect(() => {
    window.payupPaymentSubmit = (form) => {
      const fd = new FormData(form)
      const get = (k: string) => {
        const v = fd.get(k)
        return typeof v === 'string' ? v : ''
      }
      setPaying(false)
      setError('')
      setPhase('confirm')
      start(async () => {
        const r = await confirmFromWindow(p.token, {
          transactionId: get('transactionId'),
          orderNumber: get('orderNumber'),
          amount: get('amount') || null,
        })
        if (!r.ok) return setError(`결제가 완료되지 않았습니다: ${r.error}`)
        /* 서버가 완료 화면을 그린다 */
        router.refresh()
      }, '결제 승인')
    }
    window.payupPaymentClose = () => {
      setPaying(false)
      setError('결제창을 닫았습니다. 다시 결제하려면 버튼을 눌러 주세요.')
    }
    return () => {
      delete window.payupPaymentSubmit
      delete window.payupPaymentClose
    }
  }, [p.token, start, router])

  /* 뒤로가기(bfcache)로 돌아오면 '진행 중' 상태가 남아 버튼이 잠긴다 */
  useEffect(() => {
    const onShow = (e: PageTransitionEvent) => e.persisted && setPaying(false)
    window.addEventListener('pageshow', onShow)
    return () => window.removeEventListener('pageshow', onShow)
  }, [])

  const set = (k: keyof BuyerInput, value: string) => {
    setV((s) => ({ ...s, [k]: value }))
    setTouched((s) => ({ ...s, [k]: true }))
  }

  const pay = () => {
    setTouched({ name: true, email: true, tel: true })
    if (invalid) return setError(Object.values(bad)[0]!)
    if (!agree) return setError('주문 내용과 환불 정책에 동의해 주세요.')
    if (!window.goPayupPay) return setError('결제 모듈을 불러오지 못했습니다. 새로고침 후 다시 시도해 주세요.')
    setError('')
    setPhase('prepare')
    start(async () => {
      const r = await startPayment(p.token, v)
      if (!r.ok) return setError(r.error)
      setPaying(true)
      try {
        window.goPayupPay!(r.data)
      } catch {
        setPaying(false)
        setError('결제창을 열지 못했습니다. 새로고침 후 다시 시도해 주세요.')
      }
    }, '결제 준비')
  }

  const busy = preparing || paying
  const buttonText = !ready
    ? '결제 모듈 불러오는 중…'
    : preparing
      ? phase === 'confirm'
        ? '결제 확인 중…'
        : '결제 준비 중…'
      : paying
        ? '결제창에서 진행 중…'
        : `${won(p.amount)} 결제하기`

  const hint = (k: keyof BuyerInput) =>
    touched[k] && bad[k] ? <p className="mt-1 text-xs text-red-600">{bad[k]}</p> : null

  return (
    <div className="mt-8">
      <Script
        src={p.sdkUrl}
        strategy="afterInteractive"
        onReady={() => setReady(true)}
        onError={() => setError('결제 모듈을 불러오지 못했습니다. 광고 차단 기능을 끄거나 새로고침해 주세요.')}
      />

      <div className="space-y-4">
        <div>
          <label htmlFor="pay-name" className={label}>
            이름 또는 회사명 <span className="text-red-500">*</span>
          </label>
          <input
            id="pay-name"
            value={v.name}
            onChange={(e) => set('name', e.target.value)}
            maxLength={50}
            autoComplete="name"
            className={field}
          />
          {hint('name')}
        </div>
        <div>
          <label htmlFor="pay-email" className={label}>
            이메일 <span className="text-red-500">*</span>
            <span className="ml-1 font-normal text-neutral-400">(결제 확인 메일을 보내 드립니다)</span>
          </label>
          <input
            id="pay-email"
            type="email"
            inputMode="email"
            value={v.email}
            onChange={(e) => set('email', e.target.value)}
            autoComplete="email"
            className={field}
          />
          {hint('email')}
        </div>
        <div>
          <label htmlFor="pay-tel" className={label}>
            휴대폰 <span className="font-normal text-neutral-400">(선택)</span>
          </label>
          <input
            id="pay-tel"
            type="tel"
            inputMode="tel"
            value={v.tel}
            onChange={(e) => set('tel', e.target.value)}
            placeholder="010-1234-5678"
            autoComplete="tel"
            className={field}
          />
          {hint('tel')}
        </div>
      </div>

      <label className="mt-6 flex cursor-pointer items-start gap-2.5 text-sm leading-relaxed text-neutral-700">
        <input
          type="checkbox"
          checked={agree}
          onChange={(e) => setAgree(e.target.checked)}
          className="mt-1 size-4 shrink-0 accent-violet-600"
        />
        <span>
          [필수] 주문 내용과{' '}
          <Link href="/terms#refund" target="_blank" className="text-violet-600 underline">
            환불 정책
          </Link>
          을 확인했으며, 결제에 동의합니다.
        </span>
      </label>

      {error && (
        <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3.5 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={pay}
        disabled={!ready || busy}
        className="mt-5 h-12 w-full rounded-xl bg-neutral-900 text-[15px] font-semibold text-white transition hover:bg-violet-600 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {buttonText}
      </button>

      {/* 카드사·간편결제 인증은 나이스페이가 새 창으로 연다. 팝업이 막히면 결제창이
          회색 로딩에서 멈춘 것처럼 보인다 — 그 아래로 보이는 이 자리에 까닭을 적어 둔다 */}
      {paying && (
        <p className="mt-3 rounded-lg bg-amber-50 px-3.5 py-3 text-sm leading-relaxed text-amber-800">
          카드사·간편결제 인증은 <b>새 창(팝업)</b>으로 열립니다. 로딩에서 멈춰 있다면 주소창 오른쪽의 팝업 차단
          표시를 눌러 허용하거나, 다른 창 뒤에 열린 인증 창을 찾아 주세요.
        </p>
      )}

      <p className="mt-3 text-center text-xs text-neutral-400">
        결제는 페이업(PAYUP) 결제창에서 안전하게 진행됩니다.
        {p.testMode && <span className="ml-1 font-medium text-amber-600">· 테스트 결제</span>}
      </p>
    </div>
  )
}
