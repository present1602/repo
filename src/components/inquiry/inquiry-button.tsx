'use client'

import { useState } from 'react'
import { InquiryModal } from './inquiry-modal'
import type { CategoryChoice } from '@/lib/inquiry-choices'

/* 디자이너 상세의 의뢰 버튼.

   누르면 그 디자이너를 받는 사람으로 둔 폼이 열린다 —
   폼 안에서는 읽기만 하고 바꿀 수 없다(ReadonlyRow). */
export function InquiryButton({
  designerId,
  designerName,
  choices,
  className,
}: {
  designerId: string
  designerName: string
  /* 이 디자이너의 분야·범위·금액(designerChoices). 없으면(어드민 미리보기) 일반 선택지 */
  choices?: CategoryChoice[]
  className?: string
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          className ??
          'rounded-lg bg-violet-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-violet-700'
        }
      >
        의뢰하기
      </button>

      {open && (
        <InquiryModal
          designerId={designerId}
          designerName={designerName}
          choices={choices}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}
