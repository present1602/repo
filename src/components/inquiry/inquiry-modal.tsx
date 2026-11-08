'use client'

import { useEffect, useState } from 'react'
import { Consent, Dialog, Done, Field, FileField, ReadonlyRow, inputCls } from './form-bits'
import {
  defaultScope,
  splitSample,
  type CategoryChoice,
  type InquiryScope,
  type ScopeOption,
} from '@/lib/inquiry-choices'
import { getGeneralInquiryChoices, prepareInquiryUpload } from '@/app/inquiry-actions'
import { uploadSigned } from '@/lib/direct-upload'
import { recalledRef } from '@/lib/invite-link'

/* 범위 이름 옆 짧은 풀이 — 플랜 이름(어드민 설정)만으로는 개발이 들어가는지 알기 어렵다 */
const SCOPE_NOTE: Partial<Record<InquiryScope, string>> = {
  design: '디자인만',
  design_dev: '디자인 + 개발',
}

/* 프리미엄이 있는 유형 표시 — 의뢰 폼·상세 패널이 같은 모양을 쓴다 */
export function PremiumBadge() {
  return (
    <span className="rounded bg-violet-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">프리미엄</span>
  )
}

/* 고른 유형 카드 안에 덧붙이는 옵션 한 줄 — 메인화면 먼저 의뢰·프리미엄 */
function ExtraOption({
  title,
  desc,
  priceLabel,
  on,
  onChange,
}: {
  title: string
  desc: string
  priceLabel: string
  on: boolean
  onChange: (on: boolean) => void
}) {
  return (
    <label className="mt-3 ml-6 flex cursor-pointer items-center gap-2.5 rounded-md border border-violet-200 bg-white px-3 py-2.5">
      <input
        type="checkbox"
        checked={on}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4 shrink-0 accent-violet-600"
      />
      <span className="min-w-0 flex-1 text-sm">
        <span className="font-medium">{title}</span>
        {desc && <span className="mt-0.5 block text-xs leading-relaxed text-neutral-500">{desc}</span>}
      </span>
      <Price label={priceLabel} className="text-sm font-semibold text-violet-700" />
    </label>
  )
}

/* 금액과 그 아래 'VAT 별도' — 폼에 나가는 금액은 모두 부가세 별도다 */
function Price({ label, className }: { label: string; className: string }) {
  return (
    <span className="shrink-0 text-right">
      <span className={`block ${className}`}>{label}</span>
      <span className="block text-[11px] font-normal text-neutral-500">VAT 별도</span>
    </span>
  )
}

/* 의뢰·문의 폼.

   보낸 내용은 /api/inquiry 로 가서 DB 에 쌓이고 어드민에게 메일이 간다.

   의뢰 유형은 두 번에 나눠 고른다 — 먼저 분야(탐색 사이드바와 같은 이름·차례),
   그 아래에 그 분야가 받는 범위(메인화면 먼저·디자인만·디자인 + 개발, inquiry-choices.ts).
   분야나 범위가 하나뿐이면 묻지 않고 골라 둔 채 보여준다.

   designerName 을 주면 그 디자이너에게 보내는 폼이고, 선택지(choices)도
   그 디자이너 설정으로 걸러 온다. 없으면 일반 의뢰 — 네비바·홈의 '의뢰하기'는
   상대가 정해지지 않은 채 열리고, 선택지는 열 때 서버에서 받아 온다. */
