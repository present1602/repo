'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { PublicWork } from '@/lib/designer-shape'

/* 좌우로 미끄러지는 시간(ms). 트랙에 거는 CSS 전환과 같은 값이어야
   끝나는 순간에 맞춰 자리를 정리할 수 있다. */
const SLIDE_MS = 280

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

  /* 이어진 화면처럼 미끄러뜨리기 위해 이전·현재·다음 세 장을 나란히 깔고
     트랙을 움직인다. shift 는 트랙이 밀려난 칸 수다:
       -1 = 다음 장 쪽으로(왼쪽으로) 밀림, +1 = 이전 장 쪽으로.
     전환이 끝나면 index 를 옮기고 트랙을 0 으로 되돌린다 — 그 순간에는
     전환을 꺼야(jump) 되돌아가는 모습이 보이지 않는다. */
  const [shift, setShift] = useState(0)
  const [jump, setJump] = useState(false)
  /* 손가락으로 끄는 중인 거리(px) — 놓기 전까지 그림이 손을 따라온다 */
  const [drag, setDrag] = useState(0)
  const slideTimer = useRef<number | undefined>(undefined)
  const sliding = useRef(false)

  const at = (i: number) => works[(i % works.length + works.length) % works.length]

  /* 작업물을 넘기면 펼쳐둔 설명은 접는다. */
  const go = (dir: 'left' | 'right') => {
    if (works.length < 2 || sliding.current) return
    sliding.current = true
    setOpen(false)
    setDrag(0)
    setShift(dir === 'left' ? -1 : 1)

    window.clearTimeout(slideTimer.current)
    slideTimer.current = window.setTimeout(() => {
      /* 전환이 끝난 자리에서 실제 index 를 옮기고 트랙을 제자리로.
         jump 로 전환을 끈 채 되돌려야 되감기는 모습이 안 보인다. */
      setJump(true)
      setIndex(
        dir === 'left'
          ? (index + 1) % works.length
          : (index - 1 + works.length) % works.length,
      )
      setShift(0)
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          setJump(false)
          sliding.current = false
        }),
      )
    }, SLIDE_MS)
  }

  const next = () => go('left')
  const prev = () => go('right')

  useEffect(() => () => window.clearTimeout(slideTimer.current), [])

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
  const meta = metaOf(w)
  const hasSheet = Boolean(w.title || meta || w.description)

  /* 모바일에서 그림을 내려 보는 동안에는 아래 설명 칸을 접어 둔다 —
     좁은 화면에서 그 칸이 그림을 크게 깎아먹는다. 다시 올리면 돌아온다.
     데스크톱은 높이가 넉넉해 늘 펼쳐 둔다(CSS 에서 md: 로 되돌린다). */
  const [hideSheet, setHideSheet] = useState(false)

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

            이전·현재·다음 세 장을 나란히 깔아 둔 트랙을 좌우로 민다 —
            한 장만 두고 바꿔치면 넘어가는 동안 빈 화면이 보인다.
            양옆은 미리 깔려 있어 미는 만큼 따라 들어온다. */}
        <div className="relative min-h-0 flex-1 overflow-hidden bg-white">
          <div
            className={`flex h-full ${jump ? '' : 'transition-transform duration-[280ms] ease-out'}`}
            style={{
              width: '300%',
              transform: `translateX(calc(${(-1 + shift) * (100 / 3)}% + ${drag}px))`,
            }}
          >
            {[-1, 0, 1].map((off) => {
              const item = at(index + off)
              return (
                <div key={`${item.id}-${off}`} className="relative h-full w-1/3 shrink-0">
                  <ZoomImage
                    /* 가운데 칸만 조작을 받는다 — 양옆은 미리 깔아 둔 그림이다 */
                    key={item.id}
                    src={item.image_url}
                    alt={item.title ?? ''}
                    active={off === 0}
                    onSwipe={
                      off === 0 && works.length > 1
                        ? (dir) => (dir === 'left' ? next() : prev())
                        : undefined
                    }
                    onDrag={off === 0 && works.length > 1 ? setDrag : undefined}
                    onScrollDown={off === 0 ? setHideSheet : undefined}
                  />
                </div>
              )
            })}
          </div>
        </div>

        {/* 한 장뿐이면 넘길 곳이 없다.
            화살표는 데스크톱에만 — 모바일은 옆으로 쓸어 넘긴다. */}
        {works.length > 1 && (
          <>
            <button
              onClick={prev}
              aria-label="이전"
              className="absolute left-3 top-1/2 hidden size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 shadow-md transition hover:bg-white md:flex"
            >
              ←
            </button>
            <button
              onClick={next}
              aria-label="다음"
              className="absolute right-3 top-1/2 hidden size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 shadow-md transition hover:bg-white md:flex"
            >
              →
            </button>
          </>
        )}

        {/* 모바일에서 그림을 내려 보는 동안에는 아래로 내려 숨긴다.

            높이를 줄이지 않고 제자리에서 미끄러뜨린다 — 높이를 건드리면
            그림 칸이 넓어지고, 그만큼 scrollTop 이 저절로 줄어 "위로 올림"
            으로 읽힌다. 그러면 다시 펴지고 또 접히는 진동이 생긴다.
            데스크톱(md:)은 높이가 넉넉해 늘 제자리에 둔다. */}
        {hasSheet && (
          <div
            className={`absolute inset-x-0 bottom-0 border-t border-neutral-200 bg-white px-5 py-5 transition-transform duration-300 ease-out md:relative md:translate-y-0 md:px-8 ${
              hideSheet ? 'translate-y-full' : 'translate-y-0'
            }`}
          >
            <SheetHead meta={meta} title={w.title} />

            {w.description && (
              /* 여기는 늘 두 줄까지만 — 펼친 글은 아래 덮개 시트가 보여준다.
                 이 칸이 자라면 이미지 칸이 줄어 그림이 작아진다. */
              <Excerpt key={w.id} text={w.description} open={open} onOpen={() => setOpen(true)} />
            )}
          </div>
        )}

        {/* 펼친 설명 — 이미지 위로 덮어 올린다. 늘 그려 두고 위치만 바꿔
            열고 닫힘이 부드럽게 이어지게 한다. 닫혀 있을 때는 inert 로
            포커스·스크린리더에서 뺀다. */}
        {hasSheet && w.description && (
          <>
            {/* 바깥을 누르면 접힌다 — 그림은 가리지 않도록 투명하게 둔다 */}
            <div
              aria-hidden
              onClick={() => setOpen(false)}
              className={`absolute inset-0 z-10 ${open ? '' : 'pointer-events-none'}`}
            />
            {/* 시트 바탕만 반투명하게 — 뒤 그림이 흐릿하게 비친다 */}
            <div
              inert={!open}
              className={`absolute inset-x-0 bottom-0 z-20 flex max-h-[75%] flex-col bg-white/80 px-5 py-5 shadow-[0_-8px_24px_rgba(0,0,0,0.08)] backdrop-blur-md transition-transform duration-300 ease-out md:px-8 ${
                open ? 'translate-y-0' : 'translate-y-full'
              }`}
            >
              <SheetHead meta={meta} title={w.title} />
              {/* pr — 오른쪽 아래 접기 버튼 자리를 비워 둔다 */}
              <p className="mt-2.5 min-h-0 overflow-y-auto whitespace-pre-line pr-7 text-[15px] leading-relaxed text-neutral-600">
                {w.description}
              </p>
              {/* 접기 — 접힌 칸의 V 와 같은 오른쪽 아래 자리에 둔다.
                  자리는 그대로이고 화살표만 위로 돌아간다. */}
              <button
                onClick={() => setOpen(false)}
                aria-label="설명 접기"
                aria-expanded={open}
                className="absolute bottom-5 right-5 text-neutral-400 transition hover:text-neutral-900 md:right-8"
              >
                <Chevron up={open} />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/* 표기 줄 — 클라이언트·AI·SOOM 중 있는 것만 이어 붙인다.

   AI 사용 표기는 true 일 때만 붙인다 — null(묻기 전에 올라간 작업)과
   false 를 구분해 보여주지 않는다. */
function metaOf(w: PublicWork): string {
  return [w.client, w.ai_used ? 'AI 활용' : null, w.soom_work ? 'SOOM 의뢰' : null]
    .filter(Boolean)
    .join(' · ')
}

/* 설명 칸 머리 — 접힌 칸과 펼친 시트가 같이 쓴다 */
function SheetHead({ meta, title }: { meta: string; title: string | null }) {
  return (
    <>
      {meta && <p className="text-[11px] tracking-widest text-neutral-500">{meta}</p>}
      {title && <h3 className="mt-1 text-xl font-semibold tracking-tight md:text-2xl">{title}</h3>}
    </>
  )
}

function Chevron({ up }: { up?: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`size-4 transition-transform duration-300 ${up ? 'rotate-180' : ''}`}
    >
      <path d="M4 6l4 4 4-4" />
    </svg>
  )
}

/* 확대 단계 — 1 은 칸 안에 통째로 들어오는 크기 */
const ZOOMS = [1, 1.5, 2, 3, 4]

/* 이 비율(세로/가로)보다 긴 그림은 높이를 포기하고 너비에 맞춘다.

   상세 페이지 캡처처럼 길쭉한 작업을 통째로 칸에 넣으면, 높이에 맞추느라
   가로가 손톱만 해져 아무것도 읽을 수 없다. 그런 그림은 너비를 꽉 채워
   윗부분부터 보여주고 나머지는 스크롤로 내려 보게 한다.

   1.6 — 4:5(1.25)나 2:3(1.5) 같은 흔한 세로 사진은 그대로 한 화면에 담기고,
   그보다 긴 화면 캡처부터 걸린다. */
const TALL_RATIO = 1.6

/* 원본 비율 그대로 칸 안에 맞춰 보여주고, 우측 하단 −/+ 로 키워 본다.
   모바일에서는 버튼 없이 두 손가락으로 집어 키운다(touch-action: pinch-zoom).

   처음에는 잘리지도 늘어나지도 않게 칸에 맞춘다 — 세로로 긴 그림은
   높이에 맞춰 좌우에 흰 여백이 남는다. 글자가 작아 안 보이면 키워서
   스크롤로 내려 본다.

   크기는 CSS 로 맡기지 않고 직접 잰다 — 칸에 맞춘 크기(fit)에 배율을
   곱한 픽셀 값을 줘야 키웠을 때 칸을 넘쳐 스크롤이 생긴다. */
function ZoomImage({
  src,
  alt,
  active,
  onSwipe,
  onDrag,
  onScrollDown,
}: {
  src: string
  alt: string
  /* 트랙 가운데 칸인지 — 양옆은 미리 깔아 둔 그림이라 조작을 받지 않는다 */
  active?: boolean
  onSwipe?: (dir: 'left' | 'right') => void
  /* 끄는 중인 거리(px) — 손을 따라 트랙이 움직이게 한다 */
  onDrag?: (px: number) => void
  /* 내려 보는 중인지 — 아래 설명 칸을 접고 펴는 데 쓴다 */
  onScrollDown?: (down: boolean) => void
}) {
  const boxRef = useRef<HTMLDivElement>(null)
  const [boxSize, setBoxSize] = useState<{ w: number; h: number } | null>(null)
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null)
  const [step, setStep] = useState(0)
  const [flash, setFlash] = useState(false)
  const flashTimer = useRef<number | undefined>(undefined)
  /* 배율을 바꾸기 직전에 보던 자리(칸 가운데가 그림의 어디였는지, 0~1).
     바꾼 뒤 같은 자리를 가운데로 되돌려, 키울 때 왼쪽 위로 튀지 않게 한다. */
  const focus = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    const box = boxRef.current
    if (!box) return
    const measure = () => setBoxSize({ w: box.clientWidth, h: box.clientHeight })
    measure()
    /* 창 크기가 바뀌면 맞춤 크기도 다시 잡는다 */
    const ro = new ResizeObserver(measure)
    ro.observe(box)
    return () => ro.disconnect()
  }, [])

  const zoom = ZOOMS[step]

  /* 길쭉한 그림은 너비에 맞춰 잘리게 두고, 나머지는 칸 안에 통째로 넣는다 */
  const tall = natural ? natural.h / natural.w > TALL_RATIO : false
  const fit =
    boxSize && natural
      ? tall
        ? boxSize.w / natural.w
        : Math.min(boxSize.w / natural.w, boxSize.h / natural.h)
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

    /* 배율은 늘 띄워 두지 않고, 바꿀 때만 잠깐 보였다가 사라진다 */
    setFlash(true)
    window.clearTimeout(flashTimer.current)
    flashTimer.current = window.setTimeout(() => setFlash(false), 900)
  }

  useEffect(() => () => window.clearTimeout(flashTimer.current), [])

  /* 내려 보는 중인지 알린다 — 아래로 내리면 설명 칸을 접고, 위로 올리면 편다.
     맨 위 근처(<24px)에서는 늘 펴 둔다.

     한 번의 움직임으로 바로 뒤집지 않고 같은 방향으로 쌓인 양(acc)이
     THRESHOLD 를 넘을 때만 바꾼다. 칸이 접히면 보이는 높이가 늘어 scrollTop
     이 저절로 줄어드는데, 그 변화를 "위로 올림"으로 읽으면 다시 펴지고 또
     접히는 진동이 생긴다. 반대 방향 신호가 조금 섞여도 버티게 한다. */
  const lastTop = useRef(0)
  const acc = useRef(0)
  const down = useRef(false)
  const SCROLL_THRESHOLD = 28

  const onScroll = () => {
    const box = boxRef.current
    if (!box || !onScrollDown) return
    const top = box.scrollTop
    const dy = top - lastTop.current
    lastTop.current = top

    if (top < 24) {
      acc.current = 0
      if (down.current) {
        down.current = false
        onScrollDown(false)
      }
      return
    }

    /* 방향이 바뀌면 쌓아 둔 양을 버리고 새로 센다 */
    if ((dy > 0) !== (acc.current > 0)) acc.current = 0
    acc.current += dy

    if (acc.current > SCROLL_THRESHOLD && !down.current) {
      down.current = true
      acc.current = 0
      onScrollDown(true)
    } else if (acc.current < -SCROLL_THRESHOLD && down.current) {
      down.current = false
      acc.current = 0
      onScrollDown(false)
    }
  }

  /* 확대했을 때 마우스로 끌어 옮긴다 — 손 모양 커서로 잡고 끄는 만큼
     스크롤을 반대로 움직인다. 터치는 브라우저 기본 스크롤이 이미 같은 일을
     하므로 마우스만 다룬다. */
  const drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null)
  const [dragging, setDragging] = useState(false)
  const pannable = step > 0

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const box = boxRef.current
    if (!box || !pannable || e.pointerType !== 'mouse' || e.button !== 0) return
    e.preventDefault()
    box.setPointerCapture(e.pointerId)
    drag.current = { x: e.clientX, y: e.clientY, left: box.scrollLeft, top: box.scrollTop }
    setDragging(true)
  }

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const box = boxRef.current
    const d = drag.current
    if (!box || !d) return
    box.scrollLeft = d.left - (e.clientX - d.x)
    box.scrollTop = d.top - (e.clientY - d.y)
  }

  const endDrag = () => {
    drag.current = null
    setDragging(false)
  }

  /* 화살표 키는 작업 넘기기가 쓴다 — 확대는 +/− 키로.
     트랙에 세 장이 깔려 있으므로 가운데 칸만 듣는다 — 셋 다 들으면
     한 번 눌러도 배율이 세 단계씩 뛴다. */
  useEffect(() => {
    if (!active) return
    const h = (e: KeyboardEvent) => {
      if (e.key === '+' || e.key === '=') go(step + 1)
      if (e.key === '-' || e.key === '_') go(step - 1)
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  })

  /* 옆으로 쓸어 다음·이전 작업으로 — 모바일에서 화살표 버튼을 대신한다.

     브라우저 기본 동작(세로 스크롤·핀치 줌)을 막지 않으려고 touch 이벤트를
     수동으로 듣고 preventDefault 는 하지 않는다.

     확대해서 그림이 칸보다 넓을 때는, 먼저 그림 안을 둘러보게 둔다.
     좌우 끝에 닿은 채로 시작한 쓸기만 넘기기로 친다 — 사진 앱들과 같다.
     중간에서 끝까지 밀어붙인 그 동작은 넘기지 않고, 다음 쓸기부터 유효하다.
     끝에서 시작했을 때는 실수로 넘어가지 않게 문턱을 더 높인다.

     넘기지 않는 경우:
       · 두 손가락 이상 — 집어서 키우는 중이다
       · 그림이 칸보다 넓은데 그쪽 끝이 아님 — 둘러보는 중이다
       · 세로로 더 많이 움직임 — 설명을 읽으려 위아래로 쓴 것이다 */
  const touch = useRef<{
    x: number
    y: number
    multi: boolean
    /* 쓸기를 시작한 순간 좌·우 끝에 닿아 있었는지 */
    atStart: boolean
    atEnd: boolean
    /* 확대되어 가로로 둘러볼 여지가 있는 상태인지 */
    wide: boolean
  } | null>(null)
  const SWIPE_MIN = 50
  /* 확대 상태에서 넘길 때의 문턱 — 둘러보다 끝에 닿아 살짝 더 민 것을
     넘기기로 오해하지 않도록 평소보다 크게 잡는다. */
  const SWIPE_MIN_ZOOMED = 90

  const onTouchStart = (e: React.TouchEvent) => {
    if (!onSwipe || e.touches.length !== 1) {
      touch.current = null
      return
    }
    const box = boxRef.current
    const t = e.touches[0]
    const wide = Boolean(box && box.scrollWidth > box.clientWidth + 1)
    touch.current = {
      x: t.clientX,
      y: t.clientY,
      multi: false,
      wide,
      atStart: !box || box.scrollLeft <= 1,
      atEnd: !box || box.scrollLeft >= box.scrollWidth - box.clientWidth - 1,
    }
  }

  const onTouchMove = (e: React.TouchEvent) => {
    const s = touch.current
    if (!s) return
    /* 중간에 손가락이 늘면 핀치로 본다 — 그 제스처는 넘기지 않는다 */
    if (e.touches.length > 1) {
      s.multi = true
      onDrag?.(0)
      return
    }
    if (s.multi || !onDrag) return

    const t = e.touches[0]
    const dx = t.clientX - s.x
    const dy = t.clientY - s.y
    if (Math.abs(dx) <= Math.abs(dy)) return
    /* 넘길 수 있는 방향으로만 손을 따라간다 */
    if (s.wide && ((dx < 0 && !s.atEnd) || (dx > 0 && !s.atStart))) return
    /* 끝에서 더 끌면 뻑뻑하게 — 넘길 수 있다는 느낌만 준다 */
    onDrag(dx * 0.55)
  }

  const onTouchEnd = (e: React.TouchEvent) => {
    const s = touch.current
    touch.current = null
    onDrag?.(0)
    if (!s || !onSwipe || s.multi) return

    const t = e.changedTouches[0]
    const dx = t.clientX - s.x
    const dy = t.clientY - s.y
    const min = s.wide ? SWIPE_MIN_ZOOMED : SWIPE_MIN
    if (Math.abs(dx) < min || Math.abs(dx) <= Math.abs(dy)) return

    /* 확대 중이면 그 방향 끝에서 시작한 쓸기만 넘긴다 */
    if (s.wide && ((dx < 0 && !s.atEnd) || (dx > 0 && !s.atStart))) return

    /* 왼쪽으로 쓸면 다음 장 — 종이를 넘기는 방향과 같다 */
    onSwipe(dx < 0 ? 'left' : 'right')
  }

  return (
    <div className="relative h-full w-full bg-white">
      {/* 두 손가락으로 집어 키우는 동작(pinch-zoom)과 세로 스크롤(pan-y)은
          브라우저에 맡긴다. 확대돼 가로로 둘러볼 수 있을 때만 pan-x 를 열어
          그림 안을 훑게 하고, 끝에 닿은 뒤의 쓸기는 위 onTouch* 가 받는다. */}
      <div
        ref={boxRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onScroll={onScroll}
        style={{ touchAction: pannable ? 'pan-x pan-y pinch-zoom' : 'pan-y pinch-zoom' }}
        className={`absolute inset-0 overflow-auto ${
          pannable ? (dragging ? 'cursor-grabbing select-none' : 'cursor-grab') : ''
        }`}
      >
        {/* 그림보다 칸이 크면 가운데에, 그림이 크면 그림만큼 넓어져 스크롤된다.
            길쭉한 그림만 위에서 시작한다 — 가운데로 두면 첫 화면이 그림
            중간부터라 윗부분(제목·히어로)을 놓친다. */}
        <div
          className={`grid min-h-full w-max min-w-full justify-items-center ${
            tall ? 'items-start' : 'items-center'
          }`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt}
            /* 브라우저 기본 이미지 끌기(유령 이미지)가 끌어 옮기기를 가로챈다 */
            draggable={false}
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

      {/* 테두리·바탕 없이 버튼 둘만 띄운다. 흰 그림 위에서도 보이도록
          반투명한 어두운 원으로 두고, 배율 숫자는 바꿀 때만 왼쪽에 잠깐 뜬다.

          모바일에서는 띄우지 않는다 — 두 손가락으로 집어 키우는 쪽이
          훨씬 빠르고, 버튼이 그림 위 자리만 차지한다. */}
      <div
        className={`absolute bottom-3 right-3 hidden items-center gap-1.5 ${
          active ? 'md:flex' : ''
        }`}
      >
        <span
          aria-live="polite"
          className={`pointer-events-none mr-1 rounded-full bg-neutral-900/70 px-2.5 py-1 text-xs tabular-nums text-white transition-opacity duration-300 ${
            flash ? 'opacity-100' : 'opacity-0'
          }`}
        >
          {Math.round(zoom * 100)}%
        </span>
        <button
          onClick={() => go(step - 1)}
          disabled={step === 0}
          aria-label="축소"
          className="grid size-9 place-items-center rounded-full bg-neutral-900/50 text-lg leading-none text-white backdrop-blur-sm transition hover:bg-neutral-900/75 disabled:opacity-30"
        >
          −
        </button>
        <button
          onClick={() => go(step + 1)}
          disabled={step === ZOOMS.length - 1}
          aria-label="확대"
          className="grid size-9 place-items-center rounded-full bg-neutral-900/50 text-lg leading-none text-white backdrop-blur-sm transition hover:bg-neutral-900/75 disabled:opacity-30"
        >
          +
        </button>
      </div>
    </div>
  )
}

/* 접힌 설명 — 두 줄까지 보이고, 넘치면 둘째 줄 끝이 '…' 로 끊기며
   그 오른쪽에 V 가 붙는다. 글 아무 데나 눌러도 펼쳐진다.

   V 를 둘째 줄 끝에 앉히는 방법: 글 칸 안에 오른쪽으로 뜨는 빈 기둥
   (::before, 높이 = 전체 - 한 줄)을 세우고, V 를 그 아래(clear)에 띄운다.
   그러면 V 는 마지막 줄 오른쪽 끝에 자리를 잡고 글이 그 앞에서 '…' 로
   끊긴다. 기둥 높이를 % 로 주려면 부모 높이가 정해져 있어야 해서
   바깥을 flex 로 감싼다.

   넘치는지는 글 수로 어림잡지 않고 숨은 사본의 실제 높이로 잰다 —
   줄바꿈이 섞인 글에서 어림이 틀린다. */
function Excerpt({
  text,
  open,
  onOpen,
}: {
  text: string
  open: boolean
  onOpen: () => void
}) {
  const [overflows, setOverflows] = useState(false)
  const [el, setEl] = useState<HTMLParagraphElement | null>(null)

  /* 접힌 칸에서는 줄바꿈을 공백으로 잇는다 — 살려 두면 첫 문단이 짧을 때
     둘째 줄이 빈 줄이 되어 '… V' 만 남는다. 문단은 펼친 시트에서 보인다. */
  const flat = text.replace(/\s*\n+\s*/g, ' ').trim()
  const textCls = 'line-clamp-2 text-[15px] leading-relaxed'

  useEffect(() => {
    if (!el) return

    const measure = () => setOverflows(el.scrollHeight > el.clientHeight + 1)
    measure()

    /* 모달 폭이 바뀌면 줄 수도 바뀐다 */
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [el, flat])

  return (
    /* relative — 숨은 사본이 이 칸을 기준으로 선다 */
    <div className="relative mt-2.5">
      {/* 높이를 재기 위한 숨은 사본 — V 가 없는 순수한 글이어야
          "두 줄을 넘는지"를 바로 잴 수 있다. inset-x-0 으로 보이는 글과
          같은 너비를 갖게 한다 — 너비가 다르면 줄 수가 달라진다. */}
      <p
        ref={setEl}
        aria-hidden
        className={`pointer-events-none invisible absolute inset-x-0 top-0 ${textCls}`}
      >
        {flat}
      </p>

      {overflows ? (
        <div
          role="button"
          tabIndex={0}
          aria-label="설명 더 보기"
          aria-expanded={open}
          onClick={onOpen}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              onOpen()
            }
          }}
          className="group flex cursor-pointer"
        >
          <p
            className={`${textCls} text-neutral-600 transition group-hover:text-neutral-900 before:float-right before:h-[calc(100%-1lh)] before:content-['']`}
          >
            <span className="float-right clear-both ml-1 mt-[0.2em] text-neutral-400 transition group-hover:text-neutral-900">
              <Chevron />
            </span>
            {flat}
          </p>
        </div>
      ) : (
        <p className={`${textCls} text-neutral-600`}>{flat}</p>
      )}
    </div>
  )
}
