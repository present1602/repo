'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  requestSignupCode,
  signUpWithInvite,
  verifyInviteCode,
  verifySignupCode,
  type Result,
} from '@/app/studio/signup/actions'
import { CODE_MAX, CODE_MIN, EMAIL_RE, PASSWORD_MIN, VERIFY_CODE_LEN, normalizeCode } from '@/lib/invite-shape'

/* 초대코드 인증 → 이메일 인증 → 비밀번호 순서로 채운다.
   인증코드는 유효한 초대코드가 있어야 보내므로 초대코드를 맨 위에 둔다.
   locked — 이 브라우저는 초대코드를 너무 많이 틀렸다(서버 쿠키로 판단). */
export function DesignerSignupForm({ locked: lockedAtLoad = false }: { locked?: boolean }) {
  const router = useRouter()

  /* 초대코드 단계 — 통과해야 이메일 칸이 열린다 */
  const [inviteOk, setInviteOk] = useState(false)
  const [locked, setLocked] = useState(lockedAtLoad)

  const [invite, setInvite] = useState('')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')

  /* 인증 단계 — 이메일을 고치면 처음부터 다시 */
  const [sent, setSent] = useState(false)
  const [verified, setVerified] = useState(false)

  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [pending, start] = useTransition()

  const run = (fn: () => Promise<void>) => {
    setError(null)
    setInfo(null)
    start(fn)
  }

  /* 실패를 보여 주고, 잠겼으면 화면도 잠근다 */
  const failed = (r: Extract<Result, { ok: false }>) => {
    setError(r.error)
    if (r.locked) setLocked(true)
  }

  const checkInvite = () => {
    const n = normalizeCode(invite).length
    if (n < CODE_MIN || n > CODE_MAX) return setError('초대코드를 입력해 주세요.')
    run(async () => {
      const r = await verifyInviteCode(invite)
      if (!r.ok) return failed(r)
      setInvite(normalizeCode(invite))
      setInviteOk(true)
      setInfo('초대코드가 확인됐습니다. 이메일을 인증해 주세요.')
    })
  }

  const send = () => {
    if (!inviteOk) return setError('초대코드를 먼저 인증해 주세요.')
    if (!EMAIL_RE.test(email.trim())) return setError('이메일 주소를 확인해 주세요.')
    run(async () => {
      const r = await requestSignupCode(email, invite)
      if (!r.ok) return failed(r)
      setSent(true)
      setCode('')
      setInfo(`${email.trim()} 으로 인증코드를 보냈습니다. 10분 안에 입력해 주세요.`)
    })
  }

  const verify = () =>
    run(async () => {
      const r = await verifySignupCode(email, code)
      if (!r.ok) return setError(r.error)
      setVerified(true)
      setInfo('이메일 인증이 완료됐습니다.')
    })

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!verified) return setError('이메일 인증을 먼저 완료해 주세요.')
    if (password.length < PASSWORD_MIN) return setError(`비밀번호는 ${PASSWORD_MIN}자 이상이어야 합니다.`)
    if (password !== confirm) return setError('비밀번호 확인이 일치하지 않습니다.')
    run(async () => {
      const r = await signUpWithInvite({ email, password, passwordConfirm: confirm, inviteCode: invite })
      if (!r.ok) return failed(r)
      /* 가입과 함께 로그인 쿠키가 심어졌다 — 서버 쪽을 다시 읽게 한다 */
      router.refresh()
      router.replace('/studio')
    })
  }

  const changeEmail = (v: string) => {
    setEmail(v)
    if (sent || verified) {
      setSent(false)
      setVerified(false)
      setCode('')
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3.5">
      {/* 잠겼으면 아래 회색 안내 하나만 — 같은 말이 두 번 뜨지 않게 */}
      {error && !locked && <p className="rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700">{error}</p>}
      {info && !error && <p className="rounded-lg bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800">{info}</p>}

      <Label text="초대코드">
        <div className="flex gap-2">
          <input
            value={invite}
            onChange={(e) => setInvite(e.target.value)}
            /* 붙여 넣은 값의 공백·소문자를 정리해 보여 준다 */
            onBlur={() => setInvite(normalizeCode(invite))}
            onKeyDown={(e) => {
              /* 엔터로 폼 전체가 제출되지 않게 — 이 칸에서는 인증만 */
              if (e.key === 'Enter') {
                e.preventDefault()
                if (!inviteOk && !locked) checkInvite()
              }
            }}
            maxLength={CODE_MAX + 5}
            disabled={inviteOk || locked}
            required
            autoComplete="off"
            placeholder="관리자에게 받은 코드"
            className={`${input} font-mono uppercase tracking-wider`}
          />
          <button
            type="button"
            onClick={checkInvite}
            disabled={pending || inviteOk || locked}
            className="shrink-0 rounded-lg bg-neutral-900 px-4 text-sm font-medium text-white transition hover:bg-violet-600 disabled:bg-neutral-300"
          >
            {inviteOk ? '인증됨' : '인증'}
          </button>
        </div>
      </Label>

      {locked && (
        <p className="rounded-lg bg-neutral-100 px-3 py-2.5 text-sm text-neutral-600">
          초대코드를 여러 번 잘못 입력해 이 브라우저에서는 더 시도할 수 없습니다. 관리자에게 문의해 주세요.
        </p>
      )}

      <Label text="이메일 (아이디)">
        <div className="flex gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => changeEmail(e.target.value)}
            required
            disabled={!inviteOk}
            autoComplete="email"
            placeholder={inviteOk ? undefined : '초대코드를 먼저 인증해 주세요'}
            className={input}
          />
          <button
            type="button"
            onClick={send}
            disabled={pending || verified || !inviteOk}
            className="shrink-0 rounded-lg border border-neutral-300 px-3 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100 disabled:opacity-50"
          >
            {verified ? '인증됨' : sent ? '다시 받기' : '인증코드 받기'}
          </button>
        </div>
      </Label>

      {sent && !verified && (
        <Label text="인증코드">
          <div className="flex gap-2">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, VERIFY_CODE_LEN))}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder={`숫자 ${VERIFY_CODE_LEN}자리`}
              className={`${input} tracking-[0.3em]`}
            />
            <button
              type="button"
              onClick={verify}
              disabled={pending || code.length !== VERIFY_CODE_LEN}
              className="shrink-0 rounded-lg bg-neutral-900 px-4 text-sm font-medium text-white transition hover:bg-violet-600 disabled:opacity-50"
            >
              확인
            </button>
          </div>
        </Label>
      )}

      <Label text="비밀번호" hint={`${PASSWORD_MIN}자 이상`}>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={PASSWORD_MIN}
          autoComplete="new-password"
          className={input}
        />
      </Label>

      <Label text="비밀번호 확인">
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          autoComplete="new-password"
          className={input}
        />
        {confirm && password !== confirm && (
          <span className="mt-1 block text-xs text-red-600">비밀번호가 일치하지 않습니다.</span>
        )}
      </Label>

      <button
        type="submit"
        disabled={pending || !verified}
        className="w-full rounded-lg bg-neutral-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-violet-600 disabled:opacity-50"
      >
        {pending ? '처리 중…' : '가입하기'}
      </button>
      {!verified && <p className="text-center text-xs text-neutral-400">이메일 인증을 마치면 가입할 수 있습니다.</p>}
    </form>
  )
}

function Label({ text, hint, children }: { text: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-neutral-600">
        {text}
        {hint && <span className="ml-1 font-normal text-neutral-400">({hint})</span>}
      </span>
      {children}
    </label>
  )
}

const input =
  'h-10 w-full min-w-0 rounded-lg border border-neutral-300 bg-white px-3 text-sm outline-none ring-violet-500 focus:ring-2 disabled:bg-neutral-100 disabled:text-neutral-500'
