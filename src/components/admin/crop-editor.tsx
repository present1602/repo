'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { type Crop, clampCrop, minCrop } from '@/lib/crop'
import { StackView } from '@/components/zoom-area'

/* 썸네일 영역을 눈으로 잡는 편집기.

   이미지 위에 영역을 덮고, 바깥을 어둡게 깔아 무엇이 잘리는지 보여준다.
   핸들로 크기를, 안쪽을 끌어 위치를 바꾼다.

   좌표는 전부 0~1 비율로 다룬다 — 화면 크기에 기대면 창을 줄였을 때
   잡아 둔 영역이 함께 움직인다. 픽셀은 포인터 이동량을 환산할 때만 쓴다.

   그림 크기와 확대는 바깥 칸(ZoomArea)이 정한다 — 이 편집기는 받은 너비를
   꽉 채워 그리고 영역만 다룬다. 그래야 보기와 영역 잡기를 오가도 키워 둔
   배율·스크롤이 그대로 남는다.

   영역 바깥을 누르면 어두운 덮개만 걷고 onCommit 으로 알린다. 테두리·핸들은
   남아 있어 그대로 다시 끌 수 있고, 끌기 시작하면 덮개가 다시 깔린다.
   확정은 부르는 쪽이 한다(오른쪽 '저장').

   바깥으로 치지 않는 누름: data-crop-keep 이 붙은 요소('영역 지정'·'취소'·
   비율 버튼 — 누르면 그 버튼이 할 일을 한다)와 그림 칸 자체(스크롤바·여백 —
   아래 장으로 내려 보는 중에 핸들이 사라지면 곤란하다). */

/* 끌 수 있는 지점. 모서리 넷과 변 넷. */
const HANDLES = [
  { key: 'nw', x: 0, y: 0, corner: true, cursor: 'nwse-resize' },
  { key: 'n', x: 0.5, y: 0, corner: false, cursor: 'ns-resize' },
  { key: 'ne', x: 1, y: 0, corner: true, cursor: 'nesw-resize' },
  { key: 'e', x: 1, y: 0.5, corner: false, cursor: 'ew-resize' },
  { key: 'se', x: 1, y: 1, corner: true, cursor: 'nwse-resize' },
  { key: 's', x: 0.5, y: 1, corner: false, cursor: 'ns-resize' },
  { key: 'sw', x: 0, y: 1, corner: true, cursor: 'nesw-resize' },
  { key: 'w', x: 0, y: 0.5, corner: false, cursor: 'ew-resize' },
] as const

type HandleKey = (typeof HANDLES)[number]['key']

