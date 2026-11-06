'use client'

import { useCallback, useState } from 'react'
import type { PublicWork } from '@/lib/designer-shape'
import { cropOf } from '@/lib/crop'

/* 목록에 까는 작업 썸네일 — 상세 갤러리(work-gallery.tsx)와 홈 피드가 같이 쓴다.

   자리 비율은 썸네일 파일의 실제 가로세로를 따른다. 썸네일은 영역을 잘라
   만들었을 수도, 원본을 통째로 줄였을 수도, 디자이너가 따로 올린 이미지일
   수도 있다 — 원본 크기(width·height)로 칸을 잡으면 따로 올린 가로 썸네일이
   세로로 긴 원본 비율 칸에 들어가 양옆이 잘렸다.

   파일이 받아지기 전에는 짐작한 비율(영역 → 그 비율, 아니면 원본 비율)로
   자리를 잡아 두고, 받아지면 실제 비율로 바꾼다.

   영역을 잡지 않은 것은 1:1.8 보다 세로로 길면 거기서 끊고(위가 남는다)
   아래를 흰색으로 녹인다 — 잘린 게 아니라 "이어진다"로 읽히게. 영역을 잡은
   것은 의도해서 자른 구도라 끊지도 덮지도 않는다. */

/* 세로로 가장 길게 허용하는 비율 — 가로 1에 세로 1.8. 긴 페이지 스크린샷은
   이보다 훨씬 길어서, 그대로 두면 카드 하나가 열을 독차지하고 옆 열과 높이가
   크게 어긋난다. */
const MAX_TALL = 1 / 1.8

export function WorkThumb({
  work: w,
  rounded = 'rounded-lg',
  imgClassName = '',
  children,
}: {
  work: Pick<PublicWork, 'thumb_url' | 'title' | 'width' | 'height' | 'crop_x' | 'crop_y' | 'crop_w' | 'crop_h'>
  rounded?: string
  /* 호버 효과 등 — 그림에 붙인다 */
  imgClassName?: string
  /* 그림 위에 겹칠 것(제목 등) */
  children?: React.ReactNode
}) {
  const crop = cropOf(w)
  const guess =
    w.width && w.height
      ? crop
        ? (w.width * crop.w) / (w.height * crop.h)
        : w.width / w.height
      : MAX_TALL
  const [actual, setActual] = useState<number | null>(null)
  const [loaded, setLoaded] = useState(false)

  const ratio = actual ?? guess
  const clipped = !crop && ratio < MAX_TALL

  const measure = (img: HTMLImageElement) => {
    if (img.naturalWidth > 0 && img.naturalHeight > 0) setActual(img.naturalWidth / img.naturalHeight)
    setLoaded(true)
  }
  /* 캐시에 있던 그림은 onLoad 가 붙기 전에 끝나 오지 않는다 — 붙는 순간 확인한다 */
  const check = useCallback((img: HTMLImageElement | null) => {
    if (img?.complete) measure(img)
  }, [])

  return (
    <div
      className={`relative overflow-hidden bg-neutral-100 ${rounded}`}
      style={{ aspectRatio: `${clipped ? MAX_TALL : ratio}` }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={check}
        src={w.thumb_url}
        alt={w.title ?? ''}
        loading="lazy"
        onLoad={(e) => measure(e.currentTarget)}
        onError={() => setLoaded(true)}
        className={`size-full object-cover object-top transition-opacity duration-500 ${loaded ? 'opacity-100' : 'opacity-0'} ${imgClassName}`}
      />
      {clipped && (
        /* pointer-events-none — 이 덮개가 클릭을 가로채면 모달이 안 열린다 */
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-white"
        />
      )}
      {children}
    </div>
  )
}
