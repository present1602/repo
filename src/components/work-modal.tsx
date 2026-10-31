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
         index 이동과 shift 되돌리기는 React 가 한 번에 묶어 처리하므로
         중간 상태는 화면에 나오지 않는다. jump 로 전환만 꺼 두면
         트랙이 되감기는 모습 없이 조용히 제자리로 간다. */
      setJump(true)
      setIndex(
        dir === 'left'
          ? (index + 1) % works.length
          : (index - 1 + works.length) % works.length,
      )
      setShift(0)
    }, SLIDE_MS)
  }

  const next = () => go('left')
  const prev = () => go('right')

  /* 제자리로 돌려놓은 화면이 한 번 그려진 뒤에 전환을 다시 켠다.
     같은 렌더에서 켜면 그 전환이 방금의 되돌림에 걸려 트랙이 미끄러진다. */
  useLayoutEffect(() => {
    if (!jump) return
    const id = requestAnimationFrame(() => {
      setJump(false)
      sliding.current = false
    })
    return () => cancelAnimationFrame(id)
  }, [jump])

  /* 양옆의 한 칸 더 바깥까지 미리 받아 둔다.

     넘어간 직후에는 반대편 끝 칸이 처음 보는 그림이라 비어 있다 —
     트랙이 제자리로 돌아간 그 순간 그 칸이 흰 채로 한 번 스친다.
     브라우저 캐시에 올려 두면 교체되자마자 바로 그려진다. */
  useEffect(() => {
    if (works.length < 2) return
    const n = works.length
    for (const off of [-2, 2]) {
      const img = new Image()
      img.src = works[(((index + off) % n) + n) % n].image_url
    }
  }, [index, works])

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
     그림을 톡 쳐도 여닫힌다 — 스크롤이 없는 짧은 그림에서는 그게 유일한 길이다.
     데스크톱은 높이가 넉넉해 늘 펼쳐 둔다(CSS 에서 md: 로 되돌린다). */
  const [hideSheet, setHideSheet] = useState(false)

  /* 작업을 넘기면 접어 둔 것들을 처음 상태로 되돌린다 —
     앞 작업에서 숨겨 둔 채로 다음 그림이 열리면 설명이 사라진 것처럼 보인다.
     effect 가 아니라 렌더 중에 맞춘다(React 의 "렌더 중 상태 조정"). */
  const [seenId, setSeenId] = useState(w.id)
  if (seenId !== w.id) {
    setSeenId(w.id)
    setHideSheet(false)
    setOpen(false)
  }

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
                /* key 는 그림이 아니라 '자리'로 잡는다 — 작업 id 로 두면 넘어간
                   뒤 세 칸이 모두 새로 마운트되어 <img> 가 다시 로드되고,
                   그 사이 빈 화면이 한 번 번쩍인다. 자리로 두면 같은 요소가
                   src 만 바꿔 다는 데다, 이미 받아 둔 그림은 즉시 그려진다. */
                <div key={off} className="relative h-full w-1/3 shrink-0">
                  <ZoomImage
                    /* 가운데 칸만 조작을 받는다 — 양옆은 미리 깔아 둔 그림이다.
                       src 가 바뀌면 배율·스크롤은 ZoomImage 안에서 되돌린다. */
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
                    onTap={
                      off === 0
                        ? () => {
                            /* 펼쳐 둔 설명이 있으면 먼저 접고, 그다음 눌러야 숨는다 —
                               한 번에 다 사라지면 무엇이 닫혔는지 알기 어렵다. */
                            if (open) setOpen(false)
                            else setHideSheet((v) => !v)
                          }
                        : undefined
                    }
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

            시트는 하나뿐이다 — 접힘·펼침이 같은 요소다. 예전에는 접힌 칸
            위로 펼친 칸을 따로 덮었는데, 그러면 전환하는 동안 제목이 두 벌
            보였다. 지금은 제목을 제자리에 둔 채 설명 칸의 높이만 늘린다.

            모바일에서는 그림 위에 떠 있다(absolute) — 높이를 차지하면
            접힐 때 그림 칸이 넓어지고, 그만큼 scrollTop 이 줄어 "위로 올림"
            으로 읽혀 다시 펴지는 진동이 생긴다. 데스크톱(md:)은 높이가
            넉넉해 흐름 안에 둔다. */}
        {hasSheet && (
          <>
            <div
              className={`absolute inset-x-0 bottom-0 z-20 border-t border-neutral-200 bg-white/95 px-5 pb-5 pt-3 backdrop-blur-md transition-transform duration-300 ease-out md:relative md:translate-y-0 md:bg-white md:px-8 md:pt-5 ${
                hideSheet ? 'translate-y-full' : 'translate-y-0'
              }`}
            >
              {/* 손잡이 — 만질 수 있는 칸이라는 표시. 눌러도 접힌다. */}
              <button
                onClick={() => setHideSheet(true)}
                aria-label="설명 숨기기"
                className="mx-auto mb-3 block h-1 w-9 rounded-full bg-neutral-300 transition hover:bg-neutral-400 md:hidden"
              />

              <SheetHead meta={meta} title={w.title} />

              {w.description && (
                <Excerpt text={w.description} open={open} onToggle={() => setOpen((v) => !v)} />
              )}
            </div>

            {/* 숨겨 둔 동안 바닥에 남겨 두는 손잡이 — 그림을 톡 쳐도 되지만,
                되돌릴 수 있다는 것 자체가 보이지 않으면 사라진 줄 안다. */}
            <button
              onClick={() => setHideSheet(false)}
              aria-label="설명 보기"
              aria-hidden={!hideSheet}
              tabIndex={hideSheet ? 0 : -1}
              className={`absolute inset-x-0 bottom-0 z-10 flex h-9 items-end justify-center pb-2 transition-opacity duration-300 md:hidden ${
                hideSheet ? 'opacity-100' : 'pointer-events-none opacity-0'
              }`}
            >
              <span className="h-1 w-9 rounded-full bg-white/70 shadow-[0_0_8px_rgba(0,0,0,0.35)]" />
            </button>
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
  onTap,
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
  /* 그림을 가볍게 눌렀을 때 — 설명 칸을 숨기거나 되돌린다 */
  onTap?: () => void
}) {
  const boxRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const [boxSize, setBoxSize] = useState<{ w: number; h: number } | null>(null)
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null)
  const [step, setStep] = useState(0)
  const [flash, setFlash] = useState(false)
  const flashTimer = useRef<number | undefined>(undefined)
  /* 배율을 바꾸기 직전에 보던 자리(칸 가운데가 그림의 어디였는지, 0~1).
     바꾼 뒤 같은 자리를 가운데로 되돌려, 키울 때 왼쪽 위로 튀지 않게 한다. */
  const focus = useRef<{ x: number; y: number } | null>(null)

  /* 세로 스크롤 방향을 재는 값들 — 아래 onScroll 이 쓴다.
     작업이 바뀔 때 함께 비워야 해서 여기서 선언한다. */
  const lastTop = useRef(0)
  const acc = useRef(0)
  const down = useRef(false)

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

  /* 다른 작업으로 바뀌면 처음 상태로 — 예전에는 key 로 통째로 새로 그려
     저절로 됐지만, 이제 같은 요소가 src 만 바꿔 달기 때문에 직접 되돌린다.
     배율·스크롤이 남아 있으면 다음 그림이 확대된 채 중간부터 보인다.

     effect 가 아니라 렌더 중에 되돌린다 — effect 로 미루면 옛 배율로 한 번
     그린 뒤 고쳐지는 게 보인다(React 의 "렌더 중 상태 조정" 패턴). */
  const [seenSrc, setSeenSrc] = useState(src)
  if (seenSrc !== src) {
    setSeenSrc(src)
    setStep(0)
    setFlash(false)
    /* natural 은 비우지 않는다 — 비우면 fit 이 null 이 되어 그 한 프레임
       동안 <img> 에 크기가 안 붙고 원본 크기(1600px 등)로 그려진다.
       그게 넘긴 직후 화면이 번쩍이는 원인이었다. 새 치수는 아래
       useLayoutEffect 가 즉시(캐시된 그림) 또는 onLoad 가 채운다. */
  }

  /* ref 와 스크롤 위치는 렌더 중에 건드릴 수 없다 — 그려지기 직전에 되돌린다.
     이미 받아 둔 그림이면 여기서 바로 치수를 읽어 둔다. onLoad 는 캐시된
     이미지에서 늦게 오거나 아예 오지 않을 수 있다. */
  useLayoutEffect(() => {
    focus.current = null
    acc.current = 0
    down.current = false
    lastTop.current = 0
    const box = boxRef.current
    if (box) {
      box.scrollTop = 0
      box.scrollLeft = 0
    }
    const img = imgRef.current
    if (img?.complete && img.naturalWidth > 0) {
      setNatural({ w: img.naturalWidth, h: img.naturalHeight })
    }
  }, [src])

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
    /* 탭인지 가리는 데 쓴다 — 짧게 눌렀다 뗀 것만 탭이다 */
    at: number
    moved: boolean
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
  /* 탭으로 치는 한계 — 이보다 길게 누르거나 많이 움직이면 탭이 아니다 */
  const TAP_MS = 400
  const TAP_SLOP = 10

  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) {
      touch.current = null
      return
    }
    const box = boxRef.current
    const t = e.touches[0]
    const wide = Boolean(box && box.scrollWidth > box.clientWidth + 1)
    touch.current = {
      x: t.clientX,
      y: t.clientY,
      at: Date.now(),
      moved: false,
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
    if (s.multi) return

    /* 조금이라도 움직였으면 탭이 아니다 */
    {
      const t0 = e.touches[0]
      if (Math.abs(t0.clientX - s.x) > TAP_SLOP || Math.abs(t0.clientY - s.y) > TAP_SLOP) {
        s.moved = true
      }
    }
    if (!onDrag) return

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
    if (!s || s.multi) return

    /* 짧게 톡 친 것 — 설명 칸을 숨기거나 되돌린다.
       스크롤이 없는 짧은 그림에서는 이것이 설명 칸을 치우는 유일한 길이다. */
    if (!s.moved && Date.now() - s.at < TAP_MS) {
      onTap?.()
      return
    }

    if (!onSwipe) return

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
            ref={imgRef}
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

/* 설명 — 접히면 두 줄 높이까지만 보이고, 누르면 전체가 펼쳐진다.

   글자를 자르지 않는다. line-clamp 로 '…' 를 만들면 펼치는 순간 그 자리에
   뒷 글자가 밀려 들어와 둘째 줄이 통째로 바뀐다 — 높이는 부드럽게 늘어나는데
   글자만 한 프레임에 교체되어 더 눈에 띈다. 그래서 전문을 늘 그려 두고
   칸의 높이(max-height)만 바꾼다. 글은 한 글자도 움직이지 않는다.

   잘린 아래쪽은 페이드로 덮어 "더 있다"를 알린다 — '…' 를 대신하는 신호다.

   접힌 동안에는 줄바꿈을 공백으로 잇는다 — 살려 두면 첫 문단이 짧을 때
   둘째 줄이 빈 줄이 되어 아무것도 안 보인다. 펼치면 문단이 되살아난다. */
function Excerpt({
  text,
  open,
  onToggle,
}: {
  text: string
  open: boolean
  onToggle: () => void
}) {
  const [overflows, setOverflows] = useState(false)
  const [el, setEl] = useState<HTMLParagraphElement | null>(null)

  const flat = text.replace(/\s*\n+\s*/g, ' ').trim()

  useEffect(() => {
    if (!el) return
    /* 두 줄 높이를 넘는 글만 펼칠 거리가 있다 */
    const measure = () => setOverflows(el.scrollHeight > el.clientHeight + 1)
    measure()
    /* 모달 폭이 바뀌면 줄 수도 바뀐다 */
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [el, flat, open])

  const body = (
    <div className="relative">
      <p
        ref={setEl}
        /* max-h 로만 여닫는다 — 접었을 때는 딱 두 줄(2lh), 펼치면 시트가
           화면을 다 먹지 않도록 상한을 두고 그 안에서 스크롤한다. */
        className={`overflow-y-auto text-[15px] leading-relaxed text-neutral-600 transition-[max-height] duration-300 ease-out ${
          open ? 'max-h-[40vh] whitespace-pre-line' : 'max-h-[2lh] overflow-hidden'
        }`}
      >
        {open ? text : flat}
      </p>

      {/* 접혀 있고 넘칠 때만 아래를 흐린다 — 잘린 티를 내는 자리 */}
      {!open && overflows && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-white to-transparent md:from-white"
        />
      )}
    </div>
  )

  /* 펼칠 것이 없으면 그냥 글만 둔다 — 눌러도 아무 일이 없는 칸을
     누를 수 있는 것처럼 보이게 하지 않는다. */
  if (!overflows && !open) return <div className="mt-2.5">{body}</div>

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={open ? '설명 접기' : '설명 더 보기'}
      aria-expanded={open}
      onClick={onToggle}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onToggle()
        }
      }}
      className="group mt-2.5 cursor-pointer"
    >
      {body}
      {/* 여닫는 표시 — 글 아래 오른쪽에 둔다. 글 흐름 밖이라
          펼쳐도 글자가 밀리지 않는다. */}
      <span className="mt-1 flex justify-end text-neutral-400 transition group-hover:text-neutral-900">
        <Chevron up={open} />
      </span>
    </div>
  )
}
