'use client'

import { useEffect, useState } from 'react'
import type { PublicWork } from '@/lib/designer-shape'

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

  // 작업물을 넘기면 펼쳐둔 설명은 접는다
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
     하나도 없으면 설명 칸을 띄우지 않는다 — 빈 흰 칸이 이미지를 가린다.

     AI 사용 표기는 true 일 때만 붙인다 — null(묻기 전에 올라간 작업)과
     false 를 구분해 보여주지 않는다. */
  const meta = [w.client, w.ai_used ? 'AI 활용' : null].filter(Boolean).join(' · ')
  const hasSheet = Boolean(w.title || meta || w.description)

  /* 9:16 보다 세로로 긴가.

     그보다 길면 높이에 맞춰 줄였을 때 글자를 알아볼 수 없을 만큼
     작아진다 — 폭을 채우고 스크롤로 내려 보는 편이 낫다.
     비율을 모르면(업로드 때 못 읽은 경우) 납작한 쪽으로 본다:
     화면에 들어오는 편이 안전하다. */
  const tall = Boolean(w.width && w.height && w.height / w.width > 16 / 9)

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
        className="relative flex h-full w-full flex-col overflow-hidden bg-white md:h-[92vh] md:max-w-4xl md:rounded-2xl"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-neutral-200 px-5 py-3">
          <span className="text-xs tracking-widest text-neutral-500">
            {String(index + 1).padStart(2, '0')} / {String(works.length).padStart(2, '0')}
          </span>
          <button
            onClick={onClose}
            aria-label="닫기"
            className="text-2xl leading-none text-neutral-500 transition hover:text-neutral-900"
          >
            ×
          </button>
        </div>

        {/* 이미지 — 남는 높이를 차지하고, 설명 칸은 그 아래 흐름에 선다.
            예전처럼 설명을 띄워(absolute) 두면 제목만 있을 때 아래 여백이
            사라져 글자가 바닥에 붙는다.

            여기서는 원본을 그대로 본다 — 목록 썸네일과 달리 잘라서는 안 된다.
            9:16 보다 세로로 긴 이미지는 폭에 맞춰 길게 펼치고 이 칸을 스크롤해
            내려 본다. 그보다 납작하면 높이에 맞추고 좌우에 흰 여백이 남는다. */}
        <div
          className={`min-h-0 flex-1 overflow-y-auto bg-white ${tall ? '' : 'grid place-items-center'}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={w.id}
            src={w.image_url}
            alt={w.title ?? ''}
            className={tall ? 'w-full' : 'max-h-full max-w-full object-contain'}
          />
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
          <div className="shrink-0 border-t border-neutral-200 px-5 py-5 md:px-8">
            {meta && <p className="text-[11px] tracking-widest text-neutral-500">{meta}</p>}
            {w.title && (
              <h3 className="mt-1 text-xl font-semibold tracking-tight md:text-2xl">{w.title}</h3>
            )}

            {w.description && (
              /* relative — 아래 Toggle 의 숨은 사본이 이 칸을 기준으로 선다.
                 없으면 모달 전체를 기준으로 삼아 엉뚱한 자리에 깔린다. */
              <div className="relative mt-2.5">
                <p
                  className={`whitespace-pre-line text-[15px] leading-relaxed text-neutral-600 ${
                    /* 접힌 상태에서는 두 줄까지만 — 넘치면 끝에 말줄임이 붙는다.
                       펼치면 길어질 수 있어 이 칸 자체가 스크롤을 갖는다. */
                    open ? 'max-h-[30vh] overflow-y-auto' : 'line-clamp-2'
                  }`}
                >
                  {w.description}
                </p>

                {/* 펼치기·접기 — 글자 대신 화살표 하나로 둔다.
                    두 줄 안에 들어가는 짧은 설명에는 버튼을 만들지 않는다. */}
                <Toggle open={open} onToggle={() => setOpen((v) => !v)} text={w.description} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/* 설명이 두 줄을 넘는지 재서, 넘칠 때만 펼침 버튼을 보여준다.

   글자 수로 어림잡으면 줄바꿈이 섞인 글에서 틀린다 — 실제로 그려진
   높이를 재는 편이 정확하다. */
function Toggle({
  open,
  onToggle,
  text,
}: {
  open: boolean
  onToggle: () => void
  text: string
}) {
  const [overflows, setOverflows] = useState(false)
  const [el, setEl] = useState<HTMLParagraphElement | null>(null)

  useEffect(() => {
    if (!el) return

    const measure = () => setOverflows(el.scrollHeight > el.clientHeight + 1)
    measure()

    /* 모달 폭이 바뀌면 줄 수도 바뀐다 */
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [el, text])

  return (
    <>
      {/* 높이를 재기 위한 숨은 사본 — 보이는 글은 위에서 그린다.
          펼친 상태에서도 "접힌 높이"를 알아야 버튼을 계속 띄울 수 있다.

          inset-x-0 으로 보이는 글과 같은 너비를 갖게 한다 — 너비가 다르면
          줄 수가 달라져 "넘치는지" 판단이 틀린다. */}
      <p
        ref={setEl}
        aria-hidden
        className="pointer-events-none invisible absolute inset-x-0 top-0 line-clamp-2 whitespace-pre-line text-[15px] leading-relaxed"
      >
        {text}
      </p>

      {overflows && (
        <button
          onClick={onToggle}
          aria-label={open ? '설명 접기' : '설명 더 보기'}
          aria-expanded={open}
          className="mt-1.5 grid size-7 place-items-center rounded-full text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-900"
        >
          <svg
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`size-4 transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
          >
            <path d="M4 6l4 4 4-4" />
          </svg>
        </button>
      )}
    </>
  )
}
