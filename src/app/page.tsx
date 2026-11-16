import { Suspense } from 'react'
import { HomeFeed } from '@/components/home-feed'
import { HomeCta, type HomePrice } from '@/components/home-cta'
import { AgencyBanner } from '@/components/agency-banner'
import { HtmlClass } from '@/components/html-class'
import { ExploreLink } from '@/components/explore-gate'
import { PRE_LAUNCH } from '@/lib/pre-launch'
import { WorksTeaser } from '@/components/works-teaser'
import { listRecentWorks } from '@/lib/public-designers'
import { listActivePopups } from '@/lib/popups-db'
import { SitePopups } from '@/components/site-popup'
/* 홈에 띄우는 작업 수.

   지금은 "최신 40장"으로 고정한다. 어드민이 노출할 작업을 직접 고르는
   기능은 나중에 붙이고, 그때도 이 화면은 listRecentWorks 자리만 바뀐다. */
const FEED_LIMIT = 40

/* 히어로에 띄우는 시작가.

   예전에는 plans.ts 의 가장 낮은 디자인 플랜 금액(DEFAULT_DESIGN_PRICE)을
   그대로 썼지만, 그 금액은 '메인 시안 먼저' 플랜의 값이었다. 그 흐름을
   접으면서 홈이 내세우는 상품이 랜딩페이지·웹사이트 제작으로 바뀌었다.

   지금은 화면에 보여줄 안내 금액이라 여기 적어 둔다. 어드민에서 고치는
   값으로 옮길 때는 site-settings 에 칸을 만들어 이 상수를 대체한다.

   was 는 할인 전 금액이다 — 화면에서 줄을 그어 지금 금액 옆에 둔다. */
const PRICES: HomePrice[] = [
  { label: '랜딩페이지', price: 299_000, was: 490_000 },
  { label: '일반 웹사이트 제작', price: 790_000, was: 1_200_000 },
]

export default function Home() {
  return (
    <main className="flex-1 bg-white">
      {/* 히어로의 '작업 보기'(#works)가 부드럽게 내려가게 — 이 화면에서만 켠다 */}
      <HtmlClass names={['smooth-anchor']} />
      <Hero />

      {/* scroll-mt — 상단 헤더가 sticky 라 앵커로 내려오면 제목이 그 밑에 깔린다.
          헤더 높이(h-14 = 3.5rem)만큼 미리 띄워 둔다. */}
      <section id="works" className="mx-auto max-w-7xl scroll-mt-14 px-4 pt-16 pb-16 md:px-8 md:pb-20">
        <div className="mb-6 flex items-end justify-between gap-4">
          <h2 className="text-xl font-bold tracking-tight md:text-2xl">SOOM 디자이너들의 작업</h2>
          <ExploreLink className="shrink-0 text-sm text-neutral-500 transition hover:text-neutral-900">
            전체 디자이너 →
          </ExploreLink>
        </div>

        {/* 피드는 캐시하지 않는다 — 디자이너가 작업을 올리거나 프로필을 숨기면
            곧 반영돼야 한다. 대신 Suspense 로 감싸 히어로가 먼저 나가게 한다
            (탐색 화면과 같은 방식). */}
        {/* 공개 전에는 흐린 임시 이미지 위에 공개 예정 문구를 띄운다(works-teaser.tsx) */}
        {PRE_LAUNCH ? (
          <WorksTeaser />
        ) : (
          <Suspense fallback={<FeedSkeleton />}>
            <Feed />
          </Suspense>
        )}
      </section>

      {/* 작업을 쭉 본 뒤 바로 의뢰로 넘어가는 자리 — 푸터 바로 위에 둔다 */}
      <HomeCta prices={PRICES} />

      {/* 디자인이 아니라 개발을 찾아온 손님을 받는 자리 — 의뢰 띠 바로 아래,
          푸터 위에 둔다. 의뢰 띠 안에 섞으면 가격·버튼에 묻힌다. */}
      <AgencyBanner />

      {/* 팝업은 게시 기간을 현재 시각으로 거르므로 요청마다 묻는다 —
          화면을 막지 않도록 Suspense 뒤로 넘긴다 */}
      <Suspense fallback={null}>
        <Popups />
      </Suspense>
    </main>
  )
}

async function Popups() {
  const popups = await listActivePopups()
  return popups.length > 0 ? <SitePopups popups={popups} /> : null
}

async function Feed() {
  const works = await listRecentWorks(FEED_LIMIT)
  return <HomeFeed works={works} />
}

