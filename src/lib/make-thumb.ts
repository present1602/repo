/* 올리기 전에 브라우저에서 썸네일을 만든다.

   canvas 는 이미 브라우저에 있어 의존성이 늘지 않고, 업로드 화면은
   이미 원본을 띄워 두고 있어 자를 재료가 손에 있다. 서버에서 자르면
   원본을 받아 다시 내보내느라 왕복이 한 번 더 생긴다.

   crop 영역이 있으면 그 부분만, 없으면 원본의 위쪽(가로의 두 배 높이까지)을 줄인다. */

import type { Crop } from './crop'
import { type StackPart, stackSize } from './work-stack'

/* 최대 길이. 목록 카드는 아무리 커도 한 변 600px 안쪽이고,
   고해상도 화면을 감안해 두 배로 잡는다. 세로는 그 두 배까지 —
   세로로 긴 썸네일도 가로가 이 값을 채우게(fitScale) */
export const THUMB_MAX = 1200

/* 영역을 잡지 않은 썸네일의 세로 한도 — 가로 1에 세로 2.
   목록은 1:1.8 까지만 보여주고 아래를 흰색으로 덮는다(work-thumb.tsx 의 MAX_TALL).
   긴 페이지 전체를 1200px 안에 넣으면 가로가 100~200px 로 쪼그라들어 흐려졌다 —
   보이는 위쪽만 잘라 가로 해상도를 살린다. 1.8 보다 조금 길게 남겨 덮개가 계속 걸리게 한다 */
const UNCROPPED_TALL = 2

/* 줄일 배율 — 가로는 THUMB_MAX, 세로는 그 두 배까지. 원본이 작으면 키우지 않는다 */
function fitScale(sw: number, sh: number) {
  return Math.min(1, THUMB_MAX / Math.max(sw, sh / 2))
}

/* WebP 품질 — 0.82 아래로는 평평한 면에 얼룩이 보이기 시작한다 */
const QUALITY = 0.82

export type Thumb = { file: File; width: number; height: number }

/* 원본 파일에서 썸네일 파일을 만든다.

   만들지 못하면 null 을 돌려준다 — 업로드 자체를 막지는 않는다.
   썸네일이 없으면 목록이 느려질 뿐이지만, 못 올리면 일이 멈춘다. */
export async function makeThumb(file: File, crop: Crop | null): Promise<Thumb | null> {
  try {
    const bitmap = await loadBitmap(file)
    if (!bitmap) return null

    /* 잘라낼 원본 좌표 — crop 은 0~1 비율이라 픽셀로 환산한다 */
    const sx = crop ? Math.round(crop.x * bitmap.width) : 0
    const sy = crop ? Math.round(crop.y * bitmap.height) : 0
    const sw = crop ? Math.round(crop.w * bitmap.width) : bitmap.width
    /* 영역이 없으면 위에서 가로의 두 배까지만(UNCROPPED_TALL) */
    const sh = crop
      ? Math.round(crop.h * bitmap.height)
      : Math.min(bitmap.height, Math.round(bitmap.width * UNCROPPED_TALL))

    if (sw < 1 || sh < 1) return null

    /* 원본이 이미 작으면 키우지 않는다 — 늘려 봐야 화질은 그대로이고 파일만 커진다 */
    const scale = fitScale(sw, sh)
    const dw = Math.max(1, Math.round(sw * scale))
    const dh = Math.max(1, Math.round(sh * scale))

    const canvas = document.createElement('canvas')
    canvas.width = dw
    canvas.height = dh

    const ctx = canvas.getContext('2d')
    if (!ctx) return null

    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, dw, dh)

    /* createImageBitmap 으로 만든 것은 다 쓰면 닫아 준다 */
    if ('close' in bitmap) bitmap.close()

    const blob = await toBlob(canvas)
    if (!blob) return null

    /* 확장자를 실제 타입에 맞춘다 — WebP 를 못 만들면 JPEG 로 돌아오는데,
       이름만 .webp 로 남으면 Storage 가 엉뚱한 타입으로 내보낸다. */
    const ext = blob.type === 'image/webp' ? 'webp' : 'jpg'

    return {
      file: new File([blob], `thumb.${ext}`, { type: blob.type }),
      width: dw,
      height: dh,
    }
  } catch {
    /* 캔버스가 막혀 있거나(보안 설정) 디코딩에 실패한 경우 —
       썸네일 없이 올리고 목록은 원본으로 버틴다 */
    return null
  }
}