export function CropEditor({
  src,
  pages,
  crop,
  onChange,
  /* 비율이 고정돼 있으면 변 핸들을 잠그고 대각선만 남긴다 —
     변 핸들은 한 축만 움직여 비율을 지킬 수 없다. */
  lockedRatio,
  imgRatio,
  onCommit,
}: {
  src: string
  /* PDF 작업의 둘째 장부터 — 첫 장(src) 아래로 이어 붙여 한 장처럼 잡는다.
     좌표는 이어 붙인 전체에 대한 비율이 된다(work-stack.ts) */
  pages?: { url: string; width: number; height: number }[]
  crop: Crop
  onChange: (c: Crop) => void
  lockedRatio: number | null
  imgRatio: number
  /* 영역 바깥을 눌렀을 때 — 그때의 영역 */
  onCommit?: (c: Crop) => void
}) {
  const boxRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)

  /* 드래그 중인 동작. 포인터가 움직일 때마다 state 를 쓰면 리렌더가 끼어
     끊겨 보이므로, 시작 시점의 값만 ref 에 담아 두고 계산에 쓴다. */
  const drag = useRef<{
    mode: 'move' | HandleKey
    startX: number
    startY: number
    origin: Crop
  } | null>(null)

  /* 마칠 때 알릴 값 — 바깥 누름은 문서 전체에서 듣는다 */
  const cropRef = useRef(crop)
  const commitRef = useRef(onCommit)
  useEffect(() => {
    cropRef.current = crop
    commitRef.current = onCommit
  })

  /* ─── 덮개 — 끄는 중에만 깐다 ─── */
  const [active, setActive] = useState(true)
  useEffect(() => {
    if (!active) return
    const onDown = (e: PointerEvent) => {
      const t = e.target as HTMLElement
      if (frameRef.current?.contains(t)) return
      if (t.closest('[data-crop-keep]')) return
      if (t === boxRef.current?.closest('.overflow-auto')) return
      setActive(false)
      commitRef.current?.(cropRef.current)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [active])

  /* 두 손가락이 닿으면 끌기를 멈춘다 — 그 제스처는 바깥 칸의 집어 키우기다 */
  const fingers = useRef(0)
  useEffect(() => {
    const up = () => {
      fingers.current = Math.max(0, fingers.current - 1)
    }
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
  }, [])

  /* 0~1 공간에서의 비율 — 원본이 정사각형이 아니므로 환산해서 쓴다 */
  const r = lockedRatio == null ? null : lockedRatio / imgRatio

  const onPointerDown = useCallback(
    (e: React.PointerEvent, mode: 'move' | HandleKey) => {
      e.preventDefault()
      e.stopPropagation()
      if (e.pointerType === 'touch' && ++fingers.current > 1) {
        drag.current = null
        return
      }
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
      setActive(true)
      drag.current = { mode, startX: e.clientX, startY: e.clientY, origin: crop }
    },
    [crop],
  )

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const d = drag.current
      const box = boxRef.current
      if (!d || !box) return

      const rect = box.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) return

      /* 포인터가 움직인 픽셀을 0~1 비율로 환산한다 */
      const dx = (e.clientX - d.startX) / rect.width
      const dy = (e.clientY - d.startY) / rect.height

      if (d.mode === 'move') {
        onChange(clampCrop({ ...d.origin, x: d.origin.x + dx, y: d.origin.y + dy }, imgRatio))
        return
      }

      onChange(resize(d.origin, d.mode, dx, dy, r, imgRatio))
    }

    const onUp = () => {
      drag.current = null
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [onChange, r, imgRatio])

  const pct = (n: number) => `${n * 100}%`

  return (
    /* 이어 붙인 장(PDF) 사이에는 틈을 두지 않는다 — 틈이 있으면 화면과 좌표가 어긋난다 */
    <div ref={boxRef} className="relative w-full select-none touch-none">
      <StackView src={src} pages={pages} />

      {active && (
        <>
          {/* 바깥 어둡게 — 영역 네 변 바깥을 네 조각으로 덮는다.
              하나의 큰 요소에 구멍을 뚫는 방법(box-shadow)은 영역이 이미지
              가장자리에 붙었을 때 가장자리까지 덮여 어색해진다. */}
          <div className="pointer-events-none absolute inset-0">
            <Shade style={{ left: 0, top: 0, right: 0, height: pct(crop.y) }} />
            <Shade style={{ left: 0, top: pct(crop.y + crop.h), right: 0, bottom: 0 }} />
            <Shade
              style={{ left: 0, top: pct(crop.y), width: pct(crop.x), height: pct(crop.h) }}
            />
            <Shade
              style={{
                left: pct(crop.x + crop.w),
                top: pct(crop.y),
                right: 0,
                height: pct(crop.h),
              }}
            />
          </div>
        </>
      )}

      {/* 영역 — 안쪽을 끌면 이동한다 */}
      <div
        ref={frameRef}
        onPointerDown={(e) => onPointerDown(e, 'move')}
        className="absolute cursor-move outline outline-2 outline-white"
        style={{
          left: pct(crop.x),
          top: pct(crop.y),
          width: pct(crop.w),
          height: pct(crop.h),
        }}
      >
        {/* 삼등분선 — 구도를 잡는 기준 */}
        <div className="pointer-events-none absolute inset-0 opacity-40">
          <div className="absolute inset-y-0 left-1/3 w-px bg-white" />
          <div className="absolute inset-y-0 left-2/3 w-px bg-white" />
          <div className="absolute inset-x-0 top-1/3 h-px bg-white" />
          <div className="absolute inset-x-0 top-2/3 h-px bg-white" />
        </div>

        {HANDLES.map((h) => {
          /* 비율이 잠겨 있으면 변 핸들은 쓰지 않는다 — 한 축만 움직여
             비율을 지킬 수 없기 때문이다. 자리만 비우지 않고 흐리게 남겨
             "지금은 대각선으로만 조절한다"는 걸 보이게 한다. */
          const disabled = r != null && !h.corner
          return (
            <span
              key={h.key}
              onPointerDown={disabled ? undefined : (e) => onPointerDown(e, h.key)}
              style={{
                left: pct(h.x),
                top: pct(h.y),
                cursor: disabled ? 'default' : h.cursor,
              }}
              className={`absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-sm border border-neutral-900 ${
                disabled ? 'bg-white/30' : 'bg-white'
              }`}
            />
          )
        })}
      </div>
    </div>
  )
}

/* 잘린 썸네일 미리보기 — 영역 비율의 칸에 그림을 키워 넣고 영역만 보이게 민다.
   장을 이어 붙인 그림(PDF)도 같은 방식이다: 장마다 전체에서 차지하는 높이
   비율로 세로를 나눠 이어 쌓는다. 파일을 만들지 않으므로 바로 바뀐다. */
