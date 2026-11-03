import Link from 'next/link'
import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { getPublicDesigner } from '@/lib/public-designers'
import { displayNameOf } from '@/lib/display-name'
import {
  getDesignerOptionSetup,
  getDesignerPlanDetails,
  getDesignerPremiums,
  getDesignerPlanOptions,
  getPlanCopies,
  getShowDuration,
  listOptionTemplates,
} from '@/lib/site-settings'
import { designerChoices } from '@/lib/inquiry-choices'
import { panelEntries } from '@/lib/panel-entries'
import { listCategoryMetas } from '@/lib/specialties'
import { Img } from '@/components/img'
import { WorkGallery } from '@/components/work-gallery'
import { PlanPanel } from '@/components/plan-panel'
import { BioText } from '@/components/bio-text'

/* 공개 여부가 수시로 바뀌므로 캐시하지 않는다 — 비공개로 돌리면 곧 404 가 된다.
   "use cache" 를 쓰지 않으면 cacheComponents 아래에서 요청마다 새로 읽는다.
   목업 시절의 generateStaticParams 는 쓰지 않는다(미리 만들 수 없다). */

export async function generateMetadata(props: PageProps<'/designers/[id]'>) {
  const { id } = await props.params
  const d = await getPublicDesigner(id)

  if (!d) return { title: '디자이너를 찾을 수 없습니다 · SOOM' }

  return {
    title: `${displayNameOf(d)} · SOOM`,
    description: d.one_liner ?? undefined,
  }
}

/* 본문은 Suspense 뒤에서 읽는다 — 정적 셸이 먼저 나가고 내용이 이어 붙는다 */
export default function DesignerDetailPage(props: PageProps<'/designers/[id]'>) {
  return (
    <Suspense fallback={<DetailSkeleton />}>
      <DetailContent params={props.params} />
    </Suspense>
  )
}

async function DetailContent({ params }: { params: PageProps<'/designers/[id]'>['params'] }) {
  const { id } = await params
  /* 플랜 문구·프리미엄·기간은 디자이너 조회를 기다릴 필요가 없어 동시에 받는다 */
  const [d, copies, premiums, planDetails, showDuration, templates, planOptions, metas, optionSetup] =
    await Promise.all([
    getPublicDesigner(id),
    getPlanCopies(),
    getDesignerPremiums(id),
    getDesignerPlanDetails(id),
    getShowDuration(),
    listOptionTemplates({ designerId: id }),
    getDesignerPlanOptions(id),
    listCategoryMetas(),
    getDesignerOptionSetup(id),
  ])
  if (!d) notFound()

  const name = displayNameOf(d)

  /* 의뢰 패널 — 스튜디오 미리보기와 같은 계산(panel-entries.ts) */
  const choices = designerChoices(d, metas, { copies, premiums })
  const entries = panelEntries({
    choices,
    metas,
    copies,
    premiums,
    planDetails,
    showDuration,
    templates,
    planOptions,
    optionSetup,
  })

  return (
    <div className="flex-1 bg-white">
      <div className="mx-auto max-w-7xl px-5 pb-16 md:px-8">
        <nav className="py-5 text-sm text-neutral-500">
          <Link href="/explore" className="transition hover:text-neutral-900">
            ← 탐색으로
          </Link>
        </nav>

        {/* 머리 — 사진·이름·한 줄 소개를 한 줄로, 분야는 오른쪽 */}
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-200 pb-6">
          <div className="flex min-w-0 items-center gap-3.5">
            {d.avatar_url ? (
              <Img
                src={d.avatar_url}
                alt={name}
                ratio="aspect-square"
                focus="center"
                className="size-12 shrink-0 rounded-full md:size-14"
              />
            ) : (
              <div className="grid size-12 shrink-0 place-items-center rounded-full bg-neutral-100 text-lg font-semibold text-neutral-400 md:size-14">
                {name.slice(0, 1)}
              </div>
            )}
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-bold tracking-tight md:text-3xl">{name}</h1>
              {d.one_liner && <p className="mt-0.5 text-sm text-neutral-600">{d.one_liner}</p>}
            </div>
          </div>

          {d.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {d.tags.map((t) => (
                <span key={t} className="rounded-full bg-neutral-100 px-3 py-1 text-xs text-neutral-600">
                  {t}
                </span>
              ))}
            </div>
          )}
        </header>

        {/* 왼쪽 작업 · 오른쪽 의뢰 패널. 좁은 화면에서는 패널이 작업 위로 온다 —
            작업이 길면 의뢰할 자리를 찾아 끝까지 내려가야 한다 */}
        <div className="mt-8 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-10">
          <section className="min-w-0 lg:order-1">
            {/* 긴 소개글 — 왼쪽 칸 맨 위에 세 줄까지만. 머리 아래 통째로 두면
                패널과 작업이 화면 밖으로 밀린다 */}
            {d.bio && <BioText text={d.bio} />}

            <div className="mb-5 flex items-baseline justify-between">
              <h2 className="text-xl font-bold tracking-tight md:text-2xl">Selected Works</h2>
              {d.works.length > 0 && (
                <span className="text-xs text-neutral-500">{d.works.length}개의 작업</span>
              )}
            </div>
            <WorkGallery works={d.works} />
          </section>

          <aside className="min-w-0 lg:order-2">
            <PlanPanel
              designerId={d.id}
              designerName={name}
              choices={choices}
              entries={entries}
            />
          </aside>
        </div>
      </div>
    </div>
  )
}

/* 실제 화면과 같은 골격 — 프로필이 들어올 때 레이아웃이 튀지 않게 */
function DetailSkeleton() {
  return (
    <div className="flex-1 bg-white">
      <div className="mx-auto max-w-7xl px-5 pb-16 md:px-8">
        <div className="py-5">
          <div className="h-4 w-20 animate-pulse rounded bg-neutral-200" />
        </div>
        <div className="flex items-center gap-3.5 border-b border-neutral-200 pb-6">
          <div className="size-12 animate-pulse rounded-full bg-neutral-200 md:size-14" />
          <div className="space-y-2">
            <div className="h-7 w-40 animate-pulse rounded bg-neutral-200" />
            <div className="h-4 w-64 animate-pulse rounded bg-neutral-100" />
          </div>
        </div>
        <div className="mt-8 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-10">
          <div className="grid grid-cols-2 gap-4">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="aspect-[4/5] animate-pulse rounded-lg bg-neutral-200" />
            ))}
          </div>
          <div className="h-96 animate-pulse rounded-2xl bg-neutral-100" />
        </div>
      </div>
    </div>
  )
}
