'use client'

import { useEffect, useRef, useState } from 'react'
import type { PreviewKind } from '@/lib/roster-shape'

/* 비공개 경력 페이지(/roster/{token})의 포트폴리오 파일 — 내려받기 없이 미리보기 다이얼로그로만 본다.

   화면에 보이는 것은 캡처할 수 있으므로 완전히 막을 수는 없다. 대신 손쉬운 길은 모두 막는다.
   - 원본 주소를 걸지 않는다. 서버(file/[id]/route.ts)가 내려받기 지정 없는 짧은 주소를 주고,
     PDF·이미지는 그 주소로 받아 메모리(blob)에서 그린다.
   - PDF 는 브라우저 기본 뷰어를 쓰지 않는다 — 그 뷰어에는 내려받기·인쇄 단추가 있다.
     pdf.js 로 쪽마다 캔버스에 그린다.
   - 우클릭(이미지 저장)·끌어 놓기·글자 선택을 막고, 열려 있는 동안 Ctrl/Cmd+S·P 와 인쇄를 막는다.
   - 영상은 재생기의 내려받기 단추를 숨긴다(controlsList=nodownload).
   - 화면에 옅은 '열람 전용' 워터마크를 깐다. */

export type PreviewFile = { id: string; name: string; ext: string; size: string; kind: PreviewKind }

