'use client'

import { useState } from 'react'
import { InquiryModal } from './inquiry/inquiry-modal'

/* '프로젝트 의뢰하기' — 홈과 소개가 같이 쓴다.
   category: 골라 둔 채 열 의뢰 분야(소개 화면은 웹사이트).
   product: 견적표에서 고른 상품 이름 — 폼에 한 줄로 보여 주고 문의내용 앞에 붙여 보낸다 */
export function AboutInquiryButton({
  className,
  category,
  product,
  productOptions,
}: {
  className?: string
  category?: string
  product?: string
  /* 견적표에서 더한 세부 기능 — 폼에서 고른 분야 아래 '+' 줄로 보인다 */
  productOptions?: readonly string[]
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`group inline-flex min-h-12 items-center justify-center gap-6 rounded-full px-6 py-3 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-500 ${className ?? 'bg-violet-600 text-white hover:bg-violet-700'}`}
      >
        프로젝트 의뢰하기
        <span aria-hidden="true" className="transition-transform group-hover:translate-x-1 motion-reduce:transform-none">→</span>
      </button>
      {open && <InquiryModal initialCategory={category} product={product} productOptions={productOptions} onClose={() => setOpen(false)} />}
    </>
  )
}
