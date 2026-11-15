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
      <section id="works" className="mx-auto max-w-7xl scroll-mt-14 px-4 pb-16 md:px-8 md:pb-20">
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
    <section className="relative overflow-hidden">
      {/* 뒤에 깔리는 보라색 번짐 — 장식이라 클릭을 먹지 않게 한다 */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 size-[44rem] -translate-x-1/2 rounded-full bg-violet-100/70 blur-3xl"
      />

      <div className="relative mx-auto max-w-4xl px-5 pb-16 pt-16 text-center md:pb-24 md:pt-28">
        <span className="inline-flex items-center gap-2 rounded-full bg-violet-600 px-3 py-1 text-xs font-semibold tracking-wide text-white">
          <span className="size-1.5 rounded-full bg-white" /> DESIGN &amp; DEV
        </span>

        <h1 className="mt-6 text-3xl font-bold leading-tight tracking-tight text-balance md:text-6xl md:leading-[1.1]">
          전문 디자이너가 디자인하고,
          <br />
          전문 개발자가 보증합니다
        </h1>

        <p className="mx-auto mt-8 max-w-xl text-base leading-relaxed text-neutral-600 md:text-lg">
          SOOM의 디자이너들은 AI의 효율적인 활용으로
          <br className="hidden md:block" /> 저렴한 비용으로{' '}
          <b className="font-semibold text-neutral-900">만족도 높은 퀄리티</b>와{' '}
          <b className="font-semibold text-neutral-900">빠른 제작기간</b>을 보장합니다.
        </p>

        {/* 가격표 — 두 가지라 세로로 쌓지 않고 가로로 나란히 세운다.
            금액이 주인공이므로 이름은 그 위에 작게 둔다. */}
        <dl className="mx-auto mt-10 grid max-w-xl gap-3 sm:grid-cols-2">
          {PRICES.map(({ label, price, was }) => (
            <div
              key={label}
              className="rounded-2xl border border-neutral-200 bg-white px-5 py-5 text-center"
            >
              <dt className="text-sm font-medium text-neutral-500">{label}</dt>
              <dd className="mt-1.5">
                <s className="text-sm font-medium tabular-nums text-neutral-400">
                  <span className="sr-only">할인 전 </span>
                  {was.toLocaleString('ko-KR')}원
                </s>
                <span className="mt-0.5 block text-2xl font-black tabular-nums tracking-tight text-violet-600 md:text-[1.75rem]">
                  {price.toLocaleString('ko-KR')}
                  <span className="ml-0.5 text-base font-bold md:text-lg">원~</span>
                </span>
              </dd>
            </div>
          ))}
        </dl>

        <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
          <ExploreLink className="rounded-xl bg-neutral-900 px-7 py-4 text-sm font-semibold text-white transition hover:bg-violet-600">
            디자이너 탐색하기
          </ExploreLink>
          {/* 같은 화면 안으로 내려가는 앵커다 — Link 로 바꾸면 라우터를 거쳐
              스크롤이 끊긴다. 브라우저 기본 동작(부드러운 스크롤은 globals.css)에 맡긴다. */}
          <a
            href="#works"
            className="rounded-xl border border-neutral-300 px-7 py-4 text-sm font-semibold transition hover:border-neutral-900"
          >
            포트폴리오 보기
          </a>
        </div>

        {/* SOOM 이 내세우는 세 가지. 예전에는 '시안 → 확인 → 본 계약' 순서였는데,
            그 흐름을 접었으므로 번호를 뗐다 — 이 셋은 차례가 아니라 동시에
            성립하는 조건이라 ol 이 아니라 ul 이다. */}
        <ul className="mx-auto mt-20 grid max-w-4xl gap-10 md:mt-24 md:grid-cols-3 md:gap-12">
          {POINTS.map(([title, note]) => (
            <li key={title} className="text-center">
              <p className="font-serif text-xl md:text-2xl">{title}</p>
              <p className="mx-auto mt-3 max-w-[16rem] text-sm leading-relaxed text-neutral-500">
                {note}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

const POINTS: [string, string][] = [
  ['전문 디자이너', '모든 홈페이지를 전문 디자이너가 직접 디자인합니다.'],
  ['전문 개발자 보증', '개발자가 코드와 기능을 검수해 안정성을 보증합니다.'],
  ['합리적인 비용', '디자이너 친화적 수익 모델로 플랫폼 수익을 낮췄습니다.'],
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
