/* PDF 작업을 "장을 세로로 이어 붙인 긴 이미지 한 장"으로 다룬다.

   공개 모달은 장을 이어 붙여 내려 보게 하므로, 썸네일 영역도 그 긴 그림
   어디에서나(장 경계를 넘어서도) 잡을 수 있어야 한다. 그래서 PDF 작업의
   width·height 는 이어 붙인 전체 크기이고, crop 도 전체에 대한 0~1 비율이다.

   장마다 너비가 다를 수 있다(아주 긴 장은 세로로 묶여 좁게 그려진다 —
   pdf-pages.ts). 이어 붙일 때는 첫 장 너비에 맞춰 늘이거나 줄인다 —
   모달(work-modal.tsx)이 그리는 방식과 같다. */

import type { Crop } from './crop'
import type { WorkPage } from './portfolio-limits'

type Size = { width: number; height: number }

/* 한 장 — 이미지 주소(올린 뒤) 또는 파일(올리기 전)과 원래 크기 */
export type StackPart = Size & { src: string | File }

/* 이어 붙인 전체 크기 — 너비는 첫 장, 높이는 각 장을 그 너비로 맞춘 합 */
export function stackSize(first: Size, pages: Size[]): Size {
  const width = first.width
  const height = first.height + pages.reduce((sum, p) => sum + (p.height * width) / p.width, 0)
  return { width, height }
}

/* 첫 장만 덮는 영역 — 영역을 따로 잡지 않은 PDF 의 썸네일 자리.
   이것을 저장해 두면 목록·카드가 썸네일을 첫 장 비율로 놓는다
   (width·height 가 전체 크기라, 영역이 없으면 긴 그림 비율로 놓인다). */
export function firstPageCrop(first: Size, pages: Size[]): Crop {
  const { height } = stackSize(first, pages)
  return { x: 0, y: 0, w: 1, h: Math.min(1, first.height / height) }
}

/* 저장된 PDF 작업을 장 목록으로 — 첫 장 크기는 따로 두지 않으므로
   전체 크기에서 나머지 장 높이를 빼서 되살린다. PDF 가 아니면 null. */
export function stackOfWork(w: {
  image_url: string
  width: number | null
  height: number | null
  pages?: WorkPage[] | null
}): StackPart[] | null {
  if (!w.pages || w.pages.length === 0 || !w.width || !w.height) return null
  const width = w.width
  const rest = w.pages.reduce((sum, p) => sum + (p.height * width) / p.width, 0)
  const firstHeight = w.height - rest
  if (!(firstHeight > 0)) return null
  return [
    { src: w.image_url, width, height: firstHeight },
    ...w.pages.map((p) => ({ src: p.url, width: p.width, height: p.height })),
  ]
}
