import { Suspense, type ReactNode } from 'react'
import { HomeFeed } from '@/components/home-feed'
import { HomeCta, type HomePrice } from '@/components/home-cta'
import { PriceStack } from '@/components/price-stack'
import { ABOUT_INQUIRY_CATEGORY, LANDING_INCLUDES, LANDING_PRICE, PREMIUM_PRICE, WEBSITE_PRICE } from '@/lib/landing-package'
import { AgencyBanner } from '@/components/agency-banner'
import { HtmlClass } from '@/components/html-class'
import { ExploreLink } from '@/components/explore-gate'
import { PRE_LAUNCH } from '@/lib/pre-launch'
import { WorksTeaser } from '@/components/works-teaser'
import { listRecentWorks } from '@/lib/public-designers'
import { listActivePopups } from '@/lib/popups-db'
import { SitePopups } from '@/components/site-popup'
import { AboutInquiryButton } from '@/components/about-inquiry-button'
import { HeroCollage } from '@/components/home/hero-collage'

/* 홈에 띄우는 작업 수.

   지금은 "최신 40장"으로 고정한다. 어드민이 노출할 작업을 직접 고르는
   기능은 나중에 붙이고, 그때도 이 화면은 listRecentWorks 자리만 바뀐다. */
const FEED_LIMIT = 40

/* 홈이 내세우는 상품 — 히어로 이벤트 띠·플랜 카드·의뢰 띠가 같이 쓴다.

   was 는 할인 전 금액(줄을 긋는다), price 는 정상가, caseDiscount 는 사례
   게재에 동의하면 더 깎아 주는 금액이다 — 최종가는 price - caseDiscount.
   오픈 이벤트 특가(히어로·의뢰 띠)에는 caseDiscount 가 있는 상품만 띄운다. */
const PRICES: HomePrice[] = [
  {
    label: '랜딩페이지 기본 플랜',
    /* 소개 화면 견적표와 같은 숫자를 쓴다(landing-package.ts) */
    ...LANDING_PRICE,
    startingAt: true,
    description: '가게 소개와 상담 문의를 한 페이지에 담는 원페이지 홈페이지입니다.',
    /* 포함 내용도 소개 화면 '랜딩페이지 기본형'과 같은 목록을 쓴다.
       다른 플랜 카드처럼 반응형 줄을 따로 둔다 — 첫 줄 바로 아래 */
    items: LANDING_INCLUDES.map((i): string => i.title).toSpliced(1, 0, '반응형 (PC·모바일)'),
  },
  {
    label: '일반 웹사이트/기업형 홈페이지',
    ...WEBSITE_PRICE,
    startingAt: true,
    description: '기업 홍보에 적합한 가장 일반적인 홈페이지입니다.',
    items: ['메인 시안 2종~3종', '고객분석을 반영한 디자인', '콘텐츠 관리 또는 예약 관리 등', '회원관리', '관리자페이지', '반응형 (PC·모바일)', '최대 30페이지', '1년 무상 배포·서버 관리'],
  },
  {
    label: '프리미엄 맞춤형 홈페이지',
    ...PREMIUM_PRICE,
    startingAt: true,
    description: '기획부터 기능까지 원하는 대로 맞춰 만드는 홈페이지입니다.',
    items: ['페이지수 제한 없음', '복잡한 기획/설계가 요구되는 작업', '특정 산업이나 분야에 대한 지식이 요구되는 특화된 기능 개발 가능', '50만원 상당의 상세페이지 디자인 쿠폰 제공'],
  },
]

const EVENT_PRICES = PRICES.filter((p) => p.caseDiscount != null)

/* 히어로 띠에서 상품 이름을 짧게 — 카드 제목은 그대로 둔다 */
const SHORT_LABEL: Record<string, string> = {
  '일반 웹사이트/기업형 홈페이지': '업체 웹사이트 · 기업형',
}

const wrap = 'mx-auto max-w-[1240px] px-5 md:px-8'

