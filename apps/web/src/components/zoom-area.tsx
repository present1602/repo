'use client'

/* 작업 이미지를 키워 보는 칸 — 업로드 창·스튜디오 편집·어드민 편집의 왼쪽 칸.

   크고 긴 그림(긴 화면 캡처, PDF)은 칸에 맞추면 글자가 안 보여 영역을
   가늠할 수 없다. 칸 안(그림과 그 둘레 여백)에서 ⌘(Ctrl)+휠·트랙패드 핀치·
   두 손가락으로 키운다. 버튼은 두지 않는다. 키운 지점이 손 밑에 그대로 남는다.
   커지는 것은 그림뿐이다 — 칸·다이얼로그·오른쪽 입력 영역은 그대로이고
   칸이 스크롤된다.

   배율은 이 칸이 들고 있다. 보기와 썸네일 영역 잡기(CropEditor)가 이 안에서
   바뀌어도 배율·스크롤이 그대로 남는다 — 키워 둔 곳에서 바로 영역을 잡는다.
   그때 처음 영역은 지금 보이는 부분 안에 잡도록 visible() 로 알려 준다.

   안의 내용은 늘 칸이 정해 준 너비를 꽉 채워 그린다(w-full). */

import { useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react'
import type { Crop } from '@/lib/crop'

export type ZoomAreaHandle = {
  /* 키워 둔 상태인지 */
  zoomed: () => boolean
  /* 지금 칸에 보이는 부분 — 내용 전체에 대한 0~1 비율 */
  visible: () => Crop | null
}

/* 배율의 바닥 상한 — 원본이 작아도 여기까지는 키운다 */
const MIN_MAX_ZOOM = 6

export function ZoomArea({
  ratio,
  naturalWidth,
  fit,
  className,
  handle,
  children,
}: {
  /* 내용 전체의 가로/세로 — 모르면(아직 못 읽었으면) 칸 너비에 맞춘다 */
  ratio: number | null
  /* 내용의 실제 픽셀 너비 — 원본 해상도의 두 배까지 키울 수 있게 상한을 잡는다 */
  naturalWidth: number | null
  /* contain — 칸 안에 통째로(일반 이미지), width — 너비에 맞추고 세로로 내려 본다(PDF) */
  fit: 'contain' | 'width'
  /* 다이얼로그 안에서 이 칸이 차지할 자리(크기·늘어남) */
  className: string
  handle?: React.Ref<ZoomAreaHandle>
  children: React.ReactNode
}) {
  const paneRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  /* 배율 1 의 너비 — 칸 크기와 그림 비율로 정한다 */
  const [base, setBase] = useState<number | null>(null)
  const [zoom, setZoom] = useState(1)
  const zoomRef = useRef(1)
  /* 키울 때 붙잡을 자리 — 내용의 어디(fx·fy)가 화면 어디(cx·cy)에 있어야 하는지 */
  const anchor = useRef<{ fx: number; fy: number; cx: number; cy: number } | null>(null)

  useLayoutEffect(() => {
    const pane = paneRef.current
    if (!pane) return
    const measure = () => {
      const s = getComputedStyle(pane)
      const innerW = pane.clientWidth - parseFloat(s.paddingLeft) - parseFloat(s.paddingRight)
      if (fit === 'width' || !ratio) {
        setBase(Math.max(1, Math.min(innerW, 768)))
        return
      }
      /* 칸 높이는 내용에 따라 늘어나므로 기대지 않고 창 높이로 잡는다 —
         넓은 화면은 70%, 좁은 화면은 위아래로 쌓여 32% */
      const wide = window.matchMedia('(min-width: 768px)').matches
      const maxH = window.innerHeight * (wide ? 0.7 : 0.32)
      setBase(Math.max(1, Math.min(innerW, maxH * ratio)))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(pane)
    window.addEventListener('resize', measure)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [fit, ratio])

  const maxZoom = Math.max(MIN_MAX_ZOOM, base && naturalWidth ? (2 * naturalWidth) / base : 0)
  const maxRef = useRef(maxZoom)
  useEffect(() => {
    maxRef.current = maxZoom
  })

  const zoomTo = useCallback((z: number, cx: number, cy: number) => {
    const content = contentRef.current
    if (!content) return
    const next = Math.min(maxRef.current, Math.max(1, z))
    if (Math.abs(next - zoomRef.current) < 0.001) return
    const r = content.getBoundingClientRect()
    anchor.current = { fx: (cx - r.left) / r.width, fy: (cy - r.top) / r.height, cx, cy }
    zoomRef.current = next
    setZoom(next)
  }, [])

  /* 키운 뒤 붙잡은 자리가 손 밑에 오도록 칸의 스크롤을 맞춘다 */
  useLayoutEffect(() => {
    const pane = paneRef.current
    const content = contentRef.current
    const a = anchor.current
    if (!pane || !content || !a) return
    anchor.current = null
    const r = content.getBoundingClientRect()
    pane.scrollLeft += r.left + a.fx * r.width - a.cx
    pane.scrollTop += r.top + a.fy * r.height - a.cy
  }, [zoom])

  /* ⌘(Ctrl)+휠과 트랙패드 핀치(크롬·파이어폭스는 Ctrl+휠로 온다), 사파리
     제스처, 터치 두 손가락. 페이지가 통째로 커지지 않게 막아야 해서
     passive 가 아닌 리스너를 직접 단다. */
  useEffect(() => {
    const pane = paneRef.current
    if (!pane) return

    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      zoomTo(zoomRef.current * Math.exp(-e.deltaY * 0.01), e.clientX, e.clientY)
    }

    let g0 = 1
    const onGestureStart = (e: Event) => {
      e.preventDefault()
      g0 = zoomRef.current
    }
    const onGestureChange = (e: Event) => {
      e.preventDefault()
      const ge = e as Event & { scale: number; clientX: number; clientY: number }
      zoomTo(g0 * ge.scale, ge.clientX, ge.clientY)
    }

    let pinch: { d0: number; z0: number } | null = null
    const dist = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY)
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) pinch = { d0: dist(e.touches), z0: zoomRef.current }
    }
    const onTouchMove = (e: TouchEvent) => {
      if (!pinch || e.touches.length !== 2) return
      e.preventDefault()
      const [a, b] = [e.touches[0], e.touches[1]]
      zoomTo((pinch.z0 * dist(e.touches)) / pinch.d0, (a.clientX + b.clientX) / 2, (a.clientY + b.clientY) / 2)
    }
    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) pinch = null
    }

    pane.addEventListener('wheel', onWheel, { passive: false })
    pane.addEventListener('gesturestart', onGestureStart)
    pane.addEventListener('gesturechange', onGestureChange)
    pane.addEventListener('touchstart', onTouchStart, { passive: true })
    pane.addEventListener('touchmove', onTouchMove, { passive: false })
    pane.addEventListener('touchend', onTouchEnd)
    return () => {
      pane.removeEventListener('wheel', onWheel)
      pane.removeEventListener('gesturestart', onGestureStart)
      pane.removeEventListener('gesturechange', onGestureChange)
      pane.removeEventListener('touchstart', onTouchStart)
      pane.removeEventListener('touchmove', onTouchMove)
      pane.removeEventListener('touchend', onTouchEnd)
    }
  }, [zoomTo])

  useImperativeHandle(
    handle,
    () => ({
      zoomed: () => zoomRef.current > 1.01,
      visible: () => {
        const pane = paneRef.current
        const content = contentRef.current
        if (!pane || !content) return null
        const p = pane.getBoundingClientRect()
        const c = content.getBoundingClientRect()
        if (c.width === 0 || c.height === 0) return null
        const x0 = Math.max(p.left, c.left)
        const y0 = Math.max(p.top, c.top)
        const x1 = Math.min(p.right, c.right)
        const y1 = Math.min(p.bottom, c.bottom)
        if (x1 <= x0 || y1 <= y0) return null
        return {
          x: (x0 - c.left) / c.width,
          y: (y0 - c.top) / c.height,
          w: (x1 - x0) / c.width,
          h: (y1 - y0) / c.height,
        }
      },
    }),
    [],
  )

  return (
    /* min-w-0 — 키운 그림 폭이 이 칸의 최소 폭이 되어 다이얼로그의 오른쪽 입력
       영역을 밖으로 밀어내지 않게 한다. 넘치는 만큼은 안쪽 칸이 스크롤한다. */
    <div className={`relative flex min-h-0 min-w-0 ${className}`}>
      <div
        ref={paneRef}
        className={`flex min-h-0 w-full min-w-0 justify-center-safe overflow-auto bg-neutral-100 p-3 ${
          fit === 'width' ? 'items-start' : 'items-center-safe'
        }`}
      >
        <div
          ref={contentRef}
          className="relative shrink-0"
          style={base ? { width: base * zoom } : { width: '100%' }}
        >
          {children}
        </div>
      </div>
    </div>
  )
}

/* 보기용 그림 — 한 장이거나, PDF 면 장을 틈 없이 이어 붙인다.
   영역 잡기(CropEditor)와 같은 짜임이라 둘을 오가도 그림이 제자리에 있다. */
export function StackView({
  src,
  pages,
  alt = '',
}: {
  src: string
  pages?: { url: string; width: number; height: number }[] | null
  alt?: string
}) {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} draggable={false} className="block h-auto w-full bg-white" />
      {pages?.map((p) => (
        /* 크기를 미리 알고 있어 받아지기 전에도 자리를 잡는다 — 내려 보는 동안 밀리지 않는다 */
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          key={p.url}
          src={p.url}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
          style={{ aspectRatio: `${p.width} / ${p.height}` }}
          className="block h-auto w-full bg-white"
        />
      ))}
    </>
  )
}
