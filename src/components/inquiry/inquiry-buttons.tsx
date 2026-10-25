'use client'

import { useState } from 'react'
import { InquiryModal } from './inquiry-modal'

/* 디자이너 상세의 문의·의뢰 버튼.

   둘 다 같은 폼을 연다 — 지금은 받는 곳이 없어 구분할 거리가 없다.
   나중에 의뢰(일감 등록)와 문의(질문)가 갈라지면 여기서 나누면 된다. */
export function InquiryButtons({ designerName }: { designerName: string }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <div className="flex gap-2">
        <button
          onClick={() => setOpen(true)}
          className="flex-1 rounded-lg border border-neutral-300 px-6 py-3 text-sm font-medium transition hover:bg-neutral-100 md:flex-none"
        >
          문의하기
        </button>
        <button
          onClick={() => setOpen(true)}
          className="flex-1 rounded-lg bg-neutral-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-indigo-600 md:flex-none"
        >
          의뢰하기
        </button>
      </div>

      {open && <InquiryModal designerName={designerName} onClose={() => setOpen(false)} />}
    </>
  )
}