export function FilePreviewList({ token, files }: { token: string; files: PreviewFile[] }) {
  const [open, setOpen] = useState<PreviewFile | null>(null)

  return (
    <>
      <ul className="mt-2 divide-y divide-[#e4dbd4] border-y border-[#e4dbd4]">
        {files.map((f) => (
          <li key={f.id}>
            <button
              type="button"
              onClick={() => setOpen(f)}
              className="group flex w-full items-center gap-3 py-3 text-left text-sm transition hover:text-[#7b3a52]"
            >
              <span className="w-11 shrink-0 border border-[#e4dbd4] py-0.5 text-center text-[10px] font-semibold uppercase tracking-wide text-[#6f6366]">
                {f.ext || 'file'}
              </span>
              <span className="min-w-0 flex-1 truncate font-medium">{f.name}</span>
              <span className="shrink-0 text-xs tabular-nums text-[#8f8385]">{f.size}</span>
              <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-[#6f6366] transition group-hover:text-[#7b3a52]">
                미리보기
                <svg aria-hidden="true" viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6.5 3.5 11 8l-4.5 4.5" />
                </svg>
              </span>
            </button>
          </li>
        ))}
      </ul>
      {open && <PreviewDialog token={token} file={open} onClose={() => setOpen(null)} />}
    </>
  )
}

type Loaded = { kind: 'pdf'; data: ArrayBuffer } | { kind: 'image'; src: string } | { kind: 'video'; src: string }

function PreviewDialog({ token, file, onClose }: { token: string; file: PreviewFile; onClose: () => void }) {
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [error, setError] = useState<string | null>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  /* 서버에서 짧은 주소를 받고, PDF·이미지는 바로 내용까지 받아 둔다(주소가 1분이면 끝난다) */
  useEffect(() => {
    let alive = true
    let blobUrl: string | null = null
    ;(async () => {
      try {
        const res = await fetch(`/roster/${encodeURIComponent(token)}/file/${file.id}`, { cache: 'no-store' })
        const body = (await res.json().catch(() => ({}))) as { url?: string; kind?: PreviewKind; error?: string }
        if (!res.ok || !body.url) throw new Error(body.error || '파일을 열지 못했습니다. 잠시 후 다시 시도해 주세요.')

        if (body.kind === 'video') {
          if (alive) setLoaded({ kind: 'video', src: body.url })
          return
        }
        const raw = await fetch(body.url)
        if (!raw.ok) throw new Error('파일을 받아 오지 못했습니다. 잠시 후 다시 시도해 주세요.')
        if (body.kind === 'pdf') {
          const data = await raw.arrayBuffer()
          if (alive) setLoaded({ kind: 'pdf', data })
        } else {
          blobUrl = URL.createObjectURL(await raw.blob())
          if (alive) setLoaded({ kind: 'image', src: blobUrl })
        }
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : '파일을 열지 못했습니다.')
      }
    })()
    return () => {
      alive = false
      if (blobUrl) URL.revokeObjectURL(blobUrl)
    }
  }, [token, file.id])

  /* Esc 로 닫기, 뒤쪽 스크롤 잠금, 저장·인쇄 단축키 막기 */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if ((e.ctrlKey || e.metaKey) && ['s', 'p'].includes(e.key.toLowerCase())) e.preventDefault()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  const block = (e: React.SyntheticEvent) => e.preventDefault()

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${file.name} 미리보기`}
      /* touch-callout — 아이폰에서 길게 눌렀을 때 뜨는 '이미지 저장' 메뉴를 끈다(우클릭 막기와 별개로 뜬다) */
      className="fixed inset-0 z-50 flex flex-col bg-[#1e181b] text-[#f3ece7] [-webkit-touch-callout:none]"
      onContextMenu={block}
      onDragStart={block}
    >
      {/* 열려 있는 동안 인쇄하면 빈 종이가 나오게 */}
      <style>{'@media print { body { display: none !important; } }'}</style>

      <div className="flex items-center gap-3 border-b border-white/10 px-[max(16px,env(safe-area-inset-left))] py-3 pt-[max(12px,env(safe-area-inset-top))]">
        <p className="min-w-0 flex-1 truncate text-sm font-medium">{file.name}</p>
        <span className="hidden shrink-0 text-xs text-white/50 sm:inline">열람 전용 · 내려받기 불가</span>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          className="inline-flex min-h-10 shrink-0 items-center gap-2 border border-white/25 px-4 text-sm transition hover:bg-white/10"
        >
          닫기
          <svg aria-hidden="true" viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="m4 4 8 8M12 4l-8 8" />
          </svg>
        </button>
      </div>

      <div className="min-h-0 flex-1 select-none overflow-y-auto overscroll-contain px-[max(16px,env(safe-area-inset-left))] py-6">
        {error ? (
          <p className="mx-auto mt-20 max-w-sm text-center text-sm text-white/80">{error}</p>
        ) : !loaded ? (
          <p className="mt-20 text-center text-sm text-white/60">불러오는 중…</p>
        ) : loaded.kind === 'pdf' ? (
          <PdfPages data={loaded.data} />
        ) : loaded.kind === 'image' ? (
          <Marked className="mx-auto w-fit max-w-full">
            {/* eslint-disable-next-line @next/next/no-img-element -- 메모리(blob)에서 그리는 미리보기라 최적화 대상이 아니다 */}
            <img src={loaded.src} alt={file.name} draggable={false} className="pointer-events-none block max-h-none max-w-full" />
          </Marked>
        ) : (
          <Marked className="mx-auto w-fit max-w-full">
            <video
              src={loaded.src}
              controls
              controlsList="nodownload noremoteplayback"
              disablePictureInPicture
              playsInline
              className="block max-h-[80dvh] max-w-full bg-black"
            />
          </Marked>
        )}
      </div>
    </div>
  )
}

/* 옅은 '열람 전용' 워터마크 — 내용 위에 깔고 클릭은 그대로 아래로 통과시킨다 */
function Marked({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`relative ${className}`}>
      {children}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
        style={{
          backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(
            "<svg xmlns='http://www.w3.org/2000/svg' width='260' height='160'><text x='20' y='90' transform='rotate(-24 130 80)' font-family='sans-serif' font-size='15' fill='rgba(120,120,120,0.16)'>SOOM · 열람 전용</text></svg>",
          )}")`,
        }}
      />
    </div>
  )
}

