'use client'

import { useEffect, useState } from 'react'
import { Consent, Dialog, Done, Field, FileField, ReadonlyRow, inputCls } from './form-bits'
import type { CategoryChoice, InquiryScope, ScopeOption } from '@/lib/inquiry-choices'
import { getGeneralInquiryChoices } from '@/app/inquiry-actions'

/* 유형 카드 안의 기본·프리미엄 전환 한 칸.
   라디오 label 안에 있으므로 type="button" — 폼을 보내지 않고, 누름이
   라디오 선택을 흔들지 않는다(이미 이 범위가 골라져 있을 때만 보인다). */
function TierButton({
  label,
  title,
  priceLabel,
  on,
  onPick,
}: {
  label: string
  /* 프리미엄 이름(어드민 설정) — 무엇이 더해지는지 이름으로 알린다 */
  title?: string
  priceLabel: string
  on: boolean
  onPick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      title={title}
      onClick={(e) => {
        e.preventDefault()
        onPick()
      }}
      className={`min-h-11 rounded-md px-2.5 py-2 text-left transition ${
        on ? 'bg-white text-violet-700 shadow-sm' : 'text-neutral-600 hover:text-neutral-900'
      }`}
    >
      <span className="block text-xs font-semibold">{label}</span>
      <span className="mt-0.5 block text-xs">{priceLabel}</span>
    </button>
  )
}

/* 분야 버튼 줄 — 1~3개는 한 줄, 4개는 2×2, 5개 이상은 3열로 왼쪽부터 채운다 */
const CATEGORY_COLS: Record<number, string> = { 1: 'grid-cols-1', 2: 'grid-cols-2', 3: 'grid-cols-3' }
function categoryCols(n: number) {
  return CATEGORY_COLS[n <= 3 ? n : n === 4 ? 2 : 3]
}

/* 의뢰·문의 폼.

   보낸 내용은 /api/inquiry 로 가서 DB 에 쌓이고 어드민에게 메일이 간다.

   먼저 무엇을 만드는지(분야)를 고르고, 그 분야에서 맡길 범위
   (메인 시안 먼저 / 디자인만 / 디자인 + 개발)를 고른다(inquiry-choices.ts).
   범위가 하나뿐인 분야는 묻지 않고 한 줄로 보여준다.

   designerName 을 주면 그 디자이너에게 보내는 폼이고, 선택지(choices)도
   그 디자이너 설정으로 걸러 온다. 없으면 일반 의뢰 — 네비바·홈의 '의뢰하기'는
   상대가 정해지지 않은 채 열리고, 선택지는 열 때 서버에서 받아 온다. */
