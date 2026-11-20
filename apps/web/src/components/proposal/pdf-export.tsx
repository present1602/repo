'use client'

import { Fragment, useState } from 'react'

/* 제안서를 PDF·PNG로 내려받는 버튼 — 관리자만 본다(admin-pdf-bar.tsx).
   PNG 는 아래쪽에 따로 설명한다.

   브라우저의 인쇄 → "PDF로 저장"을 쓴다. 화면을 그림으로 떠서 붙이는
   방식과 달리 글자가 글자로 남아 선명하고, 검색·복사가 된다.

   PC/모바일은 종이 크기로 가른다 — 인쇄할 때 미디어 쿼리는 종이 폭을
   기준으로 잡히므로, 390px 종이에 찍으면 md 아래(모바일) 짜임이,
   1440px 종이에 찍으면 펼침면 짜임이 그대로 나온다.
     PC     : 펼침면 한 장 = 종이 한 장 (가로)
     모바일 : 쪽 하나(Half) = 종이 한 장 (폰 화면 비율) */

type Mode = 'pc' | 'mobile'

const PAGE: Record<Mode, { w: number; h: number }> = {
  pc: { w: 1440, h: 900 },
  mobile: { w: 390, h: 844 },
}

const NAME: Record<Mode, string> = {
  pc: 'SOOM 디자이너 제안서 (PC)',
  mobile: 'SOOM 디자이너 제안서 (모바일)',
}

/* 한 장 = 한 쪽이 되도록 여백·그림자·둥근 모서리를 걷어낸다.
   html[data-pdf] 로 묶어 이 버튼으로 찍을 때만 적용된다. */
function printCss(mode: Mode) {
  const { w, h } = PAGE[mode]
  const page =
    mode === 'pc'
      ? `
    html[data-pdf] .proposal-spread {
      height: ${h}px; min-height: ${h}px; max-height: ${h}px;
      break-after: page;
    }`
      : `
    html[data-pdf] .proposal-spread { break-after: page; }
    html[data-pdf] .proposal-spread > * {
      min-height: ${h}px;
      overflow: visible !important;
      break-inside: avoid;
      break-after: page;
    }`

  return `
  @media print {
    @page { size: ${w}px ${h}px; margin: 0; }
    html[data-pdf], html[data-pdf] body {
      background: #fff !important;
      scroll-snap-type: none !important;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    html[data-pdf] .proposal-pages {
      max-width: none !important;
      padding: 0 !important;
    }
    html[data-pdf] .proposal-pages > * { margin: 0 !important; }
    html[data-pdf] .proposal-spread {
      border-radius: 0;
      box-shadow: none;
    }
    html[data-pdf] .proposal-spread:last-child,
    html[data-pdf] .proposal-spread:last-child > *:last-child { break-after: auto; }
    ${page}
  }`
}

function exportPdf(mode: Mode) {
  const html = document.documentElement
  const style = document.createElement('style')
  style.textContent = printCss(mode)
  document.head.appendChild(style)
  html.dataset.pdf = mode

  /* 저장 창에 뜨는 파일 이름은 문서 제목을 따른다 */
  const title = document.title
  document.title = NAME[mode]

  /* 모바일 사파리는 print() 가 바로 돌아온다 — 정리는 인쇄가 끝난 뒤에 */
  const cleanup = () => {
    style.remove()
    delete html.dataset.pdf
    document.title = title
  }
  window.addEventListener('afterprint', cleanup, { once: true })
  window.print()
}

/* ─────────── PNG — 제안서 전체를 세로로 이은 긴 그림 한 장 ───────────

   인쇄와 달리 그림으로 뜨는 쪽은 폭을 마음대로 정할 수 있다 — 화면 밖에
   그 폭의 iframe 을 띄워 같은 페이지를 열면 미디어 쿼리가 iframe 폭으로
   잡혀, 실제 그 크기 화면에서 보는 짜임이 그대로 나온다. 높이도 실제
   화면 크기로 준다(펼침면 높이가 100vh 를 따른다, globals.css). */

const SHOT: Record<Mode, { w: number; h: number }> = {
  pc: { w: 1440, h: 900 },
  mobile: { w: 390, h: 844 },
}

/* 크롬 캔버스는 한 변 32,767px 까지 그린다 — 긴 그림이라 높이가 먼저
   걸리므로 그 안에 들도록 배율을 낮춘다. PC 는 3배(가로 4,320px)여야
   확대해 봐도 글자가 뭉개지지 않는다.
   사파리는 캔버스 넓이가 약 1,670만 화소로 묶여 이 크기를 못 그린다 —
   PNG 저장은 크롬에서 한다. */
const MAX_SIDE = 32000

function loadFrame(w: number, h: number) {
  return new Promise<HTMLIFrameElement>((resolve, reject) => {
    const frame = document.createElement('iframe')
    frame.setAttribute('aria-hidden', 'true')
    frame.tabIndex = -1
    Object.assign(frame.style, {
      position: 'fixed',
      top: '0',
      left: '-100000px',
      width: `${w}px`,
      height: `${h}px`,
      border: '0',
      pointerEvents: 'none',
    })
    frame.onload = () => resolve(frame)
    frame.onerror = () => reject(new Error('제안서를 불러오지 못했습니다.'))
    frame.src = location.pathname
    document.body.appendChild(frame)
  })
}