export function CropPreview({
  parts,
  crop,
  maxHeight = 220,
}: {
  parts: { src: string; width: number; height: number }[]
  crop: Crop
  maxHeight?: number
}) {
  const width = parts[0].width
  const heights = parts.map((p) => (p.height * width) / p.width)
  const total = heights.reduce((a, b) => a + b, 0)
  const ratio = (width * crop.w) / (total * crop.h)

  return (
    <div
      className="relative mx-auto overflow-hidden rounded-md bg-neutral-100 ring-1 ring-neutral-200"
      /* 칸 너비를 넘지 않고, 높이도 maxHeight 를 넘지 않는 가장 큰 크기 */
      style={{ aspectRatio: `${ratio}`, width: `min(100%, ${maxHeight * ratio}px)` }}
    >
      <div
        className="absolute"
        style={{
          width: `${100 / crop.w}%`,
          height: `${100 / crop.h}%`,
          left: `${(-crop.x * 100) / crop.w}%`,
          top: `${(-crop.y * 100) / crop.h}%`,
        }}
      >
        {parts.map((p, i) => (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            key={`${p.src}-${i}`}
            src={p.src}
            alt=""
            draggable={false}
            style={{ height: `${(heights[i] / total) * 100}%` }}
            className="block w-full max-w-none"
          />
        ))}
      </div>
    </div>
  )
}

function Shade({ style }: { style: React.CSSProperties }) {
  return <div className="absolute bg-neutral-950/55" style={style} />
}

/* 핸들을 끌었을 때의 새 영역.

   붙잡지 않은 쪽 모서리를 고정점으로 두고 반대쪽만 움직인다 —
   그래야 끄는 방향으로 자연스럽게 늘어난다.

   r 이 있으면(비율 고정) 더 많이 움직인 축을 기준으로 다른 축을 따라오게 한다.
   둘을 각각 포인터에 맞추면 비율이 깨진다. 가로만 보면 위아래로 끌 때
   꿈쩍도 하지 않는다 — 긴 PDF 에서는 위아래로 끄는 일이 대부분이다.

   최소 크기는 실제 픽셀로 같은 길이가 되게 축마다 따로 잡는다(minCrop). */
function resize(
  o: Crop,
  mode: HandleKey,
  dx: number,
  dy: number,
  r: number | null,
  imgRatio: number,
): Crop {
  const min = minCrop(imgRatio)
  /* 각 변이 움직이는지 — 'n' 은 위쪽 변만, 'se' 는 오른쪽·아래쪽 변이 움직인다 */
  const west = mode.includes('w')
  const east = mode.includes('e')
  const north = mode.includes('n')
  const south = mode.includes('s')

  let { x, y, w, h } = o

  if (r == null) {
    if (west) {
      const nx = Math.min(o.x + dx, o.x + o.w - min.w)
      w = o.x + o.w - nx
      x = nx
    }
    if (east) w = Math.max(min.w, o.w + dx)
    if (north) {
      const ny = Math.min(o.y + dy, o.y + o.h - min.h)
      h = o.y + o.h - ny
      y = ny
    }
    if (south) h = Math.max(min.h, o.h + dy)

    return clampCrop({ x, y, w, h }, imgRatio)
  }

  /* 비율 고정 — 대각선 핸들만 여기로 온다.
     화면에서 더 많이 움직인 축으로 크기를 정하고 다른 축은 비율에서 끌어온다.
     0~1 공간은 축마다 길이가 달라 dy 를 가로 픽셀 단위로 환산해 견준다. */
  const signX = east ? 1 : -1
  const signY = south ? 1 : -1
  w = Math.abs(dx) >= Math.abs(dy) / imgRatio ? o.w + dx * signX : (o.h + dy * signY) * r
  w = Math.max(min.w, min.h * r, w)
  h = w / r

  /* 높이가 이미지를 넘으면 높이를 기준으로 다시 맞춘다 */
  if (h > 1) {
    h = 1
    w = h * r
  }

  /* 붙잡지 않은 모서리를 제자리에 둔다 */
  x = west ? o.x + o.w - w : o.x
  y = north ? o.y + o.h - h : o.y

  /* 이미지 밖으로 나가면 들어오는 만큼만 키운다 — clampCrop 에 맡기면
     위치만 밀려서 비율이 유지된 채 엉뚱한 곳으로 간다. */
  if (x < 0) {
    w += x
    h = w / r
    x = 0
    if (north) y = o.y + o.h - h
  }
  if (y < 0) {
    h += y
    w = h * r
    y = 0
    if (west) x = o.x + o.w - w
  }
  if (x + w > 1) {
    w = 1 - x
    h = w / r
    if (north) y = o.y + o.h - h
  }
  if (y + h > 1) {
    h = 1 - y
    w = h * r
    if (west) x = o.x + o.w - w
  }

  return clampCrop({ x, y, w, h }, imgRatio)
}
