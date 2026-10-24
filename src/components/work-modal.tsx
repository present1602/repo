'use client'

import { useEffect, useState } from 'react'
import type { PublicWork } from '@/lib/designer-shape'
import { Img } from './img'
import { aspectOf } from './work-ratio'

export function WorkModal({
  works,
  index,
  setIndex,
  onClose,
}: {
  works: PublicWork[]
  index: number
  setIndex: (i: number) => void
  onClose: () => void
}) {
  const w = works[index]
  const [open, setOpen] = useState(false)

  // 작업물을 넘기면 펼쳐둔 설명 시트는 접는다
  const next = () => {
    setOpen(false)
    setIndex((index + 1) % works.length)
  }
  const prev = () => {
    setOpen(false)
    setIndex((index - 1 + works.length) % works.length)
  }

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') next()
      if (e.key === 'ArrowLeft') prev()
    }
    window.addEventListener('keydown', h)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', h)
      document.body.style.overflow = ''
    }
  })

  /* 제목·클라이언트·설명은 모두 선택 입력이다.
     하나도 없으면 설명 시트를 띄우지 않는다 — 빈 흰 칸이 이미지를 가린다.

     AI 사용 표기는 true 일 때만 붙인다 — null(묻기 전에 올라간 작업)과
     false 를 구분해 보여주지 않는다. */
  const meta = [w.client, w.ai_used ? 'AI 활용' : null].filter(Boolean).join(' · ')
  const hasSheet = Boolean(w.title || meta || w.description)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/85 md:p-8"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={w.title ?? '작업 이미지'}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative flex h-full w-full flex-col overflow-hidden bg-white md:h-[92vh] md:max-w-xl md:rounded-2xl"
      >
        <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-3">
          <span className="text-xs tracking-widest text-neutral-500">
            {String(index + 1).padStart(2, '0')} / {String(works.length).padStart(2, '0')}
          </span>
          <button onClick={onClose} aria-label="닫기" className="text-2xl leading-none text-neutral-500 hover:text-neutral-900">
            ×
          </button>
        </div>

        {/* 설명 시트가 없으면 아래 여백도 둘 필요가 없다 */}
        <div className={`flex-1 overflow-y-auto ${hasSheet ? 'pb-32' : ''}`}>
          <Img key={w.id} src={w.image_url} alt={w.title ?? ''} ratio={aspectOf(w)} className="w-full" />
        </div>

        {/* 한 장뿐이면 넘길 곳이 없다 */}
        {works.length > 1 && (
          <>
            <button
              onClick={prev}
              aria-label="이전"
              className="absolute left-3 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 shadow-md transition hover:bg-white"
            >
              ←
            </button>
            <button
              onClick={next}
              aria-label="다음"
              className="absolute right-3 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 shadow-md transition hover:bg-white"
            >
              →
            </button>
          </>
        )}

        {hasSheet && (
          <>
            {open && <div className="absolute inset-0 bg-neutral-950/30" onClick={() => setOpen(false)} />}
            <div
              className={`absolute inset-x-0 bottom-0 flex flex-col border-t border-neutral-900 bg-white transition-[max-height] duration-500 ease-out ${
                open ? 'max-h-[75%]' : 'max-h-40'
              }`}
            >
              <div className="px-5 pt-5 md:px-8">
                {meta && <p className="text-[11px] tracking-widest text-neutral-500">{meta}</p>}
                {w.title && <h3 className="mt-1 text-2xl font-semibold tracking-tight">{w.title}</h3>}
              </div>

              {/* 설명이 없으면 펼칠 것이 없으므로 버튼도 만들지 않는다 */}
              {w.description &&
                (open ? (
                  <>
                    <div className="overflow-y-auto whitespace-pre-line px-5 py-4 text-[15px] leading-relaxed text-neutral-700 md:px-8">
                      {w.description}
                    </div>
                    <button
                      onClick={() => setOpen(false)}
                      className="mx-5 mb-5 border-t border-neutral-300 pt-3 text-left text-sm font-medium md:mx-8"
                    >
                      접기 ↓
                    </button>
                  </>
                ) : (
                  <button onClick={() => setOpen(true)} className="px-5 pb-5 pt-2 text-left md:px-8">
                    <p className="line-clamp-2 whitespace-pre-line text-[15px] leading-relaxed text-neutral-600">
                      {w.description}
                    </p>
                  </button>
                ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
