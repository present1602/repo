/* 버킷 한도(MAX_UPLOAD_BYTES)를 넘는 이미지를 브라우저에서 한도 아래로 줄인다.

   한도 안의 파일은 손대지 않고 그대로 돌려준다 — 다시 인코딩하면 화질만 잃는다.
   넘는 파일은 WebP 로 다시 인코딩하고, 그래도 크면 품질을, 그다음 크기를
   한 단계씩 낮춰 가며 맞춘다. 움직이는 GIF 는 첫 장만 남는다 —
   50MB 를 넘는 GIF 를 그대로 올릴 방법은 없다.

   캔버스 면적 한도(iOS 사파리 약 1,670만 픽셀)를 넘는 원본은 처음부터
   그 안으로 줄여 그린다 — 넘기면 캔버스가 비어 버린다. */

import { MAX_UPLOAD_BYTES } from './portfolio-limits'

const MAX_AREA = 16_000_000
const QUALITIES = [0.9, 0.8, 0.7]
/* 품질을 다 내려도 크면 이 비율씩 줄인다 */
const STEP = 0.8
const MAX_TRIES = 8

export async function shrinkImage(file: File, limit = MAX_UPLOAD_BYTES): Promise<File | null> {
  if (file.size <= limit) return file

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    return null
  }

  try {
    let scale = Math.min(1, Math.sqrt(MAX_AREA / (bitmap.width * bitmap.height)))
    for (let i = 0; i < MAX_TRIES; i++) {
      const w = Math.max(1, Math.round(bitmap.width * scale))
      const h = Math.max(1, Math.round(bitmap.height * scale))
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) return null
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(bitmap, 0, 0, w, h)

      for (const q of QUALITIES) {
        const blob = await encode(canvas, q)
        if (blob && blob.size <= limit) {
          const ext = blob.type === 'image/webp' ? 'webp' : 'jpg'
          const stem = file.name.replace(/\.[^.]+$/, '') || 'image'
          return new File([blob], `${stem}.${ext}`, { type: blob.type })
        }
      }
      canvas.width = 0
      canvas.height = 0
      scale *= STEP
    }
    return null
  } finally {
    bitmap.close()
  }
}

/* 프로필 이미지는 서버 액션 본문(1MB 한도)에 실어 보낸다 — 넘으면 요청이 버려지고
   화면이 "This page couldn't load" 로 무너진다. FormData 의 경계·머리글 몫을 남겨 둔다.
   스튜디오(본인)와 어드민(대신 올리기)이 같이 쓴다 */
export const AVATAR_MAX_BYTES = 900 * 1024

/* 프로필 이미지는 크게 잡아도 64px(size-16) 동그라미다 — 3배 화면에서도 192px.
   큰 원본을 그대로 두면 브라우저가 화면에 그릴 때 한 번에 수십 분의 일로 줄이면서
   안경테·머리카락 같은 가는 선이 계단처럼 깨진다. 저장할 때 미리 이 크기로 줄인다 */
const AVATAR_SIDE = 512

export async function shrinkAvatar(file: File): Promise<File | null> {
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    return null
  }

  try {
    const long = Math.max(bitmap.width, bitmap.height)
    /* 이미 작으면 다시 인코딩하지 않는다 — 화질만 잃는다 */
    if (long <= AVATAR_SIDE && file.size <= AVATAR_MAX_BYTES) return file

    const canvas = downscale(bitmap, Math.min(1, AVATAR_SIDE / long))
    /* 투명 배경(배경을 지운 PNG)은 PNG 로 — JPEG 로 떨어지면 투명한 곳이 검게 칠해진다 */
    const blob = (await encodeAlphaSafe(canvas, 0.9)) ?? null
    if (!blob || blob.size > AVATAR_MAX_BYTES) return shrinkImage(file, AVATAR_MAX_BYTES)

    const ext = blob.type === 'image/webp' ? 'webp' : blob.type === 'image/png' ? 'png' : 'jpg'
    const stem = file.name.replace(/\.[^.]+$/, '') || 'avatar'
    return new File([blob], `${stem}.${ext}`, { type: blob.type })
  } finally {
    bitmap.close()
  }
}

/* 한 번에 크게 줄이면 가는 선이 깨진다 — 반씩 여러 번 줄여 마지막에 목표 크기로 */
function downscale(bitmap: ImageBitmap, scale: number): HTMLCanvasElement {
  const tw = Math.max(1, Math.round(bitmap.width * scale))
  const th = Math.max(1, Math.round(bitmap.height * scale))

  let src: CanvasImageSource = bitmap
  let w = bitmap.width
  let h = bitmap.height
  for (;;) {
    const nw = Math.max(tw, Math.round(w / 2))
    const nh = Math.max(th, Math.round(h / 2))
    const c = document.createElement('canvas')
    c.width = nw
    c.height = nh
    const ctx = c.getContext('2d')!
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(src, 0, 0, nw, nh)
    if (nw === tw && nh === th) return c
    src = c
    w = nw
    h = nh
  }
}

/* WebP 로 뽑고, 못 만드는 브라우저(사파리 등)는 PNG 로 — 투명을 지킨다 */
function encodeAlphaSafe(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob(
      (b) => {
        if (b && b.type === 'image/webp') return resolve(b)
        canvas.toBlob((p) => resolve(p), 'image/png')
      },
      'image/webp',
      quality,
    )
  })
}

/* WebP 로 뽑고, 못 만드는 브라우저는 JPEG 로 */
function encode(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob(
      (b) => {
        if (b && b.type === 'image/webp') return resolve(b)
        canvas.toBlob((j) => resolve(j), 'image/jpeg', quality)
      },
      'image/webp',
      quality,
    )
  })
}
