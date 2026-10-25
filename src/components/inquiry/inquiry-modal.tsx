'use client'

import { useState } from 'react'
import {
  Consent,
  Dialog,
  Done,
  Field,
  FileField,
  RadioCard,
  ReadonlyRow,
  inputCls,
} from './form-bits'
import { INQUIRY_TYPES, INQUIRY_TYPE_HINTS } from '@/lib/inquiry-types'

/* 의뢰·문의 폼.

   보낸 내용은 /api/inquiry 로 가서 DB 에 쌓이고 어드민에게 메일이 간다.

   designerName 을 주면 "{이름}에게 문의하기", 없으면 일반 의뢰로 연다 —
   네비바의 '의뢰하기'는 아직 상대가 정해지지 않은 상태로 열린다. */
export function InquiryModal({
  designerId,
  designerName,
  onClose,
}: {
  designerId?: string
  designerName?: string
  onClose: () => void
}) {
  const [done, setDone] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  /* 한 번 열면 끝까지 같은 키를 쓴다 — 느린 응답에 다시 눌러도
     서버가 같은 접수로 보고 두 번 저장하지 않는다(012_inquiries.sql). */
  const [submitKey] = useState(() => crypto.randomUUID())

  const send = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (sending) return

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
      title={designerName ? `${designerName}에게 문의하기` : '의뢰 문의하기'}
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

          {/* 무엇을 맡기려는지 먼저 고른다 — 답변도 견적도 여기서 갈린다 */}
          <fieldset className="mt-6">
            <legend className="mb-2 text-xs font-medium text-neutral-700">
              의뢰 유형 <span className="text-red-600">*</span>
            </legend>
            <div className="grid gap-2 md:grid-cols-3">
              {INQUIRY_TYPES.map((t) => (
                <RadioCard key={t} name="inquiryType" value={t} hint={INQUIRY_TYPE_HINTS[t]} />
              ))}
            </div>
          </fieldset>

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
                  placeholder="예) 다음 달 시작 가능한지, 앱 리뉴얼 작업 경험이 있는지 궁금합니다."
                  /* 여기만 테두리를 두른다 — 여러 줄이라 밑줄만으로는
                     어디까지가 입력칸인지 알 수 없다 */
                  className={`${inputCls} resize-y rounded-lg border border-neutral-300 bg-white px-3 leading-relaxed focus:border-neutral-900`}
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
