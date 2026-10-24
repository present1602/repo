'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { FeedWork } from '@/lib/designer-shape'
import { displayNameOf } from '@/lib/display-name'
import { Img } from './img'
import { WorkModal } from './work-modal'
import { thumbOf } from './work-ratio'

/* 홈의 작업 피드 — 여러 디자이너의 작업을 한 벽으로 섞어 보여준다.

   WorkGallery(디자이너 상세)와 따로 둔다. 저쪽은 한 사람의 작업만 나오므로
   누가 만들었는지 적을 필요가 없지만, 여기서는 작업마다 디자이너가 달라
   아바타와 이름이 카드의 일부다. 두 화면을 한 컴포넌트로 합치면
   "디자이너 줄을 보일까 말까" 분기가 카드 안에 들어온다. */
export function HomeFeed({ works }: { works: FeedWork[] }) {
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
      <div className="columns-2 gap-3 md:columns-3 md:gap-4 lg:columns-4">
        {works.map((w, i) => (
          <article key={w.id} className="mb-3 break-inside-avoid md:mb-4">
            <button
              onClick={() => setIndex(i)}
              className="group block w-full text-left"
              aria-label={w.title ?? '작업 보기'}
            >
              <Thumbnail work={w} />
            </button>

            {/* 디자이너 줄은 카드 밖에 둔다 — 이름을 누르면 모달이 아니라
                그 디자이너의 상세로 가야 하므로 버튼 안에 넣을 수 없다
                (버튼 안의 링크는 HTML 상 허용되지 않는다). */}
            <Byline work={w} />
          </article>
        ))}
      </div>

      {index !== null && (
        <WorkModal works={works} index={index} setIndex={setIndex} onClose={() => setIndex(null)} />
      )}
    </>
  )
}

/* 썸네일 — 상세 화면과 같은 규칙으로 자리를 잡는다(work-ratio.ts).
   1:1.8 보다 긴 이미지는 거기서 끊고 아래를 흰색으로 녹인다. */
function Thumbnail({ work: w }: { work: FeedWork }) {
  const { cls, clipped } = thumbOf(w)

  return (
    <div className="relative overflow-hidden rounded-xl">
      <Img
        src={w.image_url}
        alt={w.title ?? ''}
        ratio={cls}
        className="transition duration-500 group-hover:scale-[1.03]"
      />

      {clipped && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-white"
        />
      )}

      {/* 제목은 데스크톱에서 호버할 때만 겹쳐 보여준다 —
          좁은 화면에는 호버가 없어 영영 가려지므로 띄우지 않는다. */}
      {w.title && (
        <div className="pointer-events-none absolute inset-0 hidden flex-col justify-end bg-gradient-to-t from-black/70 via-black/0 p-3 opacity-0 transition group-hover:opacity-100 md:flex">
          <p className="line-clamp-2 text-sm font-semibold text-white">{w.title}</p>
        </div>
      )}
    </div>
  )
}

/* 작업 아래 한 줄 — 아바타·이름·분야 */
function Byline({ work: w }: { work: FeedWork }) {
  const name = displayNameOf(w.designer)

  return (
    <div className="mt-2 flex items-center gap-2">
      <Link
        href={`/designers/${w.designer.id}`}
        className="group/by flex min-w-0 items-center gap-2"
      >
        {w.designer.avatar_url ? (
          <Img src={w.designer.avatar_url} alt={name} className="size-5 shrink-0 rounded-full" />
        ) : (
          /* 아바타가 없어도 같은 자리를 차지해 줄 높이가 흔들리지 않게 한다 */
          <span className="grid size-5 shrink-0 place-items-center rounded-full bg-neutral-200 text-[10px] font-medium text-neutral-500">
            {name.slice(0, 1)}
          </span>
        )}
        <span className="truncate text-xs text-neutral-600 group-hover/by:text-neutral-900">
          {name}
        </span>
      </Link>

      {/* 분야는 첫 태그만 — 여러 개를 적으면 줄이 넘쳐 이름이 밀린다 */}
      {w.designer.tags[0] && (
        <span className="ml-auto shrink-0 text-[11px] text-neutral-400">{w.designer.tags[0]}</span>
      )}
    </div>
  )
}
