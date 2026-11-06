/* 포트폴리오로 고른 파일을 올릴 수 있는 모양으로 바꾼다 — 스튜디오(본인)와
   어드민(대신 올리기)이 같이 쓴다. 한쪽만 고치면 같은 PDF 가 한 화면에서는
   올라가고 다른 화면에서는 막힌다.

   · 지원하지 않는 형식·너무 큰 파일은 바로 거절한다(토스트로 알린다)
   · PDF 는 장마다 이미지로 — 첫 장이 작업 이미지, 나머지는 pages(pdf-pages.ts)
   · 버킷 한도를 넘는 이미지는 한도 아래로 줄인다(shrink-image.ts) */

import {
  MAX_SOURCE_BYTES,
  MAX_UPLOAD_BYTES,
  WORK_FILE_EXTS,
} from './portfolio-limits'
import { renderPdfPages, type RenderedPage } from './pdf-pages'
import { shrinkImage } from './shrink-image'

export type PreparedWork = { file: File; pages: RenderedPage[] }

const MB = 1024 * 1024

/* 고르자마자 거를 것 — 통과하면 null */
export function checkWorkFile(picked: File): string | null {
  const ext = picked.name.split('.').pop()?.toLowerCase() ?? ''
  if (!WORK_FILE_EXTS.includes(ext)) {
    return `지원하지 않는 형식입니다(.${ext || '?'}). ${WORK_FILE_EXTS.map((e) => e.toUpperCase()).join('·')}만 올릴 수 있습니다.`
  }
  if (picked.size > MAX_SOURCE_BYTES) return `파일은 ${MAX_SOURCE_BYTES / MB}MB까지 올릴 수 있습니다.`
  return null
}

export function isPdf(picked: File) {
  return /\.pdf$/i.test(picked.name)
}

export async function prepareWorkFile(
  picked: File,
  onStatus?: (text: string) => void,
): Promise<({ ok: true } & PreparedWork) | { ok: false; error: string }> {
  const bad = checkWorkFile(picked)
  if (bad) return { ok: false, error: bad }

  if (isPdf(picked)) {
    onStatus?.('PDF 변환 중…')
    const r = await renderPdfPages(picked, (done, total) => onStatus?.(`PDF 변환 중 ${done}/${total}`))
    if (!r.ok) return r
    return { ok: true, file: r.pages[0].file, pages: r.pages.slice(1) }
  }

  if (picked.size > MAX_UPLOAD_BYTES) onStatus?.('이미지 줄이는 중…')
  const file = await shrinkImage(picked)
  if (!file) return { ok: false, error: `이미지를 ${MAX_UPLOAD_BYTES / MB}MB 이하로 줄이지 못했습니다.` }
  return { ok: true, file, pages: [] }
}

/* 여러 파일을 몇 개씩 나눠 올린다 — 서른 장을 한꺼번에 보내면 폰 회선에서
   전부 느려지고, 하나씩 보내면 너무 오래 걸린다. 하나라도 실패하면 false. */
export async function uploadAll(jobs: (() => Promise<boolean>)[], parallel = 4): Promise<boolean> {
  let next = 0
  let ok = true
  const worker = async () => {
    while (ok && next < jobs.length) {
      const job = jobs[next++]
      if (!(await job())) ok = false
    }
  }
  await Promise.all(Array.from({ length: Math.min(parallel, jobs.length) }, worker))
  return ok
}

/* addWork·adminAddWork 에 실어 보낼 장 목록 */
export function pagesField(pages: RenderedPage[], paths: string[]): string {
  return JSON.stringify(pages.map((p, i) => ({ path: paths[i], width: p.width, height: p.height })))
}
