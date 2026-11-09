'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import type { PublicWork } from '@/lib/designer-shape'
import type { WorkPage } from '@/lib/portfolio-limits'
import { DEFAULT_RATIO, embedUrl, youtubeRatioProbe } from '@/lib/youtube'
import { AiBadge } from './work-thumb'

/* 좌우로 미끄러지는 시간(ms). 트랙에 거는 CSS 전환과 같은 값이어야
   끝나는 순간에 맞춰 자리를 정리할 수 있다. */
const SLIDE_MS = 280

export function WorkModal<W extends PublicWork>({
  works,
  index,
  setIndex,
  onClose,
  nameOf,
  hrefOf,
  counterOf,
  loop = true,
}: {
  works: W[]
  index: number
  setIndex: (i: number) => void
  onClose: () => void
  /* 헤더 번호 왼쪽에 붙일 디자이너 이름(가린 이름).
     넘기는 동안 같은 사람의 작업인지 알아보게 한다 — 없으면 번호만 둔다. */
  nameOf?: (w: W) => string
  /* 이름을 눌렀을 때 갈 디자이너 페이지 주소 */
  hrefOf?: (w: W) => string
  /* 헤더 번호를 전체가 아닌 다른 기준으로 셀 때 — [몇 번째, 모두].
     여러 디자이너를 이어 넘기는 탐색에서는 그 디자이너 안에서 센다. */
  counterOf?: (w: W) => [number, number]
  /* 끝에서 처음으로 돌아갈지. 끄면 양 끝에서 더 넘어가지 않는다. */
  loop?: boolean
}) {
  const w = works[index]
  const [num, total] = counterOf?.(w) ?? [index + 1, works.length]
  const hasPrev = works.length > 1 && (loop || index > 0)
  const hasNext = works.length > 1 && (loop || index < works.length - 1)
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

  /* 돌지 않을 때 범위를 벗어난 자리는 비워 둔다 */
  const at = (i: number): W | undefined =>
    loop ? works[((i % works.length) + works.length) % works.length] : works[i]

  /* 끝에서 더 끌면 고무줄처럼 조금만 따라온다 — 넘어갈 곳이 없다는 걸 손으로 알린다.
     양수가 오른쪽(이전 쪽)으로 끄는 방향이다. */
  const dragTo = (px: number) =>
    setDrag((px > 0 && !hasPrev) || (px < 0 && !hasNext) ? px * 0.3 : px)

  /* 돌지 않는 목록의 끝에서 더 넘기려 하면 넘기지 않고 짧게 알린다 —
     아무 반응이 없으면 고장 난 줄 안다. 화살표 버튼은 끝에서 감춰지므로
     키보드 ←→ 와 옆으로 쓸기에서 온다. */
  const [edge, setEdge] = useState<string | null>(null)
  const edgeTimer = useRef<number | undefined>(undefined)
  const showEdge = (text: string) => {
    setEdge(text)
    window.clearTimeout(edgeTimer.current)
    edgeTimer.current = window.setTimeout(() => setEdge(null), 1800)
  }
  useEffect(() => () => window.clearTimeout(edgeTimer.current), [])

  /* 작업물을 넘기면 펼쳐둔 설명은 접는다. */
  const go = (dir: 'left' | 'right') => {
    if (sliding.current) return
    if (dir === 'left' ? !hasNext : !hasPrev) {
      setDrag(0)
      if (works.length > 1) showEdge(dir === 'left' ? '마지막 포트폴리오입니다.' : '첫번째 포트폴리오입니다.')
      return
    }
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
      const item = loop ? works[(((index + off) % n) + n) % n] : works[index + off]
      if (!item) continue
      const img = new Image()
      img.src = item.image_url
    }
  }, [index, works, loop])

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
  /* 설명이 두 줄을 넘어 펼칠 거리가 있는지 — Excerpt 가 재서 알려준다 */
  const [canExpand, setCanExpand] = useState(false)

  /* 모바일에서 시트가 그림 위를 덮는 높이(px).

     시트는 absolute 라 그림 칸의 높이 계산에 잡히지 않는다. 그대로 두면
     그림은 바닥까지 있는 셈 치고 가운데를 잡는데, 실제로 보이는 곳은
     시트 위까지라 가로로 긴 그림이 위로 치우쳐 보인다 — 위 여백이 아래보다
     넓어지는 그 증상이다. 덮는 만큼을 재서 그림 칸 아래 여백으로 준다.
     데스크톱은 시트가 흐름 안(md:relative)에 있어 0 이다. */
  const sheetRef = useRef<HTMLDivElement>(null)
  const [sheetH, setSheetH] = useState(0)

  useLayoutEffect(() => {
    const el = sheetRef.current
    if (!el) {
      setSheetH(0)
      return
    }
    const measure = () => {
      /* 흐름 안에 있으면(데스크톱) 그림 칸을 밀어낼 필요가 없다 */
      const floating = getComputedStyle(el).position === 'absolute'
      setSheetH(floating && !hideSheet ? el.offsetHeight : 0)
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    window.addEventListener('resize', measure)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [hasSheet, hideSheet, open])

  /* 손잡이를 잡아 끄는 중인 거리(px). 손을 따라 시트가 움직이고,
     충분히 끌었으면 그대로 숨기거나 올린다. 덜 끌었으면 제자리로 돌아온다.
       펼친 상태: 0 이상 — 아래로 내린 거리
       숨긴 상태: 0 이하 — 바닥에서 위로 끌어올린 거리 */
  const [sheetDrag, setSheetDrag] = useState(0)
  const HIDE_AT = 44

  const startHandleDrag = (e: React.PointerEvent<HTMLButtonElement>) => {
    const el = e.currentTarget
    const y0 = e.clientY
    /* 누른 순간의 상태로 방향을 정한다 — 펼쳐져 있으면 내리기, 숨겨져 있으면 올리기 */
    const raising = hideSheet
    /* 시트 높이보다 더 올려 봐야 더 보여 줄 것이 없다 */
    const maxUp = sheetRef.current?.offsetHeight ?? 0
    const clamp = (dy: number) => (raising ? Math.max(-maxUp, Math.min(0, dy)) : Math.max(0, dy))
    el.setPointerCapture(e.pointerId)

    const move = (ev: PointerEvent) => {
      setSheetDrag(clamp(ev.clientY - y0))
    }
    const end = (ev: PointerEvent) => {
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', end)
      el.removeEventListener('pointercancel', end)
      const dy = clamp(ev.clientY - y0)
      setSheetDrag(0)
      /* 끈 거리가 문턱을 넘으면 숨기거나 올린다. 짧게 톡 친 경우는
         onClick 이 받아 처리하므로 여기서는 아무것도 하지 않는다. */
      if (raising && dy < -HIDE_AT) setHideSheet(false)
      if (!raising && dy > HIDE_AT) setHideSheet(true)
    }
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', end)
    el.addEventListener('pointercancel', end)
  }

  /* 작업을 넘기면 펼쳐 둔 설명은 접는다.
     시트를 내려 둔 상태는 그대로 이어 간다 — 그림만 넘겨 보려고 내린 것이니
     넘길 때마다 다시 올라오면 매번 도로 내려야 한다.
     effect 가 아니라 렌더 중에 맞춘다(React 의 "렌더 중 상태 조정"). */
  const [seenId, setSeenId] = useState(w.id)
  if (seenId !== w.id) {
    setSeenId(w.id)
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
        className="relative flex h-full w-full flex-col overflow-hidden bg-white md:h-[92vh] md:max-w-6xl md:rounded-2xl"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-neutral-200 px-5 py-3">
          <span className="flex min-w-0 items-baseline gap-2.5 text-xs text-neutral-500">
            {/* 주소를 주면 이름이 그 디자이너 페이지로 가는 링크가 된다 —
                누를 수 있다는 걸 색으로 알린다 */}
            {nameOf &&
              (hrefOf ? (
                <Link
                  href={hrefOf(w)}
                  /* 넘어가기 전에 뒤 화면을 맨 위로 바로 올려 둔다.
                     Next 는 새 화면의 윗변이 이미 보이면 스크롤을 건드리지 않아,
                     목록을 조금 내려 둔 채 넘어가면 새 화면 위쪽이 상단 바에 가린다.
                     홈은 html 에 smooth 가 걸려 있어 Next 에 맡기면 흐르듯 올라간다 —
                     'instant' 로 그 설정을 이긴다. 모달이 덮고 있어 이 움직임은 보이지 않는다. */
                  onClick={() => window.scrollTo({ top: 0, behavior: 'instant' })}
                  className="truncate text-sm font-semibold text-violet-600 transition hover:text-violet-800 hover:underline"
                >
                  {nameOf(w)}
                </Link>
              ) : (
                <span className="truncate text-sm font-semibold text-neutral-900">{nameOf(w)}</span>
              ))}
            <span className="shrink-0 tracking-widest">
              {String(num).padStart(2, '0')} / {String(total).padStart(2, '0')}
            </span>
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
          {/* AI 뱃지 — 머리 줄의 '02 / 02' 바로 아래, 그림 칸 왼쪽 위(머리 줄과 같은 왼쪽 여백).
              그림이 넘어가도 자리를 지키게 트랙 밖에 둔다 */}
          {w.ai_used && <AiBadge place="absolute left-5 top-3 z-20" />}
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
                /* 시트가 덮는 만큼 아래를 비워 둔다 — 그래야 실제로 보이는
                   영역의 한가운데에 그림이 놓인다. 긴 그림(tall)은 위에서부터
                   채우므로 영향이 없고, 가로로 긴 그림에서 차이가 난다. */
                <div
                  key={off}
                  style={sheetH ? { paddingBottom: sheetH } : undefined}
                  className="relative h-full w-1/3 shrink-0"
                >
                  {item && (
                    <ZoomImage
                      /* 가운데 칸만 조작을 받는다 — 양옆은 미리 깔아 둔 그림이다.
                       src 가 바뀌면 배율·스크롤은 ZoomImage 안에서 되돌린다. */
                      src={item.image_url}
                      pages={item.pages}
                      /* 영상은 가운데 칸에만 건다 — 양옆까지 걸면 보이지도 않는
                         유튜브 플레이어가 셋 떠서 느려진다 */
                      videoId={off === 0 ? item.video_id : null}
                      alt={item.title ?? ''}
                      active={off === 0}
                      onSwipe={
                        off === 0 && works.length > 1
                          ? (dir) => (dir === 'left' ? next() : prev())
                          : undefined
                      }
                      onDrag={off === 0 && works.length > 1 ? dragTo : undefined}
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
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {edge && (
          <p
            role="status"
            className="pointer-events-none absolute left-1/2 top-16 z-30 -translate-x-1/2 whitespace-nowrap rounded-full bg-neutral-900/85 px-4 py-2 text-sm font-medium text-white shadow-lg"
          >
            {edge}
          </p>
        )}

        {/* 넘길 곳이 없는 쪽은 화살표를 감춘다(한 장뿐이거나, 돌지 않는 끝).
            화살표는 데스크톱에만 — 모바일은 옆으로 쓸어 넘긴다. */}
        {hasPrev && (
          <button
            onClick={prev}
            aria-label="이전"
            className="absolute left-3 top-1/2 hidden size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 shadow-md transition hover:bg-white md:flex"
          >
            ←
          </button>
        )}
        {hasNext && (
          <button
            onClick={next}
            aria-label="다음"
            className="absolute right-3 top-1/2 hidden size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 shadow-md transition hover:bg-white md:flex"
          >
            →
          </button>
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
              ref={sheetRef}
              /* 끄는 동안에는 손을 그대로 따라가야 하므로 전환을 끈다 */
              style={
                sheetDrag
                  ? {
                      transform: hideSheet
                        ? `translateY(calc(100% + ${sheetDrag}px))`
                        : `translateY(${sheetDrag}px)`,
                    }
                  : undefined
              }
              className={`absolute inset-x-0 bottom-0 z-20 border-t border-neutral-200 bg-white/95 px-5 pb-5 pt-3 backdrop-blur-md ease-out md:relative md:translate-y-0 md:bg-white md:px-8 md:pt-5 ${
                sheetDrag ? '' : 'transition-transform duration-300'
              } ${hideSheet ? 'translate-y-full' : 'translate-y-0'}`}
            >
              {/* 손잡이 — 잡아 내려도, 그냥 눌러도 시트가 내려간다.
                  모양이 끌 수 있게 생겼으니 실제로 끌려야 한다. */}
              <button
                onClick={() => setHideSheet(true)}
                onPointerDown={startHandleDrag}
                aria-label="설명 숨기기"
                className="mx-auto mb-3 flex h-5 w-16 touch-none items-center justify-center md:hidden"
              >
                <span className="block h-1 w-9 rounded-full bg-neutral-300 transition hover:bg-neutral-400" />
              </button>

              <SheetHead
                meta={meta}
                title={w.title}
                toggle={
                  w.description && canExpand
                    ? { open, onToggle: () => setOpen((v) => !v) }
                    : undefined
                }
              />

              {w.description && (
                <Excerpt
                  text={w.description}
                  open={open}
                  onToggle={() => setOpen((v) => !v)}
                  onOverflowChange={setCanExpand}
                />
              )}

            </div>

            {/* 숨겨 둔 동안 바닥에 남겨 두는 손잡이 — 그림을 톡 쳐도 되지만,
                되돌릴 수 있다는 것 자체가 보이지 않으면 사라진 줄 안다.
                눌러도, 잡아 끌어올려도 시트가 올라온다. 손가락으로 잡기 쉽게
                닿는 칸은 막대보다 넉넉히 둔다. */}
            <button
              onClick={() => setHideSheet(false)}
              onPointerDown={hideSheet ? startHandleDrag : undefined}
              aria-label="설명 보기"
              aria-hidden={!hideSheet}
              tabIndex={hideSheet ? 0 : -1}
              /* 바닥 전체를 덮으면 그 띠에서 옆으로 쓸어 넘기기가 막힌다 — 가운데만 */
              className={`absolute bottom-0 left-1/2 z-10 flex h-14 w-40 -translate-x-1/2 touch-none items-end justify-center pb-2 transition-opacity duration-300 md:hidden ${
                hideSheet ? '' : 'pointer-events-none'
              } ${hideSheet && !sheetDrag ? 'opacity-100' : 'opacity-0'}`}
            >
              <span className="h-1 w-9 rounded-full bg-white/70 shadow-[0_0_8px_rgba(0,0,0,0.35)]" />
            </button>
          </>
        )}
      </div>
    </div>
  )
}

/* 표기 줄 — 클라이언트 이름만. AI 활용·SOOM 의뢰는 설명 위에서 뺐다 */
function metaOf(w: PublicWork): string {
  return w.client ?? ''
}

/* 시트 머리 — 표기 줄과 제목, 그리고 설명을 여닫는 화살표 */
function SheetHead({
  meta,
  title,
  toggle,
}: {
  meta: string
  title: string | null
  /* 펼칠 거리가 있는 설명이 있을 때만 넘어온다 */
  toggle?: { open: boolean; onToggle: () => void }
}) {
  return (
    <>
      {meta && <p className="text-[11px] tracking-widest text-neutral-500">{meta}</p>}
      <div className="mt-1 flex items-start gap-3">
        {title && (
          <h3 className="min-w-0 flex-1 text-xl font-semibold tracking-tight md:text-2xl">
            {title}
          </h3>
        )}
        {/* 여닫는 표시 — 제목 줄 오른쪽에 둔다.
            설명 위에 겹쳐 두면 글자를 가리고, 설명 아래에 두면 글이 짧을 때와
            길 때 시트 높이가 달라져 넘길 때마다 제목이 튄다. */}
        {toggle && (
          <button
            type="button"
            onClick={toggle.onToggle}
            aria-label={toggle.open ? '설명 접기' : '설명 더 보기'}
            aria-expanded={toggle.open}
            className="-mr-1 mt-1 shrink-0 p-1 text-neutral-400 transition hover:text-neutral-900"
          >
            <Chevron up={toggle.open} />
          </button>
        )}
      </div>
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
   모바일에서는 버튼 없이 두 손가락으로 집어 키운다.

   집어 키우기는 브라우저에 맡기지 않고 직접 한다. 브라우저 핀치는 페이지
   전체를 키우는 것이라 배율을 알 수도 되돌릴 수도 없다 — 다음 작업으로
   넘겨도 확대된 채 남고, 둘러보는 끝이 어디인지도 알 수 없다.

   처음에는 잘리지도 늘어나지도 않게 칸에 맞춘다 — 세로로 긴 그림은
   높이에 맞춰 좌우에 흰 여백이 남는다. 글자가 작아 안 보이면 키워서
   스크롤로 내려 본다.

   크기는 CSS 로 맡기지 않고 직접 잰다 — 칸에 맞춘 크기(fit)에 배율을
   곱한 픽셀 값을 줘야 키웠을 때 칸을 넘쳐 스크롤이 생긴다. */
function ZoomImage({
  src,
  pages,
  videoId,
  alt,
  active,
  onSwipe,
  onDrag,
  onScrollDown,
  onTap,
}: {
  src: string
  /* PDF 작업의 둘째 장부터 — 첫 장(src) 아래로 이어 붙여 한 장처럼 키우고 내려 본다 */
  pages?: WorkPage[] | null
  /* 맨 끝에 붙은 유튜브 영상(0019_work_video.sql) — 그림 아래로 이어 붙인다 */
  videoId?: string | null
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
  /* 그림 전체(PDF 면 이어 붙인 모든 장) — 확대할 때 붙잡을 자리를 이 상자로 잰다 */
  const wrapRef = useRef<HTMLDivElement>(null)
  const [boxSize, setBoxSize] = useState<{ w: number; h: number } | null>(null)
  const [first, setFirst] = useState<{ w: number; h: number } | null>(null)
  /* 맞춤·배율 계산은 이어 붙인 전체를 한 장으로 본다 — 둘째 장부터는 첫 장
     너비에 맞춰 늘이거나 줄인 높이로 더한다 */
  /* 영상의 가로세로 비 — 세로 영상(쇼츠)이면 1 보다 작다. 알아내기 전에는
     16:9 로 둔다(youtube.ts). 비율을 모른 채 자리를 비워 두면 영상이 뜨는
     순간 아래 내용이 밀린다. */
  const [videoRatio, setVideoRatio] = useState(DEFAULT_RATIO)
  /* 다른 영상으로 바뀌면 비율을 되돌린다 — 남겨 두면 앞 영상의 비율로 한 번
     그린 뒤 고쳐진다. 아래 seenSrc 와 같은 "렌더 중 상태 조정" 패턴이다. */
  const [seenVideo, setSeenVideo] = useState(videoId)
  if (seenVideo !== videoId) {
    setSeenVideo(videoId)
    setVideoRatio(DEFAULT_RATIO)
  }
  useEffect(() => {
    if (!videoId) return
    let alive = true
    const probe = new Image()
    probe.onload = () => {
      if (alive && probe.naturalWidth > 0 && probe.naturalHeight > 0) {
        setVideoRatio(probe.naturalWidth / probe.naturalHeight)
      }
    }
    /* 못 받아도 그냥 16:9 로 둔다 — 영상 자체는 뜬다 */
    probe.src = youtubeRatioProbe(videoId)
    return () => {
      alive = false
    }
  }, [videoId])

  /* 그림만 이어 붙인 크기 — 영상을 더하기 전. 맞춤 배율(fit)을 이것으로
     잡아야 영상 칸 계산과 서로 물고 돌지 않는다. */
  const imagesOnly = useMemo(
    () =>
      first && {
        w: first.w,
        h: first.h + (pages ?? []).reduce((sum, p) => sum + (p.height * first.w) / p.width, 0),
      },
    [first, pages],
  )
  /* 배율 — 1(칸에 맞춤)부터 ZOOMS 끝까지. 버튼은 ZOOMS 단계로 뛰고,
     집어 키우기는 그 사이 아무 값이나 된다. */
  const [zoom, setZoom] = useState(1)
  const [flash, setFlash] = useState(false)
  const flashTimer = useRef<number | undefined>(undefined)
  /* 배율을 바꾸는 동안 붙잡아 둘 자리.
     fx·fy — 그림의 어디인지(0~1), px·py — 그 자리가 칸 안 어디에 보여야 하는지(px).
     버튼은 칸 가운데를, 집기는 두 손가락 사이를 붙잡는다 — 키울 때 왼쪽 위로
     튀지 않고 손가락 밑 그림이 그대로 손가락 밑에 남는다. */
  const focus = useRef<{ fx: number; fy: number; px: number; py: number } | null>(null)
  /* 집기 — 시작할 때 두 손가락 거리와 배율. 작업이 바뀌면 비운다(아래 [src] effect). */
  const pinch = useRef<{ d0: number; z0: number } | null>(null)

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

  const MAX_ZOOM = ZOOMS[ZOOMS.length - 1]

  /* 길쭉한 그림은 너비에 맞춰 잘리게 두고, 나머지는 칸 안에 통째로 넣는다.
     영상은 빼고 그림만으로 잰다 — 영상 칸 크기가 fit 에서 나오므로,
     fit 이 영상까지 보고 정해지면 둘이 서로 물고 돈다. */
  const tall = imagesOnly ? imagesOnly.h / imagesOnly.w > TALL_RATIO : false
  const fit =
    boxSize && imagesOnly
      ? tall
        ? boxSize.w / imagesOnly.w
        : Math.min(boxSize.w / imagesOnly.w, boxSize.h / imagesOnly.h)
      : null

  /* 영상 칸 — 그림과 같은 너비에 영상의 제 비율로 높이를 준다.

     세로 영상(쇼츠)은 그대로 두면 칸보다 길어져 한 화면에 안 들어온다.
     그래서 화면에 그려질 높이가 칸 높이를 넘지 않는 선까지 너비를 줄인다 —
     세로 영상도 통째로 보이고, 가로 영상은 지금까지와 똑같다. 그림과 달리
     영상은 스크롤해 가며 뜯어보는 것이 아니라 재생하는 것이다.

     단위를 맞춘다 — 여기 w·h 는 그림과 같은 "원래 크기" 단위이고,
     칸 높이(boxSize.h)는 화면 픽셀이라 fit 으로 나눠 맞춘다. 폭이 좁은
     화면에서는 fit 이 너비에 맞춰 정해지므로, 높이 제한을 거치지 않으면
     세로 영상이 칸보다 길어진다(폰에서 630px vs 칸 566px). */
  const videoBox = useMemo(() => {
    if (!imagesOnly || !videoId) return null
    const maxH = boxSize && fit ? boxSize.h / fit : Infinity
    /* 높이부터 맞추고, 그래도 그림보다 넓으면 그림 너비로 줄인다 */
    const h = Math.min(imagesOnly.w / videoRatio, maxH)
    const w = h * videoRatio
    return { w, h }
  }, [imagesOnly, videoId, boxSize, fit, videoRatio])

  /* 영상 칸까지 더한 전체 — 스크롤이 닿을 범위다. 빼면 영상 앞에서 멈춘다 */
  const natural = useMemo(
    () => imagesOnly && { w: imagesOnly.w, h: imagesOnly.h + (videoBox?.h ?? 0) },
    [imagesOnly, videoBox],
  )

  /* 붙잡아 둔 자리를 새 배율에서 같은 곳에 오도록 스크롤을 맞춘다.
     그림이 칸보다 작은 쪽은 가운데에 놓이므로(길쭉한 그림의 세로는 위에서
     시작) 그만큼의 여백을 더해 계산한다. */
  useLayoutEffect(() => {
    const box = boxRef.current
    const f = focus.current
    if (!box || !f || !fit || !natural) return
    focus.current = null
    const w = natural.w * fit * zoom
    const h = natural.h * fit * zoom
    const offX = Math.max(0, (box.clientWidth - w) / 2)
    const offY = tall ? 0 : Math.max(0, (box.clientHeight - h) / 2)
    box.scrollLeft = offX + f.fx * w - f.px
    box.scrollTop = offY + f.fy * h - f.py
  }, [zoom, fit, natural, tall])

  /* 화면 좌표(clientX/Y)의 한 점을 붙잡는다 — 그 점 밑의 그림 자리를 잰다 */
  const anchorAt = (cx: number, cy: number) => {
    const box = boxRef.current
    const wrap = wrapRef.current
    if (!box || !wrap) return
    const b = box.getBoundingClientRect()
    const r = wrap.getBoundingClientRect()
    focus.current = {
      fx: (cx - r.left) / r.width,
      fy: (cy - r.top) / r.height,
      px: cx - b.left,
      py: cy - b.top,
    }
  }

  /* 다른 작업으로 바뀌면 처음 상태로 — 예전에는 key 로 통째로 새로 그려
     저절로 됐지만, 이제 같은 요소가 src 만 바꿔 달기 때문에 직접 되돌린다.
     배율·스크롤이 남아 있으면 다음 그림이 확대된 채 중간부터 보인다.

     effect 가 아니라 렌더 중에 되돌린다 — effect 로 미루면 옛 배율로 한 번
     그린 뒤 고쳐지는 게 보인다(React 의 "렌더 중 상태 조정" 패턴). */
  const [seenSrc, setSeenSrc] = useState(src)
  if (seenSrc !== src) {
    setSeenSrc(src)
    setZoom(1)
    setFlash(false)
    /* first 는 비우지 않는다 — 비우면 fit 이 null 이 되어 그 한 프레임
       동안 <img> 에 크기가 안 붙고 원본 크기(1600px 등)로 그려진다.
       그게 넘긴 직후 화면이 번쩍이는 원인이었다. 새 치수는 아래
       useLayoutEffect 가 즉시(캐시된 그림) 또는 onLoad 가 채운다. */
  }

  /* ref 와 스크롤 위치는 렌더 중에 건드릴 수 없다 — 그려지기 직전에 되돌린다.
     이미 받아 둔 그림이면 여기서 바로 치수를 읽어 둔다. onLoad 는 캐시된
     이미지에서 늦게 오거나 아예 오지 않을 수 있다. */
  useLayoutEffect(() => {
    focus.current = null
    pinch.current = null
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
      setFirst({ w: img.naturalWidth, h: img.naturalHeight })
    }
  }, [src])

  /* 배율은 늘 띄워 두지 않고, 바꿀 때만 잠깐 보였다가 사라진다 */
  const showFlash = () => {
    setFlash(true)
    window.clearTimeout(flashTimer.current)
    flashTimer.current = window.setTimeout(() => setFlash(false), 900)
  }

  /* 버튼·키 — 지금 배율에서 다음(이전) 단계로. 집어서 2.3배 같은 사이 값에
     있어도 다음 단계(3배)로 간다. 칸 가운데를 붙잡는다. */
  const stepZoom = (dir: 1 | -1) => {
    const box = boxRef.current
    if (!box) return
    const next =
      dir > 0 ? ZOOMS.find((z) => z > zoom + 0.01) : [...ZOOMS].reverse().find((z) => z < zoom - 0.01)
    if (next == null) return
    const b = box.getBoundingClientRect()
    anchorAt(b.left + b.width / 2, b.top + b.height / 2)
    setZoom(next)
    showFlash()
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
  const pannable = zoom > 1

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
      if (e.key === '+' || e.key === '=') stepZoom(1)
      if (e.key === '-' || e.key === '_') stepZoom(-1)
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  })

  /* 옆으로 쓸어 다음·이전 작업으로 — 모바일에서 화살표 버튼을 대신한다.

     브라우저 기본 동작(세로 스크롤·핀치 줌)을 막지 않으려고 touch 이벤트를
     수동으로 듣고 preventDefault 는 하지 않는다.

     확대해서 그림이 칸보다 넓을 때는 먼저 그림 안을 둘러본다(브라우저 스크롤).
     그쪽 끝에 닿은 뒤에도 같은 손으로 계속 밀면, 그때부터 민 만큼(over)이
     트랙으로 넘어가 다음 장이 따라 들어온다 — 사진 앱들과 같다.
     확대 중에는 저항을 더 세게 걸어, 끝에 닿아 살짝 더 민 정도로는
     튕겨 돌아오고 분명히 더 밀어야 넘어간다.

     넘기지 않는 경우:
       · 두 손가락 이상 — 집어서 키우는 중이다
       · 세로로 더 많이 움직임 — 설명을 읽으려 위아래로 쓴 것이다
       · 끝을 넘어 민 거리가 문턱보다 짧고 빠르게 튕기지도 않음 */
  const touch = useRef<{
    x: number
    y: number
    /* 탭인지 가리는 데 쓴다 — 짧게 눌렀다 뗀 것만 탭이다 */
    at: number
    moved: boolean
    multi: boolean
    /* 처음 크게 움직인 쪽으로 제스처 방향을 굳힌다 — 가로(h) / 세로(v) */
    lock: 'h' | 'v' | null
    /* 직전 손가락 위치와 시각 — 끝에 닿은 순간을 잡고, 튕긴 속도를 잰다 */
    lastX: number
    lastT: number
    vx: number
    /* 끝에 닿은 순간의 손가락 x — 여기서부터 민 거리가 트랙으로 간다.
       아직 끝에 닿지 않았으면 null */
    edgeX: number | null
    /* 이 쓸기가 확대된(가로로 둘러볼 수 있는) 상태에서 시작했는지 */
    wide: boolean
  } | null>(null)

  /* 끝을 넘어 민 거리의 문턱(px)과 트랙이 손을 따라오는 비율.
     확대 중에는 둘러보다 끝에 닿아 살짝 더 민 것을 넘기기로 오해하지 않도록
     문턱을 높이고 더 뻑뻑하게 한다. */
  const SWIPE_MIN = 50
  const SWIPE_MIN_ZOOMED = 80
  const FOLLOW = 0.55
  const FOLLOW_ZOOMED = 0.35
  /* 문턱에 못 미쳐도 이만큼 빠르게(px/ms) 튕겼으면 넘긴다 — 단, 최소 이 거리는 밀어야 */
  const FLICK_V = 0.6
  const FLICK_MIN = 24
  /* 탭으로 치는 한계 — 이보다 길게 누르거나 많이 움직이면 탭이 아니다 */
  const TAP_MS = 400
  const TAP_SLOP = 10

  const distance = (a: React.Touch, b: React.Touch) =>
    Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)

  const onTouchStart = (e: React.TouchEvent) => {
    /* 두 번째 손가락이 닿으면 집기로 바꾼다 — 그 제스처는 넘기지 않는다 */
    if (e.touches.length === 2) {
      if (touch.current) touch.current.multi = true
      onDrag?.(0)
      const [a, b] = [e.touches[0], e.touches[1]]
      pinch.current = { d0: distance(a, b), z0: zoom }
      return
    }
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
      lock: null,
      lastX: t.clientX,
      lastT: e.timeStamp,
      vx: 0,
      /* 둘러볼 게 없으면 처음부터 끝에 있는 셈이다 */
      edgeX: wide ? null : t.clientX,
      wide,
    }
  }

  const onTouchMove = (e: React.TouchEvent) => {
    /* 집는 중 — 두 손가락 사이를 붙잡고 거리 비율만큼 키운다 */
    const p = pinch.current
    if (p && e.touches.length >= 2) {
      const [a, b] = [e.touches[0], e.touches[1]]
      const z = Math.min(MAX_ZOOM, Math.max(1, (p.z0 * distance(a, b)) / p.d0))
      anchorAt((a.clientX + b.clientX) / 2, (a.clientY + b.clientY) / 2)
      setZoom(z)
      showFlash()
      return
    }

    const s = touch.current
    if (!s || s.multi) return
    const t = e.touches[0]
    const dx = t.clientX - s.x
    const dy = t.clientY - s.y

    /* 조금이라도 움직였으면 탭이 아니다 */
    if (Math.abs(dx) > TAP_SLOP || Math.abs(dy) > TAP_SLOP) {
      s.moved = true
      s.lock ??= Math.abs(dx) > Math.abs(dy) ? 'h' : 'v'
    }

    /* 손가락 속도 — 놓는 순간 튕겼는지 본다 */
    const dt = e.timeStamp - s.lastT
    if (dt > 0) s.vx = (t.clientX - s.lastX) / dt
    const prevX = s.lastX
    s.lastX = t.clientX
    s.lastT = e.timeStamp

    if (!onDrag || s.lock !== 'h') return

    const box = boxRef.current
    const max = box ? box.scrollWidth - box.clientWidth : 0
    /* 왼쪽으로 밀면(다음 장) 오른쪽 끝, 오른쪽으로 밀면 왼쪽 끝에 닿아 있어야 한다 */
    const atLeft = !box || box.scrollLeft <= 1
    const atRight = !box || box.scrollLeft >= max - 1

    if (s.edgeX == null) {
      /* 둘러보다 이번 움직임에 그쪽 끝에 닿았으면 여기서부터 센다 */
      if ((t.clientX < prevX && atRight) || (t.clientX > prevX && atLeft)) s.edgeX = prevX
      else return
    }

    const over = t.clientX - s.edgeX
    /* 되돌아와 끝에서 떨어졌으면 다시 그림을 둘러보는 중이다 */
    if (s.wide && ((over < 0 && !atRight) || (over > 0 && !atLeft))) {
      s.edgeX = null
      onDrag(0)
      return
    }
    onDrag(over * (s.wide ? FOLLOW_ZOOMED : FOLLOW))
  }

  const onTouchEnd = (e: React.TouchEvent) => {
    /* 집기에서 손가락이 하나라도 떨어지면 집기는 끝이다. 거의 1배로
       돌아왔으면 1배에 맞춘다 — 1.02배처럼 어정쩡하게 남지 않게. */
    if (pinch.current && e.touches.length < 2) {
      pinch.current = null
      if (zoom < 1.05) setZoom(1)
    }

    const s = touch.current
    if (e.touches.length > 0) return
    touch.current = null
    onDrag?.(0)
    if (!s || s.multi) return

    /* 짧게 톡 친 것 — 설명 칸을 숨기거나 되돌린다.
       스크롤이 없는 짧은 그림에서는 이것이 설명 칸을 치우는 유일한 길이다. */
    if (!s.moved && Date.now() - s.at < TAP_MS) {
      onTap?.()
      return
    }

    if (!onSwipe || s.lock !== 'h' || s.edgeX == null) return

    const over = e.changedTouches[0].clientX - s.edgeX
    const min = s.wide ? SWIPE_MIN_ZOOMED : SWIPE_MIN
    /* 같은 방향으로 빠르게 튕겼는지 */
    const flick = Math.abs(over) >= FLICK_MIN && Math.abs(s.vx) > FLICK_V && s.vx * over > 0
    if (Math.abs(over) < min && !flick) return

    /* 왼쪽으로 쓸면 다음 장 — 종이를 넘기는 방향과 같다.
       넘어가면 다음 장은 처음 배율(1배)로 열린다(위 seenSrc). */
    onSwipe(over < 0 ? 'left' : 'right')
  }

  /* 두 손가락 움직임이 브라우저의 스크롤·확대로 새지 않게 막는다.
     React 의 터치 핸들러는 passive 라 preventDefault 가 듣지 않아 직접 단다.
     iOS 사파리는 touch-action 과 별개로 gesture* 이벤트로 페이지를 키운다. */
  useEffect(() => {
    const box = boxRef.current
    if (!box) return
    const stopMulti = (e: TouchEvent) => {
      if (e.touches.length > 1 && e.cancelable) e.preventDefault()
    }
    const stopGesture = (e: Event) => e.preventDefault()
    box.addEventListener('touchmove', stopMulti, { passive: false })
    box.addEventListener('gesturestart', stopGesture)
    return () => {
      box.removeEventListener('touchmove', stopMulti)
      box.removeEventListener('gesturestart', stopGesture)
    }
  }, [])

  return (
    <div className="relative h-full w-full bg-white">
      {/* 세로 스크롤(pan-y)은 브라우저에 맡기고, 집어 키우기는 직접 한다.
          확대돼 가로로 둘러볼 수 있을 때만 pan-x 를 열어
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
        /* 집기는 위 onTouch* 가 맡으므로 브라우저 핀치(pinch-zoom)는 열지 않는다.
           끝에서 더 밀 때 튕기는 효과는 트랙이 대신하므로 스크롤 바운스는 끈다. */
        style={{
          touchAction: pannable ? 'pan-x pan-y' : 'pan-y',
          overscrollBehavior: 'none',
        }}
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
          <div ref={wrapRef} className={fit ? '' : 'contents'}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imgRef}
              src={src}
              alt={alt}
              /* 브라우저 기본 이미지 끌기(유령 이미지)가 끌어 옮기기를 가로챈다 */
              draggable={false}
              onLoad={(e) =>
                setFirst({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })
              }
              /* 크기를 재기 전(이미지·칸이 아직 안 잡혔을 때)에는 CSS 로 칸에 맞춰 둔다 */
              style={
                fit && first
                  ? { width: first.w * fit * zoom, height: first.h * fit * zoom, maxWidth: 'none' }
                  : undefined
              }
              className={fit ? 'block' : 'max-h-full max-w-full object-contain'}
            />
            {/* 둘째 장부터 — 첫 장과 같은 너비로 잇는다. 크기를 미리 알고 있어
                받아지기 전에도 자리를 잡으므로 내려 보는 동안 화면이 밀리지 않는다.
                첫 장의 크기를 재기 전에는 그리지 않는다. */}
            {fit &&
              first &&
              pages?.map((p) => (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  key={p.url}
                  src={p.url}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  draggable={false}
                  style={{
                    width: first.w * fit * zoom,
                    height: (p.height * first.w * fit * zoom) / p.width,
                    maxWidth: 'none',
                  }}
                  className="block bg-neutral-50"
                />
              ))}
            {/* 맨 끝 영상 — 영상의 제 비율대로 잇는다(videoBox).
                세로 영상은 한 화면에 들어오도록 너비를 줄여 맞추므로
                그림보다 좁게 나올 수 있다 — 가운데로 놓는다.

                키운 상태(zoom > 1)에서는 플레이어를 걷고 자리만 남긴다.
                iframe 은 그 안에서 포인터를 먹어 끌어 옮기기가 멈추고,
                반대로 영상을 누르려다 스와이프로 작업이 넘어가기도 한다.
                확대는 PDF 글자를 읽으려고 쓰는 기능이라 영상에는 쓸 일이
                없으므로, 배율 1 에서만 재생할 수 있게 둔다. */}
            {fit && first && videoId && videoBox && (
              <div
                style={{
                  width: videoBox.w * fit * zoom,
                  height: videoBox.h * fit * zoom,
                }}
                className="relative mx-auto block bg-neutral-900"
              >
                {zoom === 1 ? (
                  <iframe
                    src={embedUrl(videoId)}
                    title={alt || '작업 영상'}
                    loading="lazy"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                    referrerPolicy="strict-origin-when-cross-origin"
                    allowFullScreen
                    className="absolute inset-0 size-full border-0"
                  />
                ) : (
                  <p className="absolute inset-0 grid place-items-center p-4 text-center text-xs text-white/70">
                    영상은 원래 크기에서 재생됩니다
                  </p>
                )}
              </div>
            )}
          </div>
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
          onClick={() => stepZoom(-1)}
          disabled={zoom <= 1}
          aria-label="축소"
          className="grid size-9 place-items-center rounded-full bg-neutral-900/50 text-lg leading-none text-white backdrop-blur-sm transition hover:bg-neutral-900/75 disabled:opacity-30"
        >
          −
        </button>
        <button
          onClick={() => stepZoom(1)}
          disabled={zoom >= MAX_ZOOM}
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
  onOverflowChange,
}: {
  text: string
  open: boolean
  onToggle: () => void
  /* 두 줄을 넘는 글인지 — 제목 줄의 화살표를 띄울지 부모가 정한다 */
  onOverflowChange?: (v: boolean) => void
}) {
  const [overflows, setOverflows] = useState(false)
  const [el, setEl] = useState<HTMLParagraphElement | null>(null)

  const flat = text.replace(/\s*\n+\s*/g, ' ').trim()

  useEffect(() => {
    if (!el) return
    /* 두 줄 높이를 넘는 글만 펼칠 거리가 있다.
       펼친 동안에는 잴 수 없으므로(이미 다 보인다) 그때는 건드리지 않는다. */
    const measure = () => {
      if (open) return
      const v = el.scrollHeight > el.clientHeight + 1
      setOverflows(v)
      onOverflowChange?.(v)
    }
    measure()
    /* 모달 폭이 바뀌면 줄 수도 바뀐다 */
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [el, flat, open, onOverflowChange])

  const body = (
    <div className="relative">
      <p
        ref={setEl}
        /* 접었을 때는 글이 한 줄이든 다섯 줄이든 늘 두 줄 자리를 차지한다
           (min-h = max-h = 2lh). 작업을 넘길 때마다 시트 높이가 달라지면
           제목이 위아래로 튀어 화면이 불안해 보인다. */
        className={`text-[15px] leading-relaxed text-neutral-600 transition-[max-height] duration-300 ease-out ${
          open
            ? 'max-h-[40vh] overflow-y-auto whitespace-pre-line'
            : 'max-h-[2lh] min-h-[2lh] overflow-hidden'
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

  /* 펼칠 것이 없으면 누를 수 없는 칸으로 둔다 — 자리는 그대로라
     넘겨도 제목 높이가 바뀌지 않는다. */
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
    </div>
  )
}
