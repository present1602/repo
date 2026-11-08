'use client'

import { useState } from 'react'
import type { PublicWork } from '@/lib/designer-shape'
import { WorkModal } from './work-modal'
import { AiBadge, WorkThumb } from './work-thumb'

export function WorkGallery({ works }: { works: PublicWork[] }) {
  const [index, setIndex] = useState<number | null>(null)

  if (works.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-neutral-300 py-20 text-center text-sm text-neutral-500">
        아직 공개된 작업이 없습니다.
      </p>
    )
  }

  return (
    <>
      {/* 한 장이면 폭을 다 쓰고, 두 장부터는 2열 masonry.
          왼쪽부터 한 장씩 돌아가며 칸에 넣는다(1·2 다음 3은 다시 왼쪽).
          CSS columns 는 칸 높이를 맞추려고 순서를 위아래로 흘려 읽는 순서와
          어긋난다. 오른쪽에 의뢰 패널이 붙어 칸이 좁으므로 화면 폭과 상관없이 두 칸이다. */}
      <div className="flex gap-3 md:gap-4">
        {columns(works, works.length === 1 ? 1 : 2).map((col, c) => (
          <div key={c} className="min-w-0 flex-1">
            {col.map(({ w, i }) => (
              <Card key={w.id} work={w} onOpen={() => setIndex(i)} />
            ))}
          </div>
        ))}
      </div>

      {index !== null && (
        /* 끝에서 처음으로 돌지 않는다 — 처음·끝에서 더 넘기면 토스트로 알린다(work-modal.tsx) */
        <WorkModal works={works} index={index} setIndex={setIndex} onClose={() => setIndex(null)} loop={false} />
      )}
    </>
  )
}

/* 작업을 n 칸에 왼쪽부터 돌아가며 나눈다. 모달은 전체 순서로 열어야 하므로
   원래 자리(i)를 함께 들고 간다. */
function columns(works: PublicWork[], n: number) {
  const cols: { w: PublicWork; i: number }[][] = Array.from({ length: n }, () => [])
  works.forEach((w, i) => cols[i % n].push({ w, i }))
  return cols
}

function Card({ work: w, onOpen }: { work: PublicWork; onOpen: () => void }) {
  return (
    <button onClick={onOpen} className="group mb-5 block w-full text-left md:mb-6">
      <Thumbnail work={w} />
      {/* 제목·클라이언트는 선택 입력이다 —
                비어 있으면 줄 자체를 그리지 않아 빈 간격이 남지 않게 한다 */}
      {w.title && <h3 className="mt-3 text-base font-medium md:text-lg">{w.title}</h3>}
      {(w.client || w.soom_work) && (
        <p className="flex flex-wrap items-center gap-x-2 text-xs text-neutral-500">
          {w.client}
          {w.soom_work && <span className="font-medium text-neutral-900">SOOM 의뢰</span>}
        </p>
      )}
    </button>
  )
}

/* 썸네일 한 장 — 자리 비율은 썸네일 파일의 실제 비율을 따른다(work-thumb.tsx).
   모달을 열면 원본 전체를 볼 수 있다. */
function Thumbnail({ work: w }: { work: PublicWork }) {
  return (
    <WorkThumb work={w} imgClassName="group-hover:opacity-90">
      {w.ai_used && <AiBadge />}
    </WorkThumb>
  )
}
