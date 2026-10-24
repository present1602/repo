'use client'

import { useState } from 'react'
import type { PublicWork } from '@/lib/designer-shape'
import { Img } from './img'
import { WorkModal } from './work-modal'
import { thumbOf } from './work-ratio'

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
            <Thumbnail work={w} />
            {/* 제목·클라이언트는 선택 입력이다 —
                비어 있으면 줄 자체를 그리지 않아 빈 간격이 남지 않게 한다 */}
            {w.title && (
              <h3 className="mt-3 text-base font-medium md:text-lg">{w.title}</h3>
            )}
            {/* AI 사용 표기는 true 일 때만 붙인다 — null(묻기 전에 올라간
                작업)과 false 를 구분해 보여주지 않는다. */}
            {(w.client || w.ai_used) && (
              <p className="flex flex-wrap items-center gap-x-2 text-xs text-neutral-500">
                {w.client}
                {w.ai_used && <span className="text-indigo-600">AI 활용</span>}
              </p>
            )}
          </button>
        ))}
      </div>

      {index !== null && (
        <WorkModal works={works} index={index} setIndex={setIndex} onClose={() => setIndex(null)} />
      )}
    </>
  )
}

/* 썸네일 한 장.

   1:1.8 보다 세로로 긴 이미지는 그 비율에서 끊고(object-top 이라 위가 남는다)
   아래쪽을 흰색으로 흐리게 덮는다 — 잘린 게 아니라 "이어진다"로 읽히게 한다.
   모달을 열면 원본 전체를 볼 수 있다. */
function Thumbnail({ work: w }: { work: PublicWork }) {
  const { cls, clipped } = thumbOf(w)

  return (
    <div className="relative overflow-hidden rounded-lg">
      <Img
        src={w.image_url}
        alt={w.title ?? ''}
        ratio={cls}
        className="transition duration-500 group-hover:opacity-90"
      />

      {clipped && (
        /* 카드 배경이 흰색이므로 흰색으로 녹인다.
           pointer-events-none — 이 덮개가 클릭을 가로채면 모달이 안 열린다. */
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-white"
        />
      )}
    </div>
  )
}
