import type { Metadata } from 'next'
import { Suspense } from 'react'
import { DesignerList } from '@/components/designer-list'
import { listPublicDesigners, collectTags } from '@/lib/public-designers'
import { listVisibleSpecialties } from '@/lib/specialties'

export const metadata: Metadata = {
  title: '탐색 · folio',
}

/* 목록은 캐시하지 않는다 — 디자이너가 프로필을 공개·비공개로 바꾸거나
   작업을 올리면 곧 반영돼야 한다. "use cache" 를 쓰지 않으면
   cacheComponents 아래에서 요청마다 새로 읽는다.

   대신 Suspense 로 감싸 정적 셸이 먼저 나가게 한다 —
   없으면 DB 응답을 기다리는 동안 화면이 빈 채로 멈춘다. */
export default function ExplorePage() {
  return (
    <Suspense fallback={<ExploreSkeleton />}>
      <ExploreContent />
    </Suspense>
  )
}

async function ExploreContent() {
  const [designers, managed] = await Promise.all([
    listPublicDesigners(),
    listVisibleSpecialties(),
  ])

  /* 어드민이 정한 목록을 쓴다(011_specialties.sql). 비어 있으면 —
     마이그레이션 전이거나 아직 하나도 등록하지 않았으면 — 지금까지처럼
     디자이너가 적어 둔 값을 모아 쓴다. 필터가 통째로 비는 것보다 낫다. */
  const tags = managed.length > 0 ? managed : collectTags(designers)

  return <DesignerList designers={designers} tags={tags} />
}

/* 실제 화면과 같은 골격으로 둔다 — 목록이 들어올 때 레이아웃이 튀지 않게 */
function ExploreSkeleton() {
  return (
    <div className="flex min-h-full bg-neutral-100">
      <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-60 shrink-0 border-r border-neutral-200 bg-white p-6 lg:block">
        <div className="h-3 w-16 animate-pulse rounded bg-neutral-200" />
        <div className="mt-4 space-y-2">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="h-7 animate-pulse rounded-md bg-neutral-100" />
          ))}
        </div>
      </aside>

      <main className="min-w-0 flex-1 px-4 py-6 md:px-8 md:py-8">
        <div className="h-8 w-48 animate-pulse rounded bg-neutral-200" />
        <div className="mt-6 space-y-4">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="overflow-hidden rounded-2xl bg-white ring-1 ring-neutral-200/70">
              <div className="flex items-center gap-3 p-4 md:p-5">
                <div className="size-11 shrink-0 animate-pulse rounded-full bg-neutral-200" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-32 animate-pulse rounded bg-neutral-200" />
                  <div className="h-3 w-56 animate-pulse rounded bg-neutral-100" />
                </div>
              </div>
              <div className="flex h-44 gap-2 px-4 pb-4 md:h-56 md:px-5 md:pb-5">
                {Array.from({ length: 4 }, (_, j) => (
                  <div key={j} className="h-full w-28 shrink-0 animate-pulse rounded-lg bg-neutral-200" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
