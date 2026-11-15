'use client'

import { useState } from 'react'
import { InquiryModal } from './inquiry/inquiry-modal'

export function AboutInquiryButton({ className }: { className?: string }) {
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
      {open && <InquiryModal onClose={() => setOpen(false)} />}
    </>
  )
}
