'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
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
  const meta = [w.client, w.ai_used ? 'AI 활용' : null, w.soom_work ? 'SOOM 의뢰' : null]
    .filter(Boolean)
    .join(' · ')
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

            key 로 작업마다 새로 그린다 — 넘기면 확대 배율이 처음으로 돌아간다. */}
        <ZoomImage key={w.id} src={w.image_url} alt={w.title ?? ''} />

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

/* 확대 단계 — 1 은 칸 안에 통째로 들어오는 크기 */
const ZOOMS = [1, 1.5, 2, 3, 4]

/* 원본 비율 그대로 칸 안에 맞춰 보여주고, 우측 하단 −/+ 로 키워 본다.

   처음에는 잘리지도 늘어나지도 않게 칸에 맞춘다 — 세로로 긴 그림은
   높이에 맞춰 좌우에 흰 여백이 남는다. 글자가 작아 안 보이면 키워서
   스크롤로 내려 본다.

   크기는 CSS 로 맡기지 않고 직접 잰다 — 칸에 맞춘 크기(fit)에 배율을
   곱한 픽셀 값을 줘야 키웠을 때 칸을 넘쳐 스크롤이 생긴다. */
function ZoomImage({ src, alt }: { src: string; alt: string }) {
  const boxRef = useRef<HTMLDivElement>(null)
  const [boxSize, setBoxSize] = useState<{ w: number; h: number } | null>(null)
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null)
  const [step, setStep] = useState(0)
  /* 배율을 바꾸기 직전에 보던 자리(칸 가운데가 그림의 어디였는지, 0~1).
     바꾼 뒤 같은 자리를 가운데로 되돌려, 키울 때 왼쪽 위로 튀지 않게 한다. */
  const focus = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    const box = boxRef.current
    if (!box) return
    const measure = () => setBoxSize({ w: box.clientWidth, h: box.clientHeight })
    measure()
    /* 창 크기가 바뀌거나 설명을 펼쳐 칸이 줄면 맞춤 크기도 다시 잡는다 */
    const ro = new ResizeObserver(measure)
    ro.observe(box)
    return () => ro.disconnect()
  }, [])

  const zoom = ZOOMS[step]
  const fit =
    boxSize && natural
      ? Math.min(boxSize.w / natural.w, boxSize.h / natural.h)
      : null

  useLayoutEffect(() => {
    const box = boxRef.current
    const f = focus.current
    if (!box || !f) return
    focus.current = null
    box.scrollLeft = f.x * box.scrollWidth - box.clientWidth / 2
    box.scrollTop = f.y * box.scrollHeight - box.clientHeight / 2
  }, [step])

  const go = (next: number) => {
    const box = boxRef.current
    if (!box || next < 0 || next >= ZOOMS.length) return
    focus.current = {
      x: (box.scrollLeft + box.clientWidth / 2) / box.scrollWidth,
      y: (box.scrollTop + box.clientHeight / 2) / box.scrollHeight,
    }
    setStep(next)
  }

  /* 화살표 키는 작업 넘기기가 쓴다 — 확대는 +/− 키로 */
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === '+' || e.key === '=') go(step + 1)
      if (e.key === '-' || e.key === '_') go(step - 1)
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  })

  return (
    <div className="relative min-h-0 flex-1 bg-white">
      <div ref={boxRef} className="absolute inset-0 overflow-auto">
        {/* 그림보다 칸이 크면 가운데에, 그림이 크면 그림만큼 넓어져 스크롤된다 */}
        <div className="grid min-h-full w-max min-w-full place-items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt}
            onLoad={(e) =>
              setNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })
            }
            /* 크기를 재기 전(이미지·칸이 아직 안 잡혔을 때)에는 CSS 로 칸에 맞춰 둔다 */
            style={
              fit
                ? { width: natural!.w * fit * zoom, height: natural!.h * fit * zoom, maxWidth: 'none' }
                : undefined
            }
            className={fit ? 'block' : 'max-h-full max-w-full object-contain'}
          />
        </div>
      </div>

      <div className="absolute bottom-3 right-3 flex items-center overflow-hidden rounded-full bg-white/90 text-neutral-700 shadow-md">
        <button
          onClick={() => go(step - 1)}
          disabled={step === 0}
          aria-label="축소"
          className="grid size-10 place-items-center text-lg transition hover:bg-neutral-100 disabled:opacity-30 disabled:hover:bg-transparent"
        >
          −
        </button>
        {/* 지금 배율 — 눌러서 처음 크기로 */}
        <button
          onClick={() => go(0)}
          aria-label="원래 크기로"
          className="min-w-12 px-1 text-xs tabular-nums transition hover:text-neutral-900"
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          onClick={() => go(step + 1)}
          disabled={step === ZOOMS.length - 1}
          aria-label="확대"
          className="grid size-10 place-items-center text-lg transition hover:bg-neutral-100 disabled:opacity-30 disabled:hover:bg-transparent"
        >
          +
        </button>
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
