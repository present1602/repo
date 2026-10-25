/* 올리기 전에 브라우저에서 썸네일을 만든다.

   canvas 는 이미 브라우저에 있어 의존성이 늘지 않고, 업로드 화면은
   이미 원본을 띄워 두고 있어 자를 재료가 손에 있다. 서버에서 자르면
   원본을 받아 다시 내보내느라 왕복이 한 번 더 생긴다.

   crop 영역이 있으면 그 부분만, 없으면 원본 전체를 줄인다. */

import type { Crop } from './crop'

/* 긴 변 기준 최대 길이. 목록 카드는 아무리 커도 한 변 600px 안쪽이고,
   고해상도 화면을 감안해 두 배로 잡는다. */
export const THUMB_MAX = 1200

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
    const sh = crop ? Math.round(crop.h * bitmap.height) : bitmap.height

    if (sw < 1 || sh < 1) return null

    /* 긴 변을 THUMB_MAX 로 맞춘다. 원본이 이미 작으면 키우지 않는다 —
       늘려 봐야 화질은 그대로이고 파일만 커진다. */
    const scale = Math.min(1, THUMB_MAX / Math.max(sw, sh))
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
