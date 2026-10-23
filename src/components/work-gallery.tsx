'use client'

import { useState } from 'react'
import type { PublicWork } from '@/lib/designer-shape'
import { Img } from './img'
import { WorkModal } from './work-modal'
import { aspectOf } from './work-ratio'

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
      <div className="columns-2 gap-4 md:columns-3 md:gap-8">
        {works.map((w, i) => (
          <button
            key={w.id}
            onClick={() => setIndex(i)}
            className="group mb-8 block w-full break-inside-avoid text-left md:mb-12"
          >
            <Img
              src={w.image_url}
              alt={w.title ?? ''}
              ratio={aspectOf(w)}
              className="rounded-lg transition duration-500 group-hover:opacity-90"
            />
            {/* 제목·클라이언트는 선택 입력이다 —
                비어 있으면 줄 자체를 그리지 않아 빈 간격이 남지 않게 한다 */}
            {w.title && (
              <h3 className="mt-3 text-base font-medium md:text-lg">{w.title}</h3>
            )}
            {w.client && <p className="text-xs text-neutral-500">{w.client}</p>}
          </button>
        ))}
      </div>

      {index !== null && (
        <WorkModal works={works} index={index} setIndex={setIndex} onClose={() => setIndex(null)} />
      )}
    </>
  )
}
