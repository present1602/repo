import Link from 'next/link'
import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { getPublicDesigner } from '@/lib/public-designers'
import { displayNameOf } from '@/lib/display-name'
import { getDesignerPremiums, getPlanCopies } from '@/lib/site-settings'
import { formatPrice, formatPriceRange, livePremium, LOGO_PRICE_MAX, type PlanText } from '@/lib/plans'
import { acceptsScope, SCOPES, type Scope } from '@/lib/scopes'
import { offersOf } from '@/lib/inquiry-types'
import { Img } from '@/components/img'
import { WorkGallery } from '@/components/work-gallery'
import { InquiryButton } from '@/components/inquiry/inquiry-button'

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
  /* 플랜 문구·프리미엄은 디자이너 조회를 기다릴 필요가 없어 동시에 받는다 */
  const [d, copies, premiums] = await Promise.all([
    getPublicDesigner(id),
    getPlanCopies(),
    getDesignerPremiums(id),
  ])
  if (!d) notFound()

  const name = displayNameOf(d)
  const plans = SCOPES.filter((s) => acceptsScope(d, s))

  /* 유형마다 기본 금액 — 메인 시안·로고는 "시작가 ~ 상한", 디자인 전체·프로젝트는 "N원~" */
  const basePrice: Record<Scope, { price: number; priceTo?: number }> = {
    sample: { price: d.design_price, priceTo: d.price_max },
    logo: { price: d.logo_price, priceTo: LOGO_PRICE_MAX },
    full_design: { price: d.full_design_price },
    with_dev: { price: d.project_price },
  }


  return (
    <div className="flex-1 bg-white">
      <div className="mx-auto max-w-7xl px-5 pb-16 md:px-12">
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

            {/* 작업 건수는 뺐다 — 올린 장수는 실력을 말해 주지 않는다.
                나중에 수행한 프로젝트 건수로 대체한다. */}
            {d.tags.length > 0 && (
              <dl className="mt-10 grid grid-cols-2 gap-x-8 gap-y-6 border-t border-neutral-200 pt-6 text-sm md:grid-cols-4">
                <Info k="전문 분야" v={d.tags.join(', ')} />
              </dl>
            )}

            <div className="mt-10">
              <InquiryButton
                designerId={d.id}
                designerName={name}
                offers={offersOf(d, { copies, premiums })}
              />
            </div>
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

        {plans.length > 0 && (
          <section className="border-t border-neutral-200 pt-10">
            {/* 디자이너가 받는 유형만, 의뢰 폼과 같은 차례로 한 줄에 두 장씩
                왼쪽부터 채운다 — 한 장뿐이어도 폭을 늘리지 않는다.
                이름·설명은 어드민 설정(036_plan_copy_premium.sql), 금액은
                메인 시안·로고는 디자이너가, 디자인 전체·프로젝트는 어드민이 정한다.
                프리미엄은 유형 전체·디자이너별 스위치가 모두 켜졌을 때만 붙는다. */}
            <div className="grid gap-3 md:grid-cols-2">
              {plans.map((s) => (
                <PlanCard
                  key={s}
                  badge={PLAN_BADGES[s]}
                  name={copies[s].basic.name}
                  desc={copies[s].basic.desc}
                  price={basePrice[s].price}
                  priceTo={basePrice[s].priceTo}
                  from={basePrice[s].priceTo == null}
                  premium={livePremium(copies, premiums, s) ?? undefined}
                />
              ))}
            </div>
          </section>
        )}
      </div>

    </div>
  )
}

/* 카드 이름 앞의 작은 표시 — 이 금액이 어느 유형의 것인지 */
const PLAN_BADGES: Record<Scope, string> = {
  sample: '메인시안',
  logo: '로고',
  full_design: '디자인',
  with_dev: '프로젝트',
}

/* 실제 화면과 같은 골격 — 프로필이 들어올 때 레이아웃이 튀지 않게 */
function DetailSkeleton() {
  return (
    <div className="flex-1 bg-white">
      <div className="mx-auto max-w-7xl px-5 pb-16 md:px-12">
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
/* priceTo 가 있으면 "시작가 ~ 상한" 범위로 적는다(016_price_range.sql).
   같은 금액이면 한쪽만 나온다 — formatPriceRange 가 처리한다. */
function PlanCard({
  badge,
  name,
  desc,
  price,
  priceTo,
  from,
  note,
  premium,
}: {
  /* 이름 앞에 붙는 작은 표시 — 이 금액이 무엇에 대한 값인지 */
  badge?: string
  name: string
  desc: string
  price: number
  priceTo?: number
  /* 상한 없이 "N원~" 으로 적는다 — 디자인 전체·프로젝트 */
  from?: boolean
  /* 금액 아래 덧붙이는 안내 — 시안 다음 단계의 금액 */
  note?: string
  /* 같은 유형의 프리미엄 — 기본 아래에 따로 묶어 보여준다 */
  premium?: PlanText & { price: number }
}) {
  return (
    <div className="rounded-xl bg-neutral-50 p-6 ring-1 ring-neutral-200">
      <p className="flex items-center gap-2 font-semibold">
        {badge && (
          <span className="rounded-md bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-700">
            {badge}
          </span>
        )}
        {name}
      </p>
      <p className="mt-2 text-2xl font-bold tracking-tight">
        {priceTo != null
          ? formatPriceRange(price, priceTo)
          : `${formatPrice(price)}${from ? '~' : ''}`}
      </p>
      {note && (
        <p className="mt-2">
          <span className="inline-block rounded-md bg-neutral-900 px-2 py-1 text-xs font-medium text-white">
            {note}
          </span>
        </p>
      )}
      <p className="mt-3 text-sm leading-relaxed text-neutral-600">{desc}</p>

      {premium && (
        <div className="mt-5 rounded-lg bg-white px-4 py-3.5 ring-1 ring-violet-200">
          <div className="flex items-center justify-between gap-3">
            <p className="flex min-w-0 items-center gap-2 text-sm font-semibold">
              <span className="shrink-0 rounded-full bg-violet-700 px-2 py-0.5 text-[11px] font-bold tracking-wide text-white">
                PREMIUM
              </span>
              <span className="truncate">{premium.name}</span>
            </p>
            <p className="shrink-0 font-bold">{formatPrice(premium.price)}~</p>
          </div>
          {premium.desc && (
            <p className="mt-1.5 text-[13px] leading-relaxed text-neutral-600">{premium.desc}</p>
          )}
        </div>
      )}
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