/* 이미 올라간 원본에서 썸네일을 다시 만든다.

   나중에 영역을 고칠 때 쓴다 — 그때는 손에 File 이 없고 Storage 주소만
   있다. 받아온 Blob 을 File 로 감싸 같은 길로 보낸다.

   Storage 는 CORS 를 열어 두므로 canvas 가 더럽혀지지 않는다. 혹시
   막히면 toBlob 이 예외를 내고, makeThumb 이 null 로 받아 넘긴다. */
export async function makeThumbFromUrl(url: string, crop: Crop | null): Promise<Thumb | null> {
  try {
    const res = await fetch(url, { mode: 'cors', cache: 'reload' })
    if (!res.ok) return null
    const blob = await res.blob()
    return makeThumb(new File([blob], 'source', { type: blob.type }), crop)
  } catch {
    return null
  }
}

/* PDF 작업(장을 이어 붙인 긴 그림, work-stack.ts)에서 영역만큼 썸네일을 만든다.

   긴 그림 전체를 한 캔버스에 그리지 않는다 — 캔버스 면적 한도를 넘는다.
   영역에 걸친 장만 받아, 각 장에서 겹치는 띠만 잘라 썸네일 캔버스에
   위에서부터 차례로 붙인다. */
export async function makeStackThumb(parts: StackPart[], crop: Crop): Promise<Thumb | null> {
  try {
    const first = parts[0]
    const width = first.width
    const height = stackSize(first, parts.slice(1)).height

    /* 영역 — 이어 붙인 전체 좌표(첫 장 너비 기준 픽셀) */
    const sx = crop.x * width
    const sy = crop.y * height
    const sw = crop.w * width
    const sh = crop.h * height
    if (sw < 1 || sh < 1) return null

    const scale = fitScale(sw, sh)
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(sw * scale))
    canvas.height = Math.max(1, Math.round(sh * scale))
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.imageSmoothingQuality = 'high'

    let top = 0
    for (const p of parts) {
      /* 이 장이 전체에서 차지하는 세로 범위 */
      const h = (p.height * width) / p.width
      const from = Math.max(sy, top)
      const to = Math.min(sy + sh, top + h)
      if (to > from) {
        const bitmap = await loadPart(p.src)
        if (!bitmap) return null
        /* 이 장의 실제 픽셀 / 전체 좌표 픽셀 — 그림이 받아진 크기로 잰다 */
        const k = bitmap.width / width
        ctx.drawImage(
          bitmap,
          sx * k,
          (from - top) * k,
          sw * k,
          (to - from) * k,
          0,
          (from - sy) * scale,
          canvas.width,
          (to - from) * scale,
        )
        if ('close' in bitmap) bitmap.close()
      }
      top += h
      if (top >= sy + sh) break
    }

    const blob = await toBlob(canvas)
    if (!blob) return null
    const ext = blob.type === 'image/webp' ? 'webp' : 'jpg'
    return {
      file: new File([blob], `thumb.${ext}`, { type: blob.type }),
      width: canvas.width,
      height: canvas.height,
    }
  } catch {
    return null
  }
}

/* 장 하나를 그릴 수 있는 모양으로 — 올리기 전에는 파일, 올린 뒤에는 Storage 주소 */
async function loadPart(src: string | File): Promise<ImageBitmap | HTMLImageElement | null> {
  if (src instanceof File) return loadBitmap(src)
  const res = await fetch(src, { mode: 'cors', cache: 'reload' })
  if (!res.ok) return null
  const blob = await res.blob()
  return loadBitmap(new File([blob], 'page', { type: blob.type }))
}

/* 파일을 그릴 수 있는 모양으로 — 최신 브라우저는 createImageBitmap 이
   더 빠르고 메인 스레드를 덜 잡는다. 없으면 <img> 로 돌아간다. */
async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement | null> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file)
    } catch {
      /* 아래 <img> 경로로 넘어간다 */
    }
  }

  const url = URL.createObjectURL(file)
  try {
    return await new Promise<HTMLImageElement | null>((resolve) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => resolve(null)
      img.src = url
    })
  } finally {
    URL.revokeObjectURL(url)
  }
}

/* WebP 로 뽑는다. 지원하지 않는 브라우저는 JPEG 로 돌아간다 —
   toBlob 은 못 만들면 null 을 주거나 다른 타입을 주므로 확인한다. */
function toBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob(
      (b) => {
        if (b && b.type === 'image/webp') return resolve(b)
        canvas.toBlob((j) => resolve(j), 'image/jpeg', QUALITY)
      },
      'image/webp',
      QUALITY,
    )
  })
}
