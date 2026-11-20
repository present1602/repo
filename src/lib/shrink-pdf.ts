/* 저장소 한도를 넘는 PDF 를 브라우저에서 "장마다 JPEG 로 그린 PDF" 로 다시 만든다.

   경력 페이지 포트폴리오 파일(roster-files, 50MB)에 쓴다. 한도 안의 PDF 는 손대지 않는다 —
   그림으로 바꾸면 글자 선택·검색이 사라지고 화질도 내려간다.

   PDF 쓰기 라이브러리를 들이지 않는다. JPEG 는 PDF 가 그대로 품을 수 있는 형식(DCTDecode)이라
   쪽마다 그림 하나를 깐 가장 단순한 PDF 는 몇십 줄이면 쓸 수 있다.

   크기는 해상도·화질을 단계별로 낮춰 가며 맞춘다. 단계마다 합계가 한도를 넘는 순간 멈추고
   다음 단계로 넘어간다 — 끝까지 다 그린 뒤에야 넘친 것을 알면 큰 PDF 는 몇 분을 버린다.

   pdf.js 는 크다 — 줄일 PDF 가 있을 때만 불러온다(pdf-pages.ts 와 같은 설정). */

/* [쪽 너비(px), JPEG 품질] — 앞에서부터 시도한다 */
const STEPS: [number, number][] = [
  [2000, 0.85],
  [1700, 0.8],
  [1400, 0.75],
  [1200, 0.7],
  [1000, 0.62],
  [800, 0.55],
]
/* 캔버스 면적 한도(iOS 사파리 약 1,670만 픽셀) — 넘는 긴 쪽은 너비를 줄여 한 장에 그린다 */
const MAX_AREA = 16_000_000

export type ShrinkPdfResult = { ok: true; file: File } | { ok: false; error: string }

export async function shrinkPdf(
  file: File,
  limit: number,
  onProgress?: (done: number, total: number) => void,
): Promise<ShrinkPdfResult> {
  if (file.size <= limit) return { ok: true, file }

  let pdfjs: typeof import('pdfjs-dist')
  try {
    pdfjs = await import('pdfjs-dist')
    pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()
  } catch (e) {
    console.error('[shrink-pdf] pdf.js 불러오기 실패:', e)
    return { ok: false, error: 'PDF를 줄일 준비를 하지 못했습니다. 새로고침 후 다시 시도해 주세요.' }
  }

  const task = pdfjs.getDocument({
    data: await file.arrayBuffer(),
    wasmUrl: '/pdfjs/wasm/',
    standardFontDataUrl: '/pdfjs/standard_fonts/',
    iccUrl: '/pdfjs/iccs/',
  })

  try {
    const doc = await task.promise
    /* 머리말·목차 몫으로 조금 남긴다 */
    const budget = limit - 64 * 1024

    for (const [width, quality] of STEPS) {
      const pages: PdfPage[] = []
      let total = 0
      let over = false

      for (let n = 1; n <= doc.numPages; n++) {
        const page = await doc.getPage(n)
        const base = page.getViewport({ scale: 1 })
        let scale = width / base.width
        if (base.width * scale * base.height * scale > MAX_AREA) {
          scale = Math.sqrt(MAX_AREA / (base.width * base.height))
        }
        const viewport = page.getViewport({ scale })

        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.round(viewport.width))
        canvas.height = Math.max(1, Math.round(viewport.height))
        /* 투명한 바탕이 JPEG 로 나가면 검게 칠해진다 — 흰 종이로 깐다 */
        await page.render({ canvas, viewport, background: '#ffffff' }).promise
        const blob = await jpeg(canvas, quality)
        const px = { w: canvas.width, h: canvas.height }
        canvas.width = 0
        canvas.height = 0
        page.cleanup()

        if (!blob) return { ok: false, error: `PDF ${n}쪽을 이미지로 바꾸지 못했습니다.` }
        total += blob.size
        if (total > budget) {
          over = true
          break
        }
        /* 쪽 크기는 원래 PDF 의 크기(pt)를 그대로 둔다 — 인쇄·확대 비율이 같다 */
        pages.push({ jpeg: new Uint8Array(await blob.arrayBuffer()), px, pt: { w: base.width, h: base.height } })
        onProgress?.(n, doc.numPages)
      }

      if (!over) {
        const bytes = writePdf(pages)
        if (bytes.byteLength <= limit) {
          return { ok: true, file: new File([bytes], file.name, { type: 'application/pdf' }) }
        }
      }
    }

    return { ok: false, error: `${file.name}: 너무 커서 50MB 아래로 줄이지 못했습니다. 파일을 나눠서 올려 주세요.` }
  } catch (e) {
    console.error('[shrink-pdf] 변환 실패:', e)
    const locked = e instanceof Error && e.name === 'PasswordException'
    return {
      ok: false,
      error: locked
        ? `${file.name}: 암호가 걸린 PDF는 줄일 수 없습니다.`
        : `${file.name}: PDF를 읽지 못했습니다. 파일이 손상되지 않았는지 확인해 주세요.`,
    }
  } finally {
    await task.destroy()
  }
}

function jpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/jpeg', quality))
}

type PdfPage = { jpeg: Uint8Array; px: { w: number; h: number }; pt: { w: number; h: number } }

/* 쪽마다 JPEG 하나를 꽉 채운 PDF 1.4.
   객체 번호: 1 목차(Catalog), 2 쪽 묶음(Pages), 그 뒤로 쪽마다 [쪽, 그리기 명령, 그림] 세 개. */
function writePdf(pages: PdfPage[]): Uint8Array<ArrayBuffer> {
  const enc = new TextEncoder()
  const chunks: Uint8Array[] = []
  const offsets: number[] = []
  let length = 0

  const push = (part: string | Uint8Array) => {
    const bytes = typeof part === 'string' ? enc.encode(part) : part
    chunks.push(bytes)
    length += bytes.byteLength
  }
  const begin = (num: number) => {
    offsets[num] = length
    push(`${num} 0 obj\n`)
  }

  /* 머리말 — 둘째 줄의 높은 바이트는 "이 파일은 바이너리" 표시(관례) */
  push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n')

  const kids = pages.map((_, i) => `${3 + i * 3} 0 R`).join(' ')
  begin(1)
  push('<< /Type /Catalog /Pages 2 0 R >>\nendobj\n')
  begin(2)
  push(`<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>\nendobj\n`)

  pages.forEach((p, i) => {
    const pageNum = 3 + i * 3
    const contentNum = pageNum + 1
    const imageNum = pageNum + 2
    const w = p.pt.w.toFixed(2)
    const h = p.pt.h.toFixed(2)
    const draw = `q ${w} 0 0 ${h} 0 0 cm /Im0 Do Q`

    begin(pageNum)
    push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] ` +
        `/Resources << /XObject << /Im0 ${imageNum} 0 R >> >> /Contents ${contentNum} 0 R >>\nendobj\n`,
    )
    begin(contentNum)
    push(`<< /Length ${draw.length} >>\nstream\n${draw}\nendstream\nendobj\n`)
    begin(imageNum)
    push(
      `<< /Type /XObject /Subtype /Image /Width ${p.px.w} /Height ${p.px.h} /ColorSpace /DeviceRGB ` +
        `/BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpeg.byteLength} >>\nstream\n`,
    )
    push(p.jpeg)
    push('\nendstream\nendobj\n')
  })

  /* 목차표(xref) — 객체마다 시작 위치를 10자리로 */
  const count = 3 + pages.length * 3
  const xrefAt = length
  let xref = `xref\n0 ${count}\n0000000000 65535 f \n`
  for (let n = 1; n < count; n++) xref += `${String(offsets[n]).padStart(10, '0')} 00000 n \n`
  push(xref)
  push(`trailer\n<< /Size ${count} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`)

  const out = new Uint8Array(length)
  let at = 0
  for (const c of chunks) {
    out.set(c, at)
    at += c.byteLength
  }
  return out
}
