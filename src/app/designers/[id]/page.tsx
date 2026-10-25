import Link from 'next/link'
import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { getPublicDesigner } from '@/lib/public-designers'
import { displayNameOf } from '@/lib/display-name'
import { getPlanCopy } from '@/lib/site-settings'
import { formatPrice } from '@/lib/plans'
import { Img } from '@/components/img'
import { WorkGallery } from '@/components/work-gallery'
import { InquiryButtons } from '@/components/inquiry/inquiry-buttons'

/* 공개 여부가 수시로 바뀌므로 캐시하지 않는다 — 비공개로 돌리면 곧 404 가 된다.
   "use cache" 를 쓰지 않으면 cacheComponents 아래에서 요청마다 새로 읽는다.
   목업 시절의 generateStaticParams 는 쓰지 않는다(미리 만들 수 없다). */

export async function generateMetadata(props: PageProps<'/designers/[id]'>) {
  const { id } = await props.params
  const d = await getPublicDesigner(id)

  if (!d) return { title: '디자이너를 찾을 수 없습니다 · folio' }

  return {
    title: `${displayNameOf(d)} · folio`,
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
  const d = await getPublicDesigner(id)
  if (!d) notFound()

  /* 플랜 문구는 전역 설정 — 디자이너 조회와 함께 기다릴 필요가 없어 여기서 받는다 */
  const copy = await getPlanCopy()

  const name = displayNameOf(d)

  /* 폼을 띄우려면 상태가 필요하다 — 이 페이지는 서버 컴포넌트이므로
     버튼만 클라이언트 쪽으로 떼어 둔다 */
  const actions = <InquiryButtons designerName={name} />

  return (
    <div className="flex-1 bg-white">
      <div className="mx-auto max-w-7xl px-5 pb-28 md:px-12 md:pb-16">
        <nav className="py-5 text-sm text-neutral-500">
          <Link href="/explore" className="transition hover:text-neutral-900">
            ← 탐색으로
          </Link>
        </nav>

        <section className="grid gap-8 border-b border-neutral-200 pb-12 md:grid-cols-12 md:gap-10 md:pb-16">
          <div className="md:col-span-3">
            {d.avatar_url ? (
              <Img src={d.avatar_url} alt={name} ratio="aspect-[3/4]" className="w-40 rounded-2xl md:w-full" />
            ) : (
              /* 이미지가 없을 때도 같은 자리를 차지해 레이아웃이 흔들리지 않게 한다 */
              <div className="grid w-40 place-items-center rounded-2xl bg-neutral-100 text-5xl font-semibold text-neutral-300 aspect-[3/4] md:w-full">
                {name.slice(0, 1)}
              </div>
            )}
          </div>

          <div className="md:col-span-9 md:pl-6">
            <h1 className="text-4xl font-bold tracking-tight md:text-6xl">{name}</h1>

            {/* 긴 소개글이 있으면 그것을, 없으면 한 줄 소개로 대신한다 */}
            {d.bio ? (
              <p className="mt-6 max-w-2xl whitespace-pre-line text-base leading-relaxed text-neutral-600 md:text-lg">
                {d.bio}
              </p>
            ) : (
              d.one_liner && (
                <p className="mt-6 max-w-2xl text-base leading-relaxed text-neutral-600 md:text-lg">
                  {d.one_liner}
                </p>
              )
            )}

            {d.tags.length > 0 && (
              <div className="mt-6 flex flex-wrap gap-1.5">
                {d.tags.map((t) => (
                  <span key={t} className="rounded-md bg-neutral-100 px-2.5 py-1 text-xs text-neutral-600">
                    {t}
                  </span>
                ))}
              </div>
            )}

            <dl className="mt-10 grid grid-cols-2 gap-x-8 gap-y-6 border-t border-neutral-200 pt-6 text-sm md:grid-cols-4">
              <Info k="작업" v={`${d.works.length}건`} />
              {d.tags.length > 0 && <Info k="전문 분야" v={d.tags.join(', ')} />}
            </dl>

            <div className="mt-10 hidden md:block">{actions}</div>
          </div>
        </section>

        <section className="py-12 md:py-16">
          <div className="mb-8 flex items-baseline justify-between">
            <h2 className="text-2xl font-bold tracking-tight md:text-4xl">Selected Works</h2>
            {d.works.length > 0 && (
              <span className="text-xs text-neutral-500">{d.works.length}개의 작업</span>
            )}
          </div>
          <WorkGallery works={d.works} />
        </section>

        <section className="border-t border-neutral-200 pt-10">
          {/* 금액은 디자이너가 정하고, 이름·설명은 전역 설정에서 온다.
              프리미엄은 디자이너가 끌 수 있어 한 장만 나올 수 있다 —
              그때는 한 칸을 비우지 않고 폭을 채운다. */}
          <div className={`grid gap-3 ${d.premium_enabled ? 'md:grid-cols-2' : ''}`}>
            <PlanCard
              name={copy.design_plan_name}
              desc={copy.design_plan_desc}
              price={d.design_price}
            />
            {d.premium_enabled && (
              <PlanCard
                name={copy.premium_plan_name}
                desc={copy.premium_plan_desc}
                price={d.premium_price}
              />
            )}
          </div>
        </section>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-neutral-300 bg-white/95 p-4 backdrop-blur md:hidden">
        {actions}
      </div>
    </div>
  )
}

/* 실제 화면과 같은 골격 — 프로필이 들어올 때 레이아웃이 튀지 않게 */
function DetailSkeleton() {
  return (
    <div className="flex-1 bg-white">
      <div className="mx-auto max-w-7xl px-5 pb-28 md:px-12 md:pb-16">
        <div className="py-5">
          <div className="h-4 w-20 animate-pulse rounded bg-neutral-200" />
        </div>
        <section className="grid gap-8 border-b border-neutral-200 pb-12 md:grid-cols-12 md:gap-10 md:pb-16">
          <div className="md:col-span-3">
            <div className="w-40 animate-pulse rounded-2xl bg-neutral-200 aspect-[3/4] md:w-full" />
          </div>
          <div className="space-y-6 md:col-span-9 md:pl-6">
            <div className="h-12 w-64 animate-pulse rounded bg-neutral-200 md:h-16" />
            <div className="space-y-2">
              <div className="h-4 w-full max-w-2xl animate-pulse rounded bg-neutral-100" />
              <div className="h-4 w-4/5 max-w-2xl animate-pulse rounded bg-neutral-100" />
            </div>
          </div>
        </section>
        <section className="py-12 md:py-16">
          <div className="h-8 w-56 animate-pulse rounded bg-neutral-200" />
          <div className="mt-8 columns-2 gap-4 md:columns-3 md:gap-8">
            {Array.from({ length: 6 }, (_, i) => (
              <div
                key={i}
                className="mb-8 animate-pulse rounded-lg bg-neutral-200 aspect-[9/16] md:mb-12"
              />
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}

/* 공개 화면의 플랜 한 장 — 이름·설명은 전역 설정, 금액은 디자이너가 정한다 */
function PlanCard({ name, desc, price }: { name: string; desc: string; price: number }) {
  return (
    <div className="rounded-xl bg-neutral-50 p-6 ring-1 ring-neutral-200">
      <p className="font-semibold">{name}</p>
      <p className="mt-2 text-2xl font-bold tracking-tight">{formatPrice(price)}</p>
      <p className="mt-3 text-sm leading-relaxed text-neutral-600">{desc}</p>
    </div>
  )
}

function Info({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-xs text-neutral-500">{k}</dt>
      <dd className="mt-1 text-lg">{v}</dd>
    </div>
  )
}
