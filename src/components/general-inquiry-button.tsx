'use client'

import { useState, type ReactNode } from 'react'
import { InquiryModal } from './inquiry/inquiry-modal'

export function GeneralInquiryButton({ children, className }: { children: ReactNode; className?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>{children}</button>
      {open && <InquiryModal onClose={() => setOpen(false)} />}
    </>
  )
}