/* withApply=false — 마지막 '지원' 펼침면을 빼고 그 위까지만 찍는다 */
async function exportPng(mode: Mode, withApply: boolean) {
  const { w, h } = SHOT[mode]
  const frame = await loadFrame(w, h)

  try {
    const doc = frame.contentDocument
    const pages = doc?.querySelector<HTMLElement>('.proposal-pages')
    if (!doc || !pages) throw new Error('제안서를 찾지 못했습니다.')
    await doc.fonts.ready

    /* 감추지 않고 떼어낸다 — 감추기만 하면 그 앞 장이 마지막이 아니게 되어
       space-y 의 아래 간격이 남아 그림 끝이 휑하다. 찍고 나면 iframe 째
       버리므로 React 가 그린 노드를 떼어내도 탈이 없다. */
    if (!withApply) pages.querySelector('.proposal-spread:last-of-type')?.remove()

    /* 넓은 화면에서는 오른쪽 레일 자리만큼 오른쪽 여백이 더 넓다 —
       레일이 찍히지 않는 그림에서는 한쪽으로 쏠려 보이므로 맞춘다 */
    const view = doc.defaultView!
    pages.style.paddingRight = view.getComputedStyle(pages).paddingLeft

    const { domToBlob } = await import('modern-screenshot')
    const scale = Math.min(3, MAX_SIDE / pages.scrollHeight)
    const blob = await domToBlob(pages, {
      scale,
      backgroundColor: view.getComputedStyle(doc.body.firstElementChild!).backgroundColor,
    })

    download(blob, `${NAME[mode]}${withApply ? '' : ' - 지원 제외'}.png`)
  } finally {
    frame.remove()
  }
}

/* ─────────── PNG — PC 펼침면을 한 장씩, zip 하나로 ───────────

   슬라이드로 쓸 그림이라 바깥 여백·그림자·둥근 모서리를 걷어내고
   펼침면이 종이를 꽉 채우게 한다. 펼침면 높이는 화면 높이 - 10.5rem
   (globals.css)이므로, iframe 높이를 978px 로 주면 한 장이 1440×810 —
   16:9 가 된다. */
const SLIDE = { w: 1440, h: 810 + 168 }

async function exportPcSlides() {
  const frame = await loadFrame(SLIDE.w, SLIDE.h)

  try {
    const doc = frame.contentDocument
    const pages = doc?.querySelector<HTMLElement>('.proposal-pages')
    if (!doc || !pages) throw new Error('제안서를 찾지 못했습니다.')
    await doc.fonts.ready

    pages.style.padding = '0'
    const spreads = Array.from(pages.querySelectorAll<HTMLElement>('.proposal-spread'))
    for (const s of spreads) {
      s.style.borderRadius = '0'
      s.style.boxShadow = 'none'
    }

    const [{ domToBlob }, { zipSync }] = await Promise.all([
      import('modern-screenshot'),
      import('fflate'),
    ])

    /* 한 장씩 차례로 — 동시에 뜨면 큰 캔버스 일곱 개가 한꺼번에 잡힌다 */
    const files: Record<string, Uint8Array> = {}
    for (const [i, s] of spreads.entries()) {
      const blob = await domToBlob(s, { scale: 3 })
      files[`${String(i + 1).padStart(2, '0')}.png`] = new Uint8Array(await blob.arrayBuffer())
    }

    /* PNG 는 이미 압축돼 있어 다시 눌러도 줄지 않는다 — 담기만 한다 */
    const zip = zipSync(files, { level: 0 })
    download(new Blob([zip as BlobPart], { type: 'application/zip' }), `${NAME.pc} - 슬라이드.zip`)
  } finally {
    frame.remove()
  }
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

const BTN =
  'rounded-full border border-neutral-300 bg-white px-3 py-1 font-medium text-neutral-700 transition hover:border-violet-600 hover:text-violet-600 disabled:cursor-wait disabled:opacity-50'

export function PdfExportButtons() {
  /* 그림 뜨기는 몇 초 걸린다 — 그동안 다시 누르지 못하게 */
  const [busy, setBusy] = useState<string | null>(null)

  async function run(key: string, job: () => Promise<void>) {
    setBusy(key)
    try {
      await job()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'PNG 저장에 실패했습니다.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="grid grid-cols-[auto_auto_auto] items-center gap-x-2 gap-y-1.5">
      <span className="mr-1 text-neutral-500">PDF로 저장</span>
      {(['pc', 'mobile'] as const).map((m) => (
        <button key={m} type="button" onClick={() => exportPdf(m)} className={BTN}>
          {m === 'pc' ? 'PC용' : '모바일용'}
        </button>
      ))}

      {[true, false].map((withApply) => (
        <Fragment key={String(withApply)}>
          <span className="mr-1 text-neutral-500">
            {withApply ? 'PNG로 저장' : 'PNG (지원 제외)'}
          </span>
          {(['pc', 'mobile'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => run(`${m}-${withApply}`, () => exportPng(m, withApply))}
              disabled={busy != null}
              className={BTN}
            >
              {busy === `${m}-${withApply}` ? '저장 중…' : m === 'pc' ? 'PC용' : '모바일용'}
            </button>
          ))}
        </Fragment>
      ))}

      <span className="mr-1 text-neutral-500">PNG 한 장씩 (zip)</span>
      <button
        type="button"
        onClick={() => run('slides', exportPcSlides)}
        disabled={busy != null}
        className={BTN}
      >
        {busy === 'slides' ? '저장 중…' : 'PC용'}
      </button>
    </div>
  )
}
