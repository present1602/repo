'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { type FeaturedCandidate, thumbSrc } from '@/lib/portfolio-limits'
import { displayName } from '@/lib/display-name'
import { cropOf } from '@/lib/crop'
import { setWorkFeatured } from '@/app/admin/designers/actions'
import { Img } from '@/components/img'

type Notice = { kind: 'ok' | 'error'; text: string } | null

/* 메인에 걸어 둔 작업 — 어드민 첫 화면.

   홈(home-feed.tsx)과 같은 벽으로 보여준다. 디자이너별로 묶으면
   실제 메인에서 어떤 결로 깔리는지 알 수 없다 — 메인은 여러 디자이너의
   작업이 섞여 한 벽을 이루기 때문이다.

   masonry(columns)와 썸네일 비율 규칙도 홈과 같게 맞춘다.
   더하는 일은 /admin/featured/add 에서 한다. */
export function FeaturedList({ works }: { works: FeaturedCandidate[] }) {
  const [notice, setNotice] = useState<Notice>(null)

  if (works.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-neutral-300 py-16 text-center text-sm text-neutral-500">
        메인에 걸어 둔 작업이 없습니다.
        <br />
        <span className="text-xs text-neutral-400">
          고르지 않으면 메인은 최신순으로 채워집니다.
        </span>
        <br />
        <Link
          href="/admin/featured/add"
          className="mt-3 inline-block text-xs font-medium text-indigo-600 hover:text-indigo-800"
        >
          작업 고르러 가기 →
        </Link>
      </p>
    )
  }

  return (
    <section className="min-w-0">
      {notice && (
        <p
          className={`mb-4 rounded-lg px-3.5 py-3 text-sm ${
            notice.kind === 'ok' ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'
          }`}
        >
          {notice.text}
        </p>
      )}

      {/* 홈과 같은 벽 — 걸어 둔 차례대로 깔린다(featured_at 내림차순) */}
      <div className="columns-2 gap-3 md:columns-3 md:gap-4 lg:columns-4">
        {works.map((w) => (
          <WorkCard key={w.id} work={w} onNotice={setNotice} />
        ))}
      </div>

      <p className="mt-4 text-xs text-neutral-400">
        작업을 누르면 메인에서 뺍니다. 디자이너의 포트폴리오에서 사라지지는 않습니다.
      </p>
    </section>
  )
}

/* ─────────── 작업 한 장 ─────────── */

function WorkCard({ work: w, onNotice }: { work: FeaturedCandidate; onNotice: (n: Notice) => void }) {
  const [pending, start] = useTransition()
  const router = useRouter()

  const remove = () => {
    if (!confirm('이 작업을 메인에서 뺄까요?')) return

    onNotice(null)
    start(async () => {
      const r = await setWorkFeatured(w.id, false)
      if (!r.ok) {
        onNotice({ kind: 'error', text: r.error })
        return
      }
      router.refresh()
    })
  }

  /* 디자이너 쪽이 닫혀 있거나 본인이 숨겼으면 걸어 뒀어도 메인에 안 뜬다 —
     "왜 안 보이지" 로 헤매지 않게 카드에 적는다. */
  const blocked = !w.visible || !w.designer.visible || !w.designer.profile_public

  return (
    <article className="mb-3 break-inside-avoid md:mb-4">
      <button
        onClick={remove}
        disabled={pending}
        title="눌러서 메인에서 빼기"
        className="group relative block w-full overflow-hidden rounded-lg text-left ring-2 ring-indigo-600 transition disabled:opacity-50"
      >
        <Thumbnail work={w} />

        {blocked && (
          <span className="absolute left-2 top-2 rounded bg-neutral-900/80 px-1.5 py-0.5 text-[11px] text-white">
            메인에 안 뜸
          </span>
        )}

        {/* 평소에는 제목만, 올리면 '빼기' 가 함께 뜬다 */}
        <span className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-gradient-to-t from-black/70 to-transparent p-2">
          <span className="min-w-0 truncate text-[11px] text-white">{w.title ?? ' '}</span>
          <span className="shrink-0 rounded bg-white/90 px-1.5 py-0.5 text-[11px] font-medium text-neutral-900 opacity-0 transition group-hover:opacity-100">
            {pending ? '빼는 중…' : '빼기'}
          </span>
        </span>
      </button>

      {/* 누구 작업인지 — 홈의 Byline 과 같은 자리다 */}
      <div className="mt-2 flex items-center gap-2">
        <Link
          href={`/admin/designers/${w.designer.id}`}
          className="group/by flex min-w-0 items-center gap-2"
        >
          {w.designer.avatar_url ? (
            <Img
              src={w.designer.avatar_url}
              alt={displayName(w.designer)}
              className="size-5 shrink-0 rounded-full"
            />
          ) : (
            /* 아바타가 없어도 같은 자리를 차지해 줄 높이가 흔들리지 않게 한다 */
            <span className="grid size-5 shrink-0 place-items-center rounded-full bg-neutral-200 text-[10px] font-medium text-neutral-500">
              {displayName(w.designer).slice(0, 1)}
            </span>
          )}
          <span className="truncate text-xs text-neutral-600 group-hover/by:text-neutral-900">
            {displayName(w.designer)}
          </span>
        </Link>
      </div>
    </article>
  )
}

/* 썸네일 — 홈과 같은 규칙으로 자리를 잡는다.

   영역을 잡아 둔 작업은 그 비율로, 아니면 원본 비율로 깐다.
   thumb_url 은 이미 잘려 있으므로 여기서 다시 자르지 않는다. */
function Thumbnail({ work: w }: { work: FeaturedCandidate }) {
  const crop = cropOf(w)
  const ratio =
    crop && w.width && w.height
      ? (w.width * crop.w) / (w.height * crop.h)
      : w.width && w.height
        ? w.width / w.height
        : 4 / 3

  return (
    <span className="block" style={{ aspectRatio: `${ratio}` }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={thumbSrc(w)}
        alt={w.title ?? ''}
        loading="lazy"
        className={`size-full object-cover transition duration-500 group-hover:opacity-90 ${
          w.visible ? '' : 'opacity-40'
        }`}
      />
    </span>
  )
}
