import Link from 'next/link'
import { Suspense } from 'react'
import { HomeFeed } from '@/components/home-feed'
import { HomeCta } from '@/components/home-cta'
import { HtmlClass } from '@/components/html-class'
import { listRecentWorks } from '@/lib/public-designers'
import { DEFAULT_DESIGN_PRICE, formatPrice } from '@/lib/plans'

/* 홈에 띄우는 작업 수.

   지금은 "최신 40장"으로 고정한다. 어드민이 노출할 작업을 직접 고르는
   기능은 나중에 붙이고, 그때도 이 화면은 listRecentWorks 자리만 바뀐다. */
const FEED_LIMIT = 40

/* 히어로의 시작가 — 디자이너가 고를 수 있는 가장 낮은 디자인 플랜 금액이다.
   보기(plans.ts)가 바뀌면 여기도 자동으로 따라간다. 숫자를 직접 적으면
   가격표를 고친 뒤 홈만 옛 금액으로 남는다. */
const START_PRICE = DEFAULT_DESIGN_PRICE

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
          <Link
            href="/explore"
            className="shrink-0 text-sm text-neutral-500 transition hover:text-neutral-900"
          >
            전체 디자이너 →
          </Link>
        </div>

        {/* 피드는 캐시하지 않는다 — 디자이너가 작업을 올리거나 프로필을 숨기면
            곧 반영돼야 한다. 대신 Suspense 로 감싸 히어로가 먼저 나가게 한다
            (탐색 화면과 같은 방식). */}
        <Suspense fallback={<FeedSkeleton />}>
          <Feed />
        </Suspense>
      </section>

      {/* 작업을 쭉 본 뒤 바로 의뢰로 넘어가는 자리 — 푸터 바로 위에 둔다 */}
      <HomeCta price={START_PRICE} />
    </main>
  )
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
          <span className="size-1.5 rounded-full bg-white" /> LOW RISK
        </span>

        <h1 className="mt-6 text-3xl font-bold leading-tight tracking-tight text-balance md:text-6xl md:leading-[1.1]">
          메인 시안 먼저 의뢰 후,
          <br />
          본 계약을 진행할 수 있어요
        </h1>

        <p className="mt-6 text-4xl font-black tracking-tight text-violet-600 md:text-6xl">
          {START_PRICE.toLocaleString('ko-KR')}
          <span className="text-2xl md:text-3xl">원~</span>
        </p>

        <p className="mx-auto mt-8 max-w-xl text-base leading-relaxed text-neutral-600 md:text-lg">
          SOOM의 디자이너들은 AI의 효율적인 활용으로
          <br className="hidden md:block" /> 저렴한 비용으로{' '}
          <b className="font-semibold text-neutral-900">만족도 높은 퀄리티</b>와{' '}
          <b className="font-semibold text-neutral-900">빠른 제작기간</b>을 보장합니다.
        </p>

        <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            href="/explore"
            className="rounded-xl bg-neutral-900 px-7 py-4 text-sm font-semibold text-white transition hover:bg-violet-600"
          >
            디자이너 탐색하기
          </Link>
          {/* 같은 화면 안으로 내려가는 앵커다 — Link 로 바꾸면 라우터를 거쳐
              스크롤이 끊긴다. 브라우저 기본 동작(부드러운 스크롤은 globals.css)에 맡긴다. */}
          <a
            href="#works"
            className="rounded-xl border border-neutral-300 px-7 py-4 text-sm font-semibold transition hover:border-neutral-900"
          >
            포트폴리오 보기
          </a>
        </div>

        <ol className="mx-auto mt-14 grid max-w-2xl grid-cols-3 gap-2 text-left text-xs md:text-sm">
          {STEPS.map(([no, title, note]) => (
            <li key={no} className="rounded-xl bg-neutral-50 p-3 ring-1 ring-neutral-200 md:p-4">
              <p className="font-mono text-[11px] text-violet-600">{no}</p>
              <p className="mt-1 font-semibold">{title}</p>
              <p className="text-neutral-500">{note}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

const STEPS: [string, string, string][] = [
  ['01', '메인 시안 의뢰', `${formatPrice(START_PRICE)}~`],
  ['02', '시안 확인', '마음에 들면'],
  ['03', '본 계약 진행', '전체 작업'],
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
