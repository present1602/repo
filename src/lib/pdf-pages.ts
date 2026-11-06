/* PDF 포트폴리오를 장마다 이미지로 바꾼다.

   공개 화면은 그림만 그린다 — 보는 사람마다 pdf.js 와 PDF 전체를 받아
   그리게 하면 큰 포트폴리오는 열리기까지 한참 걸리고 폰에서는 버벅인다.
   올릴 때 한 번 그려 두면 보는 쪽은 이미지처럼 가볍다.
   서버에서 그리면 원본을 받아 다시 내보내느라 왕복이 생기므로
   make-thumb.ts 처럼 브라우저에서 만든다.

   한 장짜리 긴 이미지로 잇지 않는다 — 캔버스에는 면적 한도가 있어
   (iOS 사파리 약 1,670만 픽셀) 몇 장만 넘어도 잘리거나 만들어지지 않는다.

   pdf.js 는 크다 — PDF 를 고를 때만 불러온다. */

import { MAX_PDF_PAGES, MAX_STACK_PARTS } from './portfolio-limits'

/* 장 너비. 썸네일 영역을 잡으며 크게 키워 봐도 본문 글자가 읽히는 정도.
   2000 은 레티나에서 키우면 글자가 흐리게 번졌다. 더 올리면 A4 한 장이
   iOS 사파리의 캔버스 면적 한도(약 1,670만 픽셀)를 넘어 그리지 못한다. */
const PAGE_WIDTH = 3000
/* 한 조각의 최대 높이 — 캔버스 한 장이 같은 면적 한도 안에 들도록.
   이보다 긴 장(웹 화면을 통째로 내보낸 세로로 긴 PDF)은 줄이지 않고 세로로
   잘라 여러 조각으로 저장한다. 예전에는 이 높이에 맞춰 장 전체를 줄였더니
   긴 장의 폭이 500px 대로 쪼그라들어 글자가 깨졌다. 조각은 work-stack 의
   "이어 붙인 장"으로 그대로 이어져 보이고, 영역도 조각 경계를 넘어 잡힌다. */
const SLICE_HEIGHT = Math.floor(16_000_000 / PAGE_WIDTH)

/* 글자 가장자리가 뭉개지지 않는 선 — 0.85 에서는 작은 글씨 둘레가 번졌다 */
const QUALITY = 0.92

export type RenderedPage = { file: File; width: number; height: number }

export type PdfResult =
  | { ok: true; pages: RenderedPage[] }
  | { ok: false; error: string }

export async function renderPdfPages(
  file: File,
  onProgress?: (done: number, total: number) => void,
): Promise<PdfResult> {
  let pdfjs: typeof import('pdfjs-dist')
  try {
    pdfjs = await import('pdfjs-dist')
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url,
    ).toString()
  } catch (e) {
    console.error('[pdf] pdf.js 불러오기 실패:', e)
    return { ok: false, error: 'PDF를 읽을 준비를 하지 못했습니다. 새로고침 후 다시 시도해 주세요.' }
  }

  const task = pdfjs.getDocument({ data: await file.arrayBuffer() })
  try {
    const doc = await task.promise
    if (doc.numPages > MAX_PDF_PAGES) {
      return { ok: false, error: `PDF는 ${MAX_PDF_PAGES}쪽까지 올릴 수 있습니다. (이 파일은 ${doc.numPages}쪽)` }
    }

    const stem = file.name.replace(/\.pdf$/i, '') || 'page'
    const pages: RenderedPage[] = []

    /* 조각 수를 먼저 센다 — 진행 표시를 쪽이 아니라 조각으로 올린다. 한 장짜리
       긴 PDF 는 쪽으로 세면 끝날 때까지 0/1 에 머물러 멈춘 것처럼 보였다. */
    let total = 0
    for (let n = 1; n <= doc.numPages; n++) {
      const base = (await doc.getPage(n)).getViewport({ scale: 1 })
      total += Math.ceil(Math.round((base.height * PAGE_WIDTH) / base.width) / SLICE_HEIGHT)
    }
    if (total > MAX_STACK_PARTS) {
      return { ok: false, error: 'PDF가 너무 길어 올릴 수 없습니다. 쪽을 나누거나 줄여 주세요.' }
    }
    onProgress?.(0, total)

    /* 한 장씩 그리고 캔버스를 바로 비운다 — 서른 장을 한꺼번에 들고 있으면
       폰에서 메모리가 모자란다 */
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n)
      const base = page.getViewport({ scale: 1 })
      const viewport = page.getViewport({ scale: PAGE_WIDTH / base.width })
      const width = Math.round(viewport.width)
      const full = Math.round(viewport.height)
      const slices = Math.ceil(full / SLICE_HEIGHT)

      /* 긴 장을 한 번에 크게 그려 잘라 내면 빠르지만 쓰지 않는다 — 큰 캔버스에
         그리면 오류 없이 일부가 하얗게 빠졌다(3000×16000 이상). 조각마다 그
         부분만 그린다. 그림 많은 긴 장은 조각 수만큼 오래 걸려(9MB 한 장 약 55초)
         진행 표시를 조각 단위로 올린다. */
      for (let k = 0; k < slices; k++) {
        const top = k * SLICE_HEIGHT
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = Math.min(SLICE_HEIGHT, full - top)

        /* 투명한 바탕이 JPEG 로 나가면 검게 칠해진다 — 흰 종이로 깐다.
           긴 장은 그릴 자리를 위로 밀어(transform) 이 조각에 걸친 부분만 그린다 */
        await page.render({ canvas, viewport, transform: [1, 0, 0, 1, 0, -top], background: '#ffffff' }).promise

        const blob = await encode(canvas)
        const height = canvas.height
        canvas.width = 0
        canvas.height = 0
        if (!blob) return { ok: false, error: `PDF ${n}쪽을 이미지로 바꾸지 못했습니다.` }

        const ext = blob.type === 'image/webp' ? 'webp' : 'jpg'
        const name = slices > 1 ? `${stem}-${n}-${k + 1}.${ext}` : `${stem}-${n}.${ext}`
        pages.push({ file: new File([blob], name, { type: blob.type }), width, height })
        onProgress?.(pages.length, total)
      }
      page.cleanup()
    }

    return { ok: true, pages }
  } catch (e) {
    console.error('[pdf] 변환 실패:', e)
    const locked = e instanceof Error && e.name === 'PasswordException'
    return {
      ok: false,
      error: locked ? '암호가 걸린 PDF는 올릴 수 없습니다.' : 'PDF를 읽지 못했습니다. 파일이 손상되지 않았는지 확인해 주세요.',
    }
  } finally {
    /* 워커와 문서 메모리를 돌려준다 — 큰 PDF 는 수십 MB 를 잡는다 */
    await task.destroy()
  }
}

/* WebP 로 뽑고, 못 만드는 브라우저는 JPEG 로 */
function encode(canvas: HTMLCanvasElement): Promise<Blob | null> {
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