/* PDF 를 쪽마다 캔버스에 그린다. 화면 가까이 온 쪽만 그린다 — 수십 쪽짜리를 한꺼번에 그리면
   폰에서 메모리가 모자라고 첫 쪽이 늦게 뜬다. pdf.js 는 크다 — 이 다이얼로그를 열 때만 불러온다. */
function PdfPages({ data }: { data: ArrayBuffer }) {
  const [doc, setDoc] = useState<import('pdfjs-dist').PDFDocumentProxy | null>(null)
  const [sizes, setSizes] = useState<{ w: number; h: number }[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    let task: import('pdfjs-dist').PDFDocumentLoadingTask | null = null
    ;(async () => {
      try {
        const pdfjs = await import('pdfjs-dist')
        pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()
        /* pdf.js 가 버퍼를 넘겨받아 비운다 — 다시 열 때를 위해 사본을 준다 */
        task = pdfjs.getDocument({
          data: data.slice(0),
          wasmUrl: '/pdfjs/wasm/',
          standardFontDataUrl: '/pdfjs/standard_fonts/',
          iccUrl: '/pdfjs/iccs/',
        })
        const d = await task.promise
        const s: { w: number; h: number }[] = []
        for (let n = 1; n <= d.numPages; n++) {
          const v = (await d.getPage(n)).getViewport({ scale: 1 })
          s.push({ w: v.width, h: v.height })
        }
        if (!alive) return
        setSizes(s)
        setDoc(d)
      } catch (e) {
        console.error('[roster] PDF 미리보기 실패:', e)
        if (alive) setError('PDF를 열지 못했습니다. 담당자에게 문의해 주세요.')
      }
    })()
    return () => {
      alive = false
      void task?.destroy()
    }
  }, [data])

  if (error) return <p className="mx-auto mt-20 max-w-sm text-center text-sm text-white/80">{error}</p>
  if (!doc) return <p className="mt-20 text-center text-sm text-white/60">PDF를 여는 중…</p>

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <p className="text-center text-xs text-white/50">{sizes.length}쪽</p>
      {sizes.map((s, i) => (
        <PdfPage key={i} doc={doc} n={i + 1} ratio={s.h / s.w} />
      ))}
    </div>
  )
}

function PdfPage({ doc, n, ratio }: { doc: import('pdfjs-dist').PDFDocumentProxy; n: number; ratio: number }) {
  const boxRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [drawn, setDrawn] = useState(false)

  useEffect(() => {
    const box = boxRef.current
    if (!box) return
    let done = false
    const io = new IntersectionObserver(
      async ([entry]) => {
        if (!entry?.isIntersecting || done) return
        done = true
        io.disconnect()
        const page = await doc.getPage(n)
        const base = page.getViewport({ scale: 1 })
        /* 화면 너비 × 기기 배율(1.5~2) — 1 배 화면에서도 작은 글씨가 번지지 않게 1.5 배는 깔고,
           2 배를 넘기면 폰 메모리를 넘는다. 브라우저를 축소해 배율이 1 아래로 내려가도 1.5 배로 그린다 */
        const dpr = window.devicePixelRatio || 1
        const scale = (box.clientWidth * Math.min(2, Math.max(1.5, dpr))) / base.width
        const viewport = page.getViewport({ scale })
        const canvas = canvasRef.current
        if (!canvas) return
        canvas.width = Math.round(viewport.width)
        canvas.height = Math.round(viewport.height)
        await page.render({ canvas, viewport, background: '#ffffff' }).promise
        page.cleanup()
        setDrawn(true)
      },
      { rootMargin: '600px 0px' },
    )
    io.observe(box)
    return () => io.disconnect()
  }, [doc, n])

  return (
    <Marked>
      <div ref={boxRef} className="relative w-full bg-white" style={{ aspectRatio: `1 / ${ratio}` }}>
        <canvas ref={canvasRef} className="absolute inset-0 size-full" />
        {!drawn && <p className="absolute inset-0 grid place-items-center text-xs text-neutral-400">{n}쪽</p>}
      </div>
    </Marked>
  )
}