export function InquiryModal({
  designerId,
  designerName,
  choices: given,
  initialCategory,
  initialScope,
  initialSample = false,
  onClose,
}: {
  designerId?: string
  designerName?: string
  /* 그 디자이너의 분야·범위·금액(designerChoices) — 없으면 일반 선택지를 받아 온다 */
  choices?: CategoryChoice[]
  /* 처음부터 골라 둘 분야 — 상세의 의뢰 패널에서 고른 것 */
  initialCategory?: string
  /* 처음부터 골라 둘 범위 — 상세의 의뢰 패널에서 고른 것. 분야를 고르면 그 안에 있을 때 골라진다 */
  initialScope?: InquiryScope
  /* 패널에서 '메인화면 먼저 의뢰'를 켜고 열었는지 */
  initialSample?: boolean
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

  /* 분야는 탐색 사이드바 차례로 — 상세 패널에서 고른 분야(initialCategory)가 있으면 골라 둔다 */
  const cats = [...(choices ?? [])].sort((a, b) => a.order - b.order)
  const [pickedCat, setPickedCat] = useState<string | null>(null)
  const [pickedScope, setPickedScope] = useState<InquiryScope | null>(null)
  /* 고른 본계약 줄에 덧붙이는 옵션 — 프리미엄과 메인화면 먼저 의뢰는 함께 고르지 않는다
     (메인 시안은 본계약 전에 먼저 받는 의뢰라 본계약 단계가 아직 정해지지 않는다) */
  const [extra, setExtra] = useState<'none' | 'premium' | 'sample'>(initialSample ? 'sample' : 'none')

  const cat =
    cats.find((c) => c.name === (pickedCat ?? initialCategory)) ?? (cats.length === 1 ? cats[0] : null)
  /* 범위 — 분야를 바꾸면 처음부터 다시 고른다. 패널에서 고른 범위는 그 분야일 때만 */
  const scopeKey = pickedCat == null && cat?.name === initialCategory ? (pickedScope ?? initialScope) : pickedScope
  /* 라디오는 본계약 줄만 — 메인 시안은 고른 줄 안의 옵션(splitSample) */
  const { main, sample } = cat ? splitSample(cat.options) : { main: [], sample: null }
  /* 아직 고르지 않았으면 기본 범위(defaultScope) — 디자인만·디자인 + 개발이 둘 다 있으면 프로젝트 의뢰 */
  const option: ScopeOption | null =
    main.find((o) => o.key === (scopeKey ?? defaultScope(main.map((x) => x.key)))) ?? null
  const withSample = extra === 'sample' && sample != null && option?.sampleOk === true
  const withPremium = extra === 'premium' && option?.premium != null

  const pickCat = (name: string) => {
    setPickedCat(name)
    setPickedScope(null)
    setExtra('none')
    setError('')
  }
  const pickScope = (key: InquiryScope) => {
    /* 패널에서 골라 온 분야를 그대로 둔 채 범위만 바꿀 때도 분야를 굳혀 둔다 */
    if (cat) setPickedCat(cat.name)
    setPickedScope(key)
    /* 메인 시안은 같은 분야면 어느 본계약 줄에서도 그대로 둔다 — 프리미엄은 줄마다 다르다 */
    setExtra((x) => (x === 'premium' ? 'none' : x))
    setError('')
  }

  /* 한 번 열면 끝까지 같은 키를 쓴다 — 느린 응답에 다시 눌러도
     서버가 같은 접수로 보고 두 번 저장하지 않는다(012_inquiries.sql). */
  const [submitKey] = useState(() => crypto.randomUUID())

  const send = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (sending) return

    /* 고른 유형은 숨은 칸으로 나간다 — 라디오 required 와 별도로 여기서 한 번 더 짚는다 */
    if (cats.length > 0 && !cat) {
      setError('의뢰 분야를 골라 주세요.')
      return
    }
    if (cat && !option) {
      setError('의뢰 범위를 골라 주세요.')
      return
    }

    setSending(true)
    setError('')

    try {
      /* 폼에서 그대로 꺼낸다 — 입력칸마다 state 를 두면 값이 두 곳에
         생겨 어긋난다. 파일도 FormData 가 함께 담아 준다. */
      const body = new FormData(e.currentTarget)

      /* 첨부는 Storage 에 먼저 올리고 경로만 보낸다 — 파일을 실어 보내면
         Vercel 함수의 요청 크기 한도(약 4.5MB)에 걸려 큰 파일이 끊긴다(inquiry-files.ts) */
      const file = body.get('attachment')
      body.delete('attachment')
      if (file instanceof File && file.size > 0) {
        const prep = await prepareInquiryUpload(file.name, file.size)
        if (!prep.ok) {
          setError(prep.error)
          return
        }
        if (!(await uploadSigned(prep.bucket, prep, file))) {
          setError('첨부 파일을 올리지 못했습니다. 잠시 후 다시 시도해 주세요.')
          return
        }
        body.set('attachmentPath', prep.path)
        body.set('attachmentName', file.name)
      }

      body.set('submitKey', submitKey)
      if (designerId) body.set('designerId', designerId)
      if (designerName) body.set('designerName', designerName)
      /* 그 디자이너의 초대 링크로 들어왔으면 코드를 함께 — 맞는지는 서버가 본다 */
      const ref = designerId ? recalledRef(designerId) : null
      if (ref) body.set('ref', ref)

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
    <Dialog eyebrow="INQUIRY" title={designerName ? '문의하기' : '의뢰 문의하기'} onClose={onClose}>
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
            <p className="text-sm text-neutral-600">일정, 비용, 작업 방식 등 궁금한 점을 남겨주세요.</p>
            <p className="shrink-0 text-[11px] text-neutral-500">
              <span className="text-red-600">*</span> 필수
            </p>
          </div>

          {/* 의뢰 유형 — 견적도 여기서 갈린다 */}
          {choices == null ? (
            <p className="mt-6 text-sm text-neutral-400">의뢰 유형을 불러오는 중…</p>
          ) : (
            cats.length > 0 && (
              <div className="mt-6 space-y-5">
                {cat && <input type="hidden" name="category" value={cat.name} />}
                {/* 메인 시안을 덧붙이면 접수 유형은 메인 시안, 염두에 둔 본계약은 mainScope 로 함께 */}
                {cat && option && <input type="hidden" name="scope" value={withSample ? 'sample' : option.key} />}
                {cat && option && withSample && <input type="hidden" name="mainScope" value={option.key} />}

                {/* 1차 — 분야. 하나뿐이면 고를 게 없으므로 묻지 않는다 */}
                {cats.length > 1 && (
                  <fieldset>
                    <legend className="mb-2 text-xs font-medium text-neutral-700">
                      어떤 분야인가요? <span className="text-red-600">*</span>
                    </legend>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {cats.map((c) => (
                        <label
                          key={c.name}
                          className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm font-medium transition hover:bg-neutral-50 has-[:checked]:border-violet-600 has-[:checked]:bg-violet-50 has-[:checked]:text-violet-700"
                        >
                          <input
                            required
                            type="radio"
                            name="inquiryCategory"
                            value={c.name}
                            checked={c.name === cat?.name}
                            onChange={() => pickCat(c.name)}
                            className="shrink-0 accent-violet-600"
                          />
                          <span className="min-w-0 break-keep">{c.name}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                )}

                {/* 2차 — 그 분야가 받는 범위. 분야를 골라야 열린다 */}
                {cat && (
                  <fieldset>
                    <legend className="mb-2 text-xs font-medium text-neutral-700">
                      {cats.length > 1 ? `${cat.name} — ` : ''}어떻게 의뢰할까요?{' '}
                      <span className="text-red-600">*</span>
                    </legend>
                    <div className="space-y-2">
                      {main.map((o) => {
                        const checked = o.key === option?.key
                        /* 테두리는 라디오 상태로 칠한다 — 안의 프리미엄 체크박스가 has-[:checked] 에 걸리지 않게 */
                        return (
                          <div
                            key={o.key}
                            className={`rounded-lg border p-3 transition ${
                              checked ? 'border-violet-600 bg-violet-50' : 'border-neutral-300 bg-white hover:bg-neutral-50'
                            }`}
                          >
                            <label className="flex cursor-pointer items-start gap-2.5">
                              <input
                                required
                                type="radio"
                                name="inquiryScope"
                                value={o.key}
                                checked={checked}
                                onChange={() => pickScope(o.key)}
                                className="mt-0.5 shrink-0 accent-violet-600"
                              />
                              <span className="min-w-0 flex-1">
                                <span className="flex items-baseline justify-between gap-3">
                                  <span className="text-sm font-medium">
                                    {o.label}
                                    {SCOPE_NOTE[o.key] && !o.label.includes(SCOPE_NOTE[o.key]!) && (
                                      <span className="ml-1.5 text-xs font-normal text-neutral-500">
                                        {SCOPE_NOTE[o.key]}
                                      </span>
                                    )}
                                  </span>
                                  <Price label={o.priceLabel} className="text-sm font-semibold text-neutral-800" />
                                </span>
                                {o.desc && (
                                  <span className="mt-0.5 block text-xs leading-relaxed text-neutral-500">
                                    {o.desc}
                                  </span>
                                )}
                                {/* 프리미엄이 있는 유형 — 고르기 전에도 뱃지와 금액을 보여준다 */}
                                {o.premium && (
                                  <span className="mt-2 flex items-center gap-1.5 text-xs text-violet-700">
                                    <PremiumBadge />
                                    {o.premium.priceLabel}
                                  </span>
                                )}
                                {/* 메인 시안을 받는 분야 — 고르면 아래에서 덧붙일 수 있다고 미리 알린다 */}
                                {sample && o.sampleOk && !checked && (
                                  <span className="mt-1.5 block text-xs font-medium text-violet-600">
                                    메인화면 먼저 의뢰 가능
                                  </span>
                                )}
                              </span>
                            </label>

                            {/* 고른 유형 안에서만 — 라디오 label 바깥에 두어 누름이 라디오로 번지지 않게.
                                둘은 함께 고르지 않는다(하나를 켜면 다른 하나는 꺼진다) */}
                            {checked && sample && o.sampleOk && (
                              <ExtraOption
                                title="메인화면 먼저 의뢰"
                                desc={sample.desc}
                                priceLabel={sample.priceLabel}
                                on={extra === 'sample'}
                                onChange={(on) => setExtra(on ? 'sample' : 'none')}
                              />
                            )}
                            {checked && o.premium && (
                              <ExtraOption
                                title="프리미엄으로 의뢰"
                                desc={o.premium.name}
                                priceLabel={o.premium.priceLabel}
                                on={extra === 'premium'}
                                onChange={(on) => setExtra(on ? 'premium' : 'none')}
                              />
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </fieldset>
                )}

                {/* 프리미엄을 고를 수 있던 범위일 때만 보낸다 — 아니면 서버가 null 로 둔다 */}
                {option?.premium && !withSample && (
                  <input type="hidden" name="planTier" value={withPremium ? 'premium' : 'basic'} />
                )}
              </div>
            )
          )}

          <div className="mt-6 grid gap-6 md:grid-cols-2 md:gap-7">
            <Field label="성함 (회사명)" req>
              <input required name="name" maxLength={100} autoComplete="name" className={inputCls} placeholder="" />
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
                placeholder="'-' 없이 휴대폰, 혹은 유선 연락처를 기재해주세요."
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
                  placeholder=""
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

          {error && <p className="mt-4 rounded-lg bg-red-50 px-3.5 py-3 text-sm text-red-700">{error}</p>}

          <button
            type="submit"
            disabled={sending}
            className="mt-6 w-full rounded-lg bg-violet-600 py-3.5 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:opacity-50"
          >
            {sending ? '보내는 중…' : '문의 보내기'}
          </button>
          <p className="mt-3 text-center text-xs text-neutral-500">영업일 기준 1~3일 내 답변드립니다.</p>
        </form>
      )}
    </Dialog>
  )
}
