/* PDF 포트폴리오를 장마다 이미지로 바꾼다.

   공개 화면은 그림만 그린다 — 보는 사람마다 pdf.js 와 PDF 전체를 받아
   그리게 하면 큰 포트폴리오는 열리기까지 한참 걸리고 폰에서는 버벅인다.
   올릴 때 한 번 그려 두면 보는 쪽은 이미지처럼 가볍다.
   서버에서 그리면 원본을 받아 다시 내보내느라 왕복이 생기므로
   make-thumb.ts 처럼 브라우저에서 만든다.

   한 장짜리 긴 이미지로 잇지 않는다 — 캔버스에는 면적 한도가 있어
   (iOS 사파리 약 1,670만 픽셀) 몇 장만 넘어도 잘리거나 만들어지지 않는다.

   pdf.js 는 크다 — PDF 를 고를 때만 불러온다. */

import { MAX_PDF_PAGES } from './portfolio-limits'

/* 장 너비. 썸네일 영역을 잡으며 크게 키워 봐도 본문 글자가 읽히는 정도.
   2000 은 레티나에서 키우면 글자가 흐리게 번졌다. 더 올리면 A4 한 장이
   iOS 사파리의 캔버스 면적 한도(약 1,670만 픽셀)를 넘어 그리지 못한다. */
const PAGE_WIDTH = 3000
/* 아주 길쭉한 장(세로 배너 등)도 같은 한도 안에 들도록 세로를 묶는다 */
const PAGE_MAX_HEIGHT = Math.floor(16_000_000 / PAGE_WIDTH)

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

    /* 한 장씩 그리고 캔버스를 바로 비운다 — 서른 장을 한꺼번에 들고 있으면
       폰에서 메모리가 모자란다 */
    for (let n = 1; n <= doc.numPages; n++) {
      onProgress?.(n - 1, doc.numPages)
      const page = await doc.getPage(n)
      const base = page.getViewport({ scale: 1 })
      const scale = Math.min(PAGE_WIDTH / base.width, PAGE_MAX_HEIGHT / base.height)
      const viewport = page.getViewport({ scale })

      const canvas = document.createElement('canvas')
      canvas.width = Math.round(viewport.width)
      canvas.height = Math.round(viewport.height)

      /* 투명한 바탕이 JPEG 로 나가면 검게 칠해진다 — 흰 종이로 깐다 */
      await page.render({ canvas, viewport, background: '#ffffff' }).promise
      page.cleanup()

      const blob = await encode(canvas)
      const { width, height } = canvas
      canvas.width = 0
      canvas.height = 0
      if (!blob) return { ok: false, error: `PDF ${n}쪽을 이미지로 바꾸지 못했습니다.` }

      const ext = blob.type === 'image/webp' ? 'webp' : 'jpg'
      pages.push({ file: new File([blob], `${stem}-${n}.${ext}`, { type: blob.type }), width, height })
    }
    onProgress?.(doc.numPages, doc.numPages)

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