export function InquiryModal({
  designerId,
  designerName,
  choices: given,
  initialScope,
  onClose,
}: {
  designerId?: string
  designerName?: string
  /* 그 디자이너의 분야·범위·금액(designerChoices) — 없으면 일반 선택지를 받아 온다 */
  choices?: CategoryChoice[]
  /* 처음부터 골라 둘 범위 — 상세의 의뢰 패널에서 고른 것. 분야를 고르면 그 안에 있을 때 골라진다 */
  initialScope?: InquiryScope
  onClose: () => void
}) {
  const [fetched, setFetched] = useState<CategoryChoice[] | null>(null)
  const choices = given ?? fetched

  /* 일반 폼 — 열 때 한 번 받아 온다. 실패하면 분야 없이 보낼 수 있게 빈 목록으로 둔다 */
  useEffect(() => {
    if (given) return
    let alive = true
    getGeneralInquiryChoices()
      .then((c) => alive && setFetched(c))
      .catch(() => alive && setFetched([]))
    return () => {
      alive = false
    }
  }, [given])

  const [done, setDone] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  /* 고른 분야·범위·단계. 분야를 바꾸면 범위는 다시 고른다 — 다른 분야의 범위를
     따라오면 안 된다. 분야가 하나뿐이면 처음부터 골라 둔다. */
  const [picked, setPicked] = useState<string | null>(null)
  const [scope, setScope] = useState<InquiryScope | null>(null)
  const [tier, setTier] = useState<'basic' | 'premium'>('basic')

  const catName = picked ?? (choices?.length === 1 ? choices[0].name : null)
  const cat = choices?.find((c) => c.name === catName) ?? null
  const single = cat?.options.length === 1 ? cat.options[0] : null
  const scopeKey: InquiryScope | null =
    single?.key ??
    (scope && cat?.options.some((o) => o.key === scope) ? scope : null) ??
    (initialScope && cat?.options.some((o) => o.key === initialScope) ? initialScope : null)
  const option: ScopeOption | null = cat?.options.find((o) => o.key === scopeKey) ?? null

  const pickCategory = (name: string) => {
    setPicked(name)
    setScope(null)
    setTier('basic')
    setError('')
  }

  /* 한 번 열면 끝까지 같은 키를 쓴다 — 느린 응답에 다시 눌러도
     서버가 같은 접수로 보고 두 번 저장하지 않는다(012_inquiries.sql). */
  const [submitKey] = useState(() => crypto.randomUUID())

  const send = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (sending) return

    /* 분야는 버튼이라 required 로 막을 수 없다 — 여기서 짚는다 */
    if (choices && choices.length > 0 && !cat) {
      setError('무엇을 만드는지 먼저 골라 주세요.')
      return
    }

    setSending(true)
    setError('')

    try {
      /* 폼에서 그대로 꺼낸다 — 입력칸마다 state 를 두면 값이 두 곳에
         생겨 어긋난다. 파일도 FormData 가 함께 담아 준다. */
      const body = new FormData(e.currentTarget)
      body.set('submitKey', submitKey)
      if (designerId) body.set('designerId', designerId)
      if (designerName) body.set('designerName', designerName)

      const res = await fetch('/api/inquiry', { method: 'POST', body })
      const data = (await res.json()) as { ok: boolean; error?: string }

      if (!res.ok || !data.ok) {
        setError(data.error ?? '전송에 실패했습니다. 잠시 후 다시 시도해 주세요.')
        return
      }
      setDone(true)
    } catch {
      /* 네트워크가 끊긴 경우 — 저장됐는지 알 수 없으므로 다시 보내게 한다.
         submitKey 가 같아 두 번 저장되지는 않는다. */
      setError('연결이 끊겼습니다. 잠시 후 다시 시도해 주세요.')
    } finally {
      setSending(false)
    }
  }

  return (
    <Dialog
      eyebrow="INQUIRY"
      title={designerName ? '문의하기' : '의뢰 문의하기'}
      onClose={onClose}
    >
      {done ? (
        <Done
          title="문의가 전달되었습니다"
          body="영업일 기준 1~3일 내 입력하신 이메일로 답변드립니다."
          onClose={onClose}
        />
      ) : (
        <form onSubmit={send} className="px-6 py-7 md:px-10 md:py-8">
          {/* 사람에게는 보이지 않는 칸 — 채워져 오면 봇으로 본다.
              display:none 대신 화면 밖으로 밀어 둔다: 일부 봇은
              숨겨진 칸을 건너뛴다. */}
          <input
            type="text"
            name="company_website"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            className="absolute left-[-9999px] size-0 opacity-0"
          />

          <div className="flex items-baseline justify-between gap-3">
            <p className="text-sm text-neutral-600">
              일정, 비용, 작업 방식 등 궁금한 점을 남겨주세요.
            </p>
            <p className="shrink-0 text-[11px] text-neutral-500">
              <span className="text-red-600">*</span> 필수
            </p>
          </div>

          {/* 무엇을 만드는지 먼저 고른다 — 맡길 범위도, 견적도 여기서 갈린다 */}
          {choices == null ? (
            <p className="mt-6 text-sm text-neutral-400">의뢰 유형을 불러오는 중…</p>
          ) : (
            choices.length > 0 && (
              <div className="mt-6 space-y-4">
                <fieldset>
                  <legend className="mb-2 text-xs font-medium text-neutral-700">
                    무엇을 만드나요? <span className="text-red-600">*</span>
                  </legend>
                  <div className={`grid gap-2 ${categoryCols(choices.length)}`}>
                    {choices.map((c) => {
                      const on = c.name === catName
                      return (
                        <button
                          key={c.name}
                          type="button"
                          aria-pressed={on}
                          onClick={() => pickCategory(c.name)}
                          className={`min-h-12 rounded-lg border px-3 py-3 text-left text-sm transition ${
                            on
                              ? 'border-violet-600 bg-violet-50 font-semibold text-violet-700 ring-1 ring-violet-600'
                              : 'border-neutral-300 font-medium hover:bg-neutral-50'
                          }`}
                        >
                          {c.name}
                        </button>
                      )
                    })}
                  </div>
                  {cat && <input type="hidden" name="category" value={cat.name} />}
                </fieldset>

                {/* 고른 분야의 범위 — 여럿이면 라디오, 하나면 한 줄 */}
                {cat && single && (
                  <div className="flex items-start justify-between gap-3 rounded-xl bg-neutral-50 px-4 py-3.5 ring-1 ring-neutral-200">
                    <div className="min-w-0">
                      <span className="rounded bg-violet-100 px-1.5 py-0.5 text-xs font-semibold text-violet-700">
                        {single.label}
                      </span>
                      <p className="mt-1.5 text-xs leading-relaxed text-neutral-600">{single.desc}</p>
                    </div>
                    <span className="shrink-0 text-sm font-bold">{single.priceLabel}</span>
                    <input type="hidden" name="scope" value={single.key} />
                  </div>
                )}

                {cat && !single && (
                  <fieldset className="rounded-xl bg-neutral-50 p-3 ring-1 ring-neutral-200 md:p-4">
                    <legend className="sr-only">어디까지 맡길까요?</legend>
                    <p aria-hidden className="mb-2.5 text-xs font-medium text-neutral-700">
                      어디까지 맡길까요? <span className="text-red-600">*</span>
                    </p>
                    <div className="space-y-2">
                      {cat.options.map((o) => {
                        const checked = o.key === scopeKey
                        return (
                          <label
                            key={o.key}
                            className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-neutral-300 bg-white p-3 transition hover:bg-neutral-50 has-[:checked]:border-violet-600 has-[:checked]:bg-violet-50"
                          >
                            <input
                              required
                              type="radio"
                              name="scope"
                              value={o.key}
                              checked={checked}
                              onChange={() => {
                                setScope(o.key)
                                setTier('basic')
                              }}
                              className="mt-0.5 shrink-0 accent-violet-600"
                            />
                            <span className="min-w-0 flex-1">
                              <span className="flex items-baseline justify-between gap-3">
                                <span className="text-sm font-medium">{o.label}</span>
                                <span className="shrink-0 text-sm font-semibold text-neutral-800">
                                  {o.priceLabel}
                                </span>
                              </span>
                              <span className="mt-0.5 block text-xs leading-relaxed text-neutral-500">
                                {o.desc}
                              </span>
                              {o.premium && !checked && (
                                <span className="mt-1 block text-[11px] text-violet-700">
                                  프리미엄 {o.premium.priceLabel} 선택 가능
                                </span>
                              )}
                              {o.premium && checked && (
                                <span className="mt-3 grid grid-cols-2 gap-1 rounded-lg bg-violet-100 p-1">
                                  <TierButton
                                    label="기본"
                                    priceLabel={o.priceLabel}
                                    on={tier === 'basic'}
                                    onPick={() => setTier('basic')}
                                  />
                                  <TierButton
                                    label="프리미엄"
                                    title={o.premium.name}
                                    priceLabel={o.premium.priceLabel}
                                    on={tier === 'premium'}
                                    onPick={() => setTier('premium')}
                                  />
                                </span>
                              )}
                            </span>
                          </label>
                        )
                      })}
                    </div>
                  </fieldset>
                )}

                {/* 프리미엄을 고를 수 있던 범위일 때만 보낸다 — 아니면 서버가 null 로 둔다 */}
                {option?.premium && <input type="hidden" name="planTier" value={tier} />}
              </div>
            )
          )}

          <div className="mt-6 grid gap-6 md:grid-cols-2 md:gap-7">
            <Field label="성함 (회사명)" req>
              <input
                required
                name="name"
                maxLength={100}
                autoComplete="name"
                className={inputCls}
                placeholder="홍길동 (숨 주식회사)"
              />
            </Field>

            {/* 형식은 묶지 않는다 — 02-123-4567, +82 10-…, 내선처럼
                모양이 제각각이라 패턴으로 막으면 멀쩡한 번호가 거부된다.
                tel 로 두면 모바일에서 숫자 자판이 먼저 뜬다. */}
            <Field label="연락처" req>
              <input
                required
                type="tel"
                name="phone"
                maxLength={40}
                autoComplete="tel"
                className={inputCls}
                placeholder="010-1234-5678"
              />
            </Field>

            {/* 주소가 길어 반 칸에서는 끝이 가려진다 — 한 줄을 다 쓴다 */}
            <div className="md:col-span-2">
              <Field label="이메일주소" req>
                <input
                  required
                  type="email"
                  name="email"
                  maxLength={200}
                  autoComplete="email"
                  className={inputCls}
                  placeholder="name@company.com"
                />
              </Field>
            </div>

            <div className="md:col-span-2">
              <Field label="문의내용" req>
                <textarea
                  required
                  name="message"
                  rows={6}
                  maxLength={5000}
                  /* 중괄호로 감싸야 \n 이 줄바꿈이 된다 — 따옴표만 쓴 JSX 속성은
                     \n 을 글자 그대로 찍는다. textarea 의 placeholder 는 줄바꿈을 보여준다. */
                  placeholder={
                    '어떤 서비스에 대한 의뢰인지 알려주세요.\n소개 자료를 첨부해주시면 좋습니다.\n원하는 스타일의 레퍼런스 서비스 url 혹은 앱 이름을 알려주세요.'
                  }
                  /* 여기만 테두리를 두른다 — 여러 줄이라 밑줄만으로는
                     어디까지가 입력칸인지 알 수 없다 */
                  /* inputCls 의 border-0 이 border 를 이겨 아래 줄만 남는다 —
                     border-b 처럼 변별 클래스로 나머지 세 변을 다시 켠다 */
                  className={`${inputCls} resize-y rounded-lg border-x border-t border-neutral-300 bg-white px-3 leading-relaxed focus:border-neutral-900`}
                />
              </Field>
            </div>

            <div className="md:col-span-2">
              <FileField max={1} />
            </div>

            {/* 누구에게 보내는지 — 디자이너 상세에서 열었을 때만 나온다.
                고를 수 있는 값이 아니라 이미 정해진 것이므로 읽기만 한다.
                값은 hidden 이 아니라 send() 가 FormData 에 직접 넣는다. */}
            {designerName && (
              <div className="md:col-span-2">
                <ReadonlyRow label="디자이너" value={designerName} />
              </div>
            )}
          </div>

          <Consent />

          {error && (
            <p className="mt-4 rounded-lg bg-red-50 px-3.5 py-3 text-sm text-red-700">{error}</p>
          )}

          <button
            type="submit"
            disabled={sending}
            className="mt-6 w-full rounded-lg bg-violet-600 py-3.5 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:opacity-50"
          >
            {sending ? '보내는 중…' : '문의 보내기'}
          </button>
          <p className="mt-3 text-center text-xs text-neutral-500">
            영업일 기준 1~3일 내 답변드립니다.
          </p>
        </form>
      )}
    </Dialog>
  )
}
