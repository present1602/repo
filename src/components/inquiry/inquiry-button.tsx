'use client'

import { useState } from 'react'
import { InquiryModal } from './inquiry-modal'
import type { InquiryOffers } from '@/lib/inquiry-types'

/* 디자이너 상세의 의뢰 버튼.

   누르면 그 디자이너를 받는 사람으로 둔 폼이 열린다 —
   폼 안에서는 읽기만 하고 바꿀 수 없다(ReadonlyRow). */
export function InquiryButton({
  designerId,
  designerName,
  offers,
  className,
}: {
  designerId: string
  designerName: string
  /* 이 디자이너가 받는 유형과 시작가 — 폼의 유형·금액이 이것으로 바뀐다 */
  offers?: InquiryOffers
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
          offers={offers}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}