function Hero() {
  return (
    <section aria-labelledby="hero-title" className="relative isolate overflow-hidden bg-linear-to-b from-[#f6f3ff] via-[#fcfbff] to-white">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_15%_15%,rgb(221_214_254/0.45),transparent_50%),radial-gradient(ellipse_at_90%_45%,rgb(237_233_254/0.6),transparent_45%)]" />
      <div aria-hidden="true" className="pointer-events-none absolute -left-64 -top-96 -z-10 size-[40rem] rounded-full border border-white/80 bg-white/25 md:-left-40" />

      <div className="mx-auto max-w-6xl px-5 pb-14 pt-14 text-center md:px-8 md:pb-16 md:pt-20">
        <span className="inline-flex items-center gap-2 rounded-full border border-violet-200/70 bg-white/80 px-3.5 py-1.5 text-[11px] font-bold tracking-[0.08em] text-violet-700">
          <span className="size-1.5 rounded-full bg-violet-500" /> DESIGN &amp; DEV
        </span>

        <h1 id="hero-title" className="mt-6 text-[1.9rem] font-bold leading-[1.3] tracking-[-0.045em] text-neutral-900 sm:text-[2.75rem] md:text-[3.5rem] md:leading-[1.22]">
          전문 디자이너가 디자인하고,
          <br />
          <span className="text-violet-600">전문 개발자</span>가 보증합니다
        </h1>

        <p className="mx-auto mt-5 max-w-2xl text-sm leading-[1.8] text-neutral-500 md:text-base">
          SOOM의 디자이너들은 AI의 효율적인 활용으로
          <br className="hidden sm:block" /> 저렴한 비용으로{' '}
          <b className="font-semibold text-neutral-700">만족도 높은 퀄리티</b>와{' '}
          <b className="font-semibold text-neutral-700">빠른 제작기간</b>을 보장합니다.
        </p>

        <div className="mx-auto mt-8 max-w-[36rem] md:mt-9">
          <h2 className="inline-flex items-center gap-1.5 rounded-full border border-orange-200/70 bg-orange-50 px-3.5 py-1.5 text-sm font-bold text-[#ad5637]">
            <span aria-hidden="true" className="text-orange-400">✦</span>
            오픈 이벤트 특가
          </h2>

          <dl className="mt-4 grid grid-cols-2 gap-3 md:gap-4">
            {PRICES.map(({ label, price, was }) => (
              <div key={label} className="rounded-2xl border border-violet-100 bg-white/90 px-3 py-5 shadow-[0_8px_28px_-16px_rgb(109_40_217/0.18)] md:px-6 md:py-6">
                <dt className="text-xs font-semibold text-neutral-700 sm:text-sm">{label}</dt>
                <dd className="mt-2.5">
                  <s className="text-xs tabular-nums text-neutral-400 sm:text-sm">
                    <span className="sr-only">할인 전 </span>
                    {was.toLocaleString('ko-KR')}원
                  </s>
                  <span className="mt-1 block text-[1.6rem] font-extrabold tabular-nums tracking-tight text-violet-600 sm:text-3xl">
                    {price.toLocaleString('ko-KR')}
                    <span className="ml-0.5 text-xs font-semibold sm:text-sm">원~</span>
                  </span>
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row md:mt-7">
          <ExploreLink className="inline-flex items-center justify-center gap-3 rounded-xl bg-violet-600 px-6 py-3.5 text-sm font-semibold text-white shadow-[0_4px_12px_-4px_rgb(124_58_237/0.35)] transition hover:bg-violet-700 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-600">
            디자이너 탐색하기
            <span aria-hidden="true">→</span>
          </ExploreLink>
          <a href="#works" className="inline-flex items-center justify-center gap-3 rounded-xl border border-violet-200 bg-white/80 px-6 py-3.5 text-sm font-semibold text-neutral-700 transition hover:border-violet-400 hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-600">
            포트폴리오 보기
            <span aria-hidden="true">→</span>
          </a>
        </div>

        <ul className="mx-auto mt-12 grid max-w-5xl gap-5 border-t border-violet-100/80 pt-7 text-left md:mt-14 md:grid-cols-3 md:gap-0 md:pt-8">
          {POINTS.map(([title, note, path]) => (
            <li key={title} className="flex gap-3 md:px-6 md:not-first:border-l md:not-first:border-violet-100 md:first:pl-0 md:last:pr-0">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-violet-100/60 text-violet-600">
                <svg aria-hidden="true" width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d={path} />
                </svg>
              </span>
              <div>
                <p className="text-sm font-bold text-neutral-800 md:text-base">{title}</p>
                <p className="mt-1.5 max-w-[17rem] text-xs leading-relaxed text-neutral-500">{note}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

const POINTS: [string, string, string][] = [
  ['전문 디자이너', '모든 홈페이지를 전문 디자이너가 직접 디자인합니다.', 'm15 5 4 4 M4 20l4-1L20 7a2.8 2.8 0 0 0-4-4L4 15z'],
  ['전문 개발자 보증', '개발자가 코드와 기능을 검수해 안정성을 보증합니다.', 'm7 7-5 5 5 5 M17 7l5 5-5 5 M14 4l-4 16'],
  ['합리적인 비용', '디자이너 친화적 수익 모델로 플랫폼 수익을 낮췄습니다.', 'M20 6c0 2-3.6 3-8 3S4 8 4 6s3.6-3 8-3 8 1 8 3Z M4 6v6c0 2 3.6 3 8 3s8-1 8-3V6 M4 12v6c0 2 3.6 3 8 3s8-1 8-3v-6'],
]

/* 실제 피드와 같은 벽 모양으로 둔다 — 작업이 들어올 때 화면이 튀지 않게.
   높이를 번갈아 줘서 한 줄로 반듯한 회색 벽돌처럼 보이지 않게 한다. */
function FeedSkeleton() {
  return (
    <div className="columns-2 gap-3 md:columns-3 md:gap-4 lg:columns-4">
      {Array.from({ length: 12 }, (_, i) => (
        <div key={i} className="mb-3 break-inside-avoid md:mb-4">
          <div
            className={`animate-pulse rounded-xl bg-neutral-200 ${
              i % 3 === 0 ? 'aspect-[3/4]' : i % 3 === 1 ? 'aspect-square' : 'aspect-[1/1.8]'
            }`}
          />
          <div className="mt-2 flex items-center gap-2">
            <div className="size-5 shrink-0 animate-pulse rounded-full bg-neutral-200" />
            <div className="h-3 w-20 animate-pulse rounded bg-neutral-100" />
          </div>
        </div>
      ))}
    </div>
  )
}
