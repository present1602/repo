'use client'

import { useState } from 'react'
import { Consent, Dialog, Done, Field, FileField, inputCls } from './form-bits'

/* 의뢰·문의 폼.

   지금은 화면만 있다 — 보내기를 누르면 완료 화면으로 넘어갈 뿐
   어디로도 전송하지 않는다. 받는 쪽(메일·DB)은 다음 작업이다.

   designerName 을 주면 "{이름}에게 문의하기", 없으면 일반 의뢰로 연다 —
   네비바의 '의뢰하기'는 아직 상대가 정해지지 않은 상태로 열린다. */
export function InquiryModal({
  designerName,
  onClose,
}: {
  designerName?: string
  onClose: () => void
}) {
  const [done, setDone] = useState(false)

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
        <form
          onSubmit={(e) => {
            e.preventDefault()
            /* 아직 보내는 곳이 없다 — 화면 흐름만 이어 둔다 */
            setDone(true)
          }}
          className="px-6 py-7 md:px-10 md:py-8"
        >
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-sm text-neutral-600">
              일정, 비용, 작업 방식 등 궁금한 점을 남겨주세요.
            </p>
            <p className="shrink-0 text-[11px] text-neutral-500">
              <span className="text-red-600">*</span> 필수
            </p>
          </div>

          <div className="mt-6 grid gap-6 md:grid-cols-2 md:gap-7">
            <Field label="성함 (회사명)" req>
              <input required className={inputCls} placeholder="홍길동 (숨 주식회사)" />
            </Field>

            <Field label="이메일주소" req>
              <input required type="email" className={inputCls} placeholder="name@company.com" />
            </Field>

            <div className="md:col-span-2">
              <Field label="문의내용" req>
                <textarea
                  required
                  rows={6}
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
          </div>

          <Consent />

          <button
            type="submit"
            className="mt-8 w-full rounded-lg bg-indigo-600 py-3.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
          >
            문의 보내기
          </button>
          <p className="mt-3 text-center text-xs text-neutral-500">
            영업일 기준 1~3일 내 답변드립니다.
          </p>
        </form>
      )}
    </Dialog>
  )
}