export default function Home() {
  return (
    <main className="flex-1 bg-paper text-ink">
      {/* 히어로의 '플랜과 가격 보기'(#plans)가 부드럽게 내려가게 — 이 화면에서만 켠다 */}
      <HtmlClass names={['smooth-anchor']} />
      <Hero />
      <Promises />

      {/* scroll-mt — 상단 헤더가 sticky 라 앵커로 내려오면 제목이 그 밑에 깔린다 */}
      <section id="works" aria-labelledby="works-title" className="scroll-mt-16 py-16 md:py-24">
        <div className={wrap}>
          <SectionHead
            eyebrow="Our designers' works"
            titleId="works-title"
            title="SOOM 디자이너들의 작업"
            accent="Find your mood."
            lede="업종과 분위기가 비슷한 작업을 먼저 살펴보고, 마음에 드는 디자이너에게 의뢰하세요."
            sideEnd
            side={
              <ExploreLink className="group inline-flex min-h-11 items-center gap-3 border border-ink px-4 text-[13px] font-semibold text-ink transition hover:bg-ink hover:text-paper">
                디자이너 보기
                <span aria-hidden="true" className="">→</span>
              </ExploreLink>
            }
          />

          {/* 피드는 캐시하지 않는다 — 디자이너가 작업을 올리거나 프로필을 숨기면
              곧 반영돼야 한다. 대신 Suspense 로 감싸 히어로가 먼저 나가게 한다.
              공개 전에는 흐린 임시 이미지 위에 공개 예정 문구를 띄운다(works-teaser.tsx) */}
          {PRE_LAUNCH ? (
            <WorksTeaser />
          ) : (
            <Suspense fallback={<FeedSkeleton />}>
              <Feed />
            </Suspense>
          )}
        </div>
      </section>

      <Process />
      <HomePlans />

      {/* 작업·플랜을 쭉 본 뒤 바로 의뢰로 넘어가는 자리 — 푸터 바로 위에 둔다 */}
      <HomeCta prices={EVENT_PRICES} />

      {/* 디자인이 아니라 개발을 찾아온 손님을 받는 자리 */}
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

/* 섹션 공통 머리말 — 왼쪽 제목(+ 이탤릭 영문), 오른쪽 설명 */
function SectionHead({
  eyebrow,
  titleId,
  title,
  accent,
  lede,
  side,
  sideEnd = false,
}: {
  eyebrow: string
  titleId: string
  title: string
  accent: string
  /* 제목(영문 한 줄) 바로 아래 설명 — 오른쪽 칸을 버튼만 두고 싶을 때 */
  lede?: string
  side?: ReactNode
  /* 넓은 화면에서 오른쪽 칸을 오른쪽 끝에 붙인다(버튼 하나만 둘 때) */
  sideEnd?: boolean
}) {
  return (
    <div className="mb-9 grid gap-4 md:mb-11 md:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] md:items-end md:gap-8">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2 id={titleId} className="mt-3.5 text-[clamp(1.6rem,3vw,2.35rem)] leading-[1.3] font-medium tracking-[-0.04em]">
          {title}
          <span className="serif-i block text-[1.3em] leading-[1.1]">{accent}</span>
        </h2>
        {lede && <p className="mt-4 max-w-[34em] text-sm leading-[1.85] text-ink-soft">{lede}</p>}
      </div>
      {side && (
        <div className={`grid justify-items-start gap-4 text-sm leading-[1.85] text-ink-soft ${sideEnd ? 'md:justify-items-end' : ''}`}>
          {side}
        </div>
      )}
    </div>
  )
}

function Hero() {
  return (
    <section aria-labelledby="hero-title" className="relative isolate overflow-hidden">
      {/* 오른쪽 위에서 아주 옅게 번지는 장밋빛 — 아이보리 바탕이 납작해 보이지 않게 */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_85%_20%,rgb(236_217_212/0.55),transparent_55%)]" />

      <div className={`${wrap} grid items-center gap-12 pb-12 pt-12 md:pt-16 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-14 lg:pb-16 lg:pt-20`}>
        <div>
          <p className="eyebrow">With AI efficiency</p>
          {/* 넓은 화면에서는 시안처럼 두 줄로 고정한다 — 글자 크기를 칸 폭에 맞춰 잡았다 */}
          <h1 id="hero-title" className="mt-5 text-[1.55rem] leading-[1.32] min-[400px]:text-[1.7rem] sm:text-[clamp(1.75rem,3.3vw,2.6rem)] font-medium tracking-[-0.045em] text-ink">
            <span className="sm:whitespace-nowrap">고객을 유입시키는</span>
            <br />
            <span className="sm:whitespace-nowrap">디자이너의 감각을 담은 홈페이지</span>
            <span className="serif-i mt-1 block text-[1.6em] leading-[1.1]">by designers,</span>
          </h1>

          <p className="mt-6 max-w-[32em] text-[15px] leading-[1.85] text-ink-soft md:text-base">
            SOOM의 디자이너들은 AI의 효율적인 활용으로
            <br className="hidden sm:block" /> 저렴한 비용으로 <b className="font-semibold text-ink">만족도 높은 퀄리티</b>와{' '}
            <b className="font-semibold text-ink">빠른 제작기간</b>을 보장합니다.
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <AboutInquiryButton
              category={ABOUT_INQUIRY_CATEGORY}
              className="border-transparent bg-linear-to-r from-[#4a2232] to-plum text-white shadow-[0_14px_30px_-16px_rgb(91_42_61/0.8)] hover:from-plum-deep hover:to-[#8f4762] sm:min-w-56"
            >
              디자인 상담 신청하기
            </AboutInquiryButton>
            <a
              href="#plans"
              className="inline-flex min-h-12 items-center justify-center border border-ink px-7 text-sm font-semibold text-ink transition hover:bg-ink hover:text-paper focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-plum sm:min-w-44"
            >
              플랜과 가격 보기
            </a>
          </div>
        </div>

        <div>
          <p className="eyebrow mb-5 lg:mb-6">Website for your studio</p>
          <HeroCollage />
        </div>
      </div>

      {/* 오픈 이벤트 특가 — 히어로 아래를 가로지르는 한 줄 */}
      <div className={wrap}>
        <dl className="grid gap-5 border-t border-line py-6 sm:grid-cols-2 lg:grid-cols-[auto_1fr_1fr] lg:items-center lg:gap-0 lg:py-7">
          <p className="flex items-center gap-2 text-[13px] font-semibold text-plum sm:col-span-2 lg:col-span-1 lg:pr-14">
            <span aria-hidden className="size-1.5 animate-pulse rounded-full bg-plum motion-reduce:animate-none" />
            오픈 이벤트 특가
          </p>
          {EVENT_PRICES.map((p) => (
            <div key={p.label} className="lg:px-10 lg:not-last:border-r lg:not-last:border-line">
              <dt className="text-[13px] text-ink-soft">{SHORT_LABEL[p.label] ?? p.label}</dt>
              <dd className="mt-1 flex flex-wrap items-baseline gap-x-3 tabular-nums">
                <s className="text-[13px] text-ink-faint decoration-ink-faint">
                  <span className="sr-only">정상가 </span>
                  {p.price.toLocaleString('ko-KR')}원
                </s>
                <span>
                  <b className="text-[1.75rem] font-semibold tracking-[-0.03em] text-ink">
                    {(p.price - (p.caseDiscount ?? 0)).toLocaleString('ko-KR')}
                  </b>
                  <small className="ml-0.5 text-[13px] text-ink-soft">원부터</small>
                </span>
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}

/* SOOM 의 약속 세 가지 — 히어로 바로 아래 가로 띠 */
function Promises() {
  return (
    <section aria-label="SOOM의 약속" className="border-y border-line">
      <ul className={`${wrap} grid md:grid-cols-3`}>
        {POINTS.map(([en, title, note]) => (
          <li key={title} className="grid gap-1.5 py-6 not-first:border-t not-first:border-line md:px-9 md:py-8 md:first:pl-0 md:not-first:border-t-0 md:not-first:border-l">
            <p className="flex items-baseline gap-2.5 text-base font-semibold tracking-[-0.02em]">
              <em className="font-serif text-lg font-medium text-plum">{en}</em>
              {title}
            </p>
            <p className="text-[13.5px] leading-[1.7] text-ink-soft">{note}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}

const POINTS: [string, string, string][] = [
  ['Design', '전문 디자이너', '모든 홈페이지를 전문 디자이너가 직접 디자인합니다.'],
  ['Code', '전문 개발자 보증', '개발자가 코드와 기능을 검수해 안정성을 보증합니다.'],
  ['Fair', '합리적인 비용', '디자이너 친화적 수익 모델로 플랫폼 수수료를 낮췄습니다.'],
]

/* 의뢰부터 오픈까지 — 네 단계 */
function Process() {
  return (
    <section id="process" aria-labelledby="process-title" className="scroll-mt-16 pb-16 md:pb-24">
      <div className={wrap}>
        <SectionHead
          eyebrow="How it works"
          titleId="process-title"
          title="의뢰부터 오픈까지"
          accent="Simple steps."
          side={<p>처음 홈페이지를 만드는 사장님도 어렵지 않게. 필요한 건 가게 이야기와 사진 몇 장이면 충분해요.</p>}
        />
        <ol className="grid border-t border-ink sm:grid-cols-2 sm:gap-y-7 lg:grid-cols-4">
          {STEPS.map(([title, note], i) => (
            <li key={title} className="grid grid-cols-[3.25rem_1fr] content-start gap-x-2 gap-y-1.5 border-b border-line py-5 sm:grid-cols-1 sm:gap-y-2 sm:border-b-0 sm:pt-6 sm:pr-6 sm:pb-0">
              <span className="row-span-2 font-serif text-[2.1rem] leading-none italic text-plum sm:row-span-1">0{i + 1}</span>
              <p className="text-base font-semibold tracking-[-0.02em]">{title}</p>
              <p className="col-start-2 text-[13.5px] leading-[1.75] text-ink-soft sm:col-start-1">{note}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

const STEPS: [string, string][] = [
  ['상담 문의', '업종과 원하는 분위기, 필요한 기능을 알려주세요.'],
  ['메인 시안 2~3종', '디자이너가 서로 다른 방향의 메인 시안을 보여드려요.'],
  ['수정과 개발', '고른 시안을 3회까지 다듬고, 개발자가 PC·모바일로 구현합니다.'],
  ['오픈과 1년 관리', '배포 후 1년 동안 서버 관리를 무상으로 맡아 드려요.'],
]

function HomePlans() {
  return (
    <section id="plans" aria-labelledby="plans-title" className="scroll-mt-16 bg-paper-2 py-16 md:py-24">
      <div className={wrap}>
        <SectionHead
          eyebrow="Plans"
          titleId="plans-title"
          title="홈페이지 제작 플랜"
          accent="Pick your fit."
          side={<p>필요한 구성과 기능을 확인해 보세요. 개발 범위에 따라 가격이 달라질 수 있어요.</p>}
        />

        {/* 카드마다 줄 수가 달라도 가격·설명·목록이 가로로 같은 높이에 오게 —
            넓은 화면에서는 각 카드를 부모 격자의 5줄에 걸치고(subgrid) 칸마다 요소를 둔다 */}
        <div className="grid max-w-[34rem] gap-5 lg:max-w-none lg:grid-cols-3 lg:gap-y-0">
          {PRICES.filter(({ items }) => items.length > 0).map(({ label, description, items, ...p }, i) => {
            const pick = i === 0
            return (
              <article
                key={label}
                className={`relative grid content-start border bg-card p-7 lg:row-span-5 lg:grid-rows-subgrid lg:gap-y-0 ${
                  pick ? 'border-plum shadow-[0_30px_60px_-40px_rgb(91_42_61/0.55)]' : 'border-line'
                }`}
              >
                {pick && <span className="absolute -top-px right-6 bg-plum px-2.5 py-1 text-[11px] font-semibold tracking-[0.06em] text-white">오픈 특가</span>}
                <div>
                  <h3 className="text-[17px] font-semibold tracking-[-0.02em]">{label}</h3>
                  <p className="mt-1.5 text-[13px] leading-[1.7] text-ink-soft">{description}</p>
                </div>
                <div className="mt-6 border-t border-line pt-5">
                  <PriceStack {...p} vat />
                </div>
                <ul className="mt-6 grid content-start gap-2.5 border-t border-line pt-5">
                  {items.map((item) => (
                    <li key={item} className="grid grid-cols-[14px_1fr] gap-2.5 text-[13.5px] leading-[1.6]">
                      <span aria-hidden className="mt-[0.8em] h-px w-2.5 bg-plum" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                {/* 카드마다 의뢰 — 웹사이트 개발 분야에 이 플랜 이름을 붙여 연다 */}
                <div className="mt-7 self-end">
                  <AboutInquiryButton
                    category={ABOUT_INQUIRY_CATEGORY}
                    product={label}
                    className={`w-full ${pick ? 'border-ink bg-ink text-paper hover:border-plum hover:bg-plum' : 'border-ink bg-transparent text-ink hover:bg-ink hover:text-paper'}`}
                  >
                    이 플랜으로 의뢰하기
                  </AboutInquiryButton>
                </div>
              </article>
            )
          })}
        </div>

        {/* 카드마다 두지 않고 여기 한 번만 */}
        <div className="mt-6 space-y-0.5 text-xs leading-relaxed text-ink-faint">
          <p>**개발 범위에 따라 가격이 달라집니다.</p>
          <p>추가 할인은 완성된 홈페이지를 SOOM 사례로 게재하는 데 동의하시면 적용되는 한시적 이벤트 할인입니다.</p>
        </div>
      </div>
    </section>
  )
}

/* 실제 피드와 같은 벽 모양으로 둔다 — 작업이 들어올 때 화면이 튀지 않게.
   높이를 번갈아 줘서 한 줄로 반듯한 회색 벽돌처럼 보이지 않게 한다. */
function FeedSkeleton() {
  return (
    <div className="columns-2 gap-3 md:columns-3 md:gap-4 lg:columns-4">
      {Array.from({ length: 12 }, (_, i) => (
        <div key={i} className="mb-3 break-inside-avoid md:mb-4">
          <div
            className={`animate-pulse bg-neutral-200 ${
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
