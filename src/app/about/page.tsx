import type { Metadata } from 'next'
import { HomeCta } from '@/components/home-cta'
import { DEFAULT_DESIGN_PRICE, formatPrice } from '@/lib/plans'

export const metadata: Metadata = {
  title: '소개',
  description:
    '전문 디자이너와 융합형 개발자가 AI를 활용해 만듭니다. 메인 시안을 먼저 받아 보고 본 계약을 결정하세요.',
  alternates: { canonical: '/about' },
}

/* 소개 한 장 — 누가 만드는지(디자인·개발), 어떻게 진행하는지(시안 → 계약).

   긴 설명보다 한눈에 읽히는 것을 앞세운다. 문단은 두 줄을 넘기지 않고,
   나머지는 체크 목록·단계·계산 한 줄로 보여준다.

   시안 시작가는 홈과 같이 plans.ts 에서 받는다 — 가격표가 바뀌면 같이 바뀐다. */
const START_PRICE = DEFAULT_DESIGN_PRICE

/* 본 계약 예시 금액 — 차감 계산을 보여주는 데만 쓴다 */
const SAMPLE_CONTRACT = 3_000_000

export default function AboutPage() {
  return (
    <main className="flex-1 bg-white">
      <Intro />
      <Team />
      <Process />
      <HomeCta price={START_PRICE} />
    </main>
  )
}

function Intro() {
  return (
    <section className="relative overflow-hidden">
      {/* 홈 히어로와 같은 보라 번짐 — 장식이다. 좁은 화면에서는 작게 둔다 —
          크면 구역 아래 끝에서 번짐이 칼로 자른 듯 끊긴다 */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-48 left-1/2 size-[26rem] -translate-x-1/2 rounded-full bg-violet-100/70 blur-3xl md:-top-40 md:size-[40rem]"
      />

      <div className="relative mx-auto max-w-3xl px-5 pb-14 pt-16 text-center md:pb-20 md:pt-24">
        <p className="text-xs font-bold tracking-[0.2em] text-violet-600">ABOUT SOOM</p>
        <h1 className="mt-5 text-3xl font-bold leading-tight tracking-tight text-balance md:text-5xl md:leading-[1.15]">
          같은 AI를 써도,
          <br />
          <span className="text-violet-600">누가 쓰느냐</span>가 다릅니다
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-neutral-600 md:text-lg">
          AI에만 기대 찍어낸 양산형 사이트가 늘고 있습니다.
          <br className="hidden md:block" /> SOOM은 <b className="font-semibold text-neutral-900">전문가가 기획</b>하고,
          AI로 <b className="font-semibold text-neutral-900">빠르고 합리적으로</b> 만듭니다.
        </p>
      </div>
    </section>
  )
}

/* 디자인과 개발, 두 축을 나란히 둔다 — 넓은 화면에서는 좌우, 좁으면 위아래 */
function Team() {
  return (
    <section className="mx-auto grid max-w-5xl gap-4 px-4 pb-20 md:grid-cols-2 md:gap-5 md:px-8 md:pb-28">
      <article className="rounded-3xl border border-violet-200 bg-gradient-to-b from-violet-50 to-white p-7 md:p-9">
        <p className="text-xs font-bold tracking-[0.2em] text-violet-600">DESIGN</p>
        <h2 className="mt-3 text-2xl font-bold tracking-tight">전문 디자이너 × AI</h2>
        <p className="mt-3 text-sm leading-relaxed text-neutral-600 md:text-base">
          브랜딩·UX 전문 디자이너의 감각으로
          <br /> 고객을 끌어오고 매출을 올리는 서비스를 만듭니다.
        </p>

        <ul className="mt-7 space-y-3">
          {DESIGN_POINTS.map((t) => (
            <li key={t} className="flex items-center gap-3 text-sm font-medium md:text-[15px]">
              <Check />
              {t}
            </li>
          ))}
        </ul>
      </article>

      <article className="rounded-3xl bg-neutral-950 p-7 text-white md:p-9">
        <p className="text-xs font-bold tracking-[0.2em] text-violet-300">DEVELOPMENT</p>
        <h2 className="mt-3 text-2xl font-bold tracking-tight">융합형 개발자가 리드</h2>
        <p className="mt-3 text-sm leading-relaxed text-neutral-300 md:text-base">
          기획 · PM · 풀스택 개발이 모두 가능한 개발자가 프로젝트를 이끕니다.
          예쁜 사이트를 넘어, <b className="font-semibold text-white">기능이 복잡한 프로젝트</b>도
          안정적으로 수행합니다.
        </p>

        <p className="mt-8 text-[11px] font-bold tracking-[0.2em] text-neutral-500">PROJECTS</p>
        {/* 회사 로고 파일이 없어 글자로 둔다 — 회색 한 톤으로 맞춰 어느 하나가 튀지 않게 */}
        <ul className="mt-3 grid grid-cols-2 gap-2">
          {CLIENTS.map(({ name, className }) => (
            <li
              key={name}
              className="grid h-12 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-neutral-300"
            >
              <span className={className}>{name}</span>
            </li>
          ))}
        </ul>
      </article>
    </section>
  )
}

const DESIGN_POINTS = [
  '목적에 맞춘 기획',
  '고객을 끄는 개성 있는 디자인',
  '디자인 시스템 기반 제작',
  '퀄리티를 지키는 합리적인 비용',
]

const CLIENTS = [
  { name: 'VISANG', className: 'text-sm font-black tracking-[0.15em]' },
  { name: 'Woolim', className: 'text-base font-bold italic tracking-tight' },
  { name: 'LG Electronics', className: 'text-sm font-semibold tracking-tight' },
  { name: 'KB Card', className: 'text-sm font-extrabold tracking-wide' },
]

/* 진행 순서와 결제 — 세 단계 아래에 "시안 비용은 차감"을 계산 한 줄로 붙인다 */
function Process() {
  return (
    <section className="border-t border-neutral-200 bg-neutral-50">
      <div className="mx-auto max-w-5xl px-4 py-20 md:px-8 md:py-28">
        <div className="text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-violet-600 px-3 py-1 text-xs font-semibold tracking-wide text-white">
            <span className="size-1.5 rounded-full bg-white" /> LOW RISK
          </span>
          <h2 className="mt-5 text-2xl font-bold leading-snug tracking-tight md:text-4xl">
            시안 먼저 보고,
            <br />
            믿음이 생기면 계약하세요
          </h2>
        </div>

        <ol className="mt-12 grid gap-3 md:grid-cols-3 md:gap-4">
          {STEPS.map(([no, title, note]) => (
            /* 좁은 화면에서는 숫자를 왼쪽에 두어 한 칸을 낮게 — 세 장이 한 화면에 들어온다 */
            <li
              key={no}
              className="flex items-center gap-5 rounded-2xl border border-neutral-200 bg-white px-6 py-5 md:block md:p-6"
            >
              <p className="w-10 shrink-0 font-serif text-3xl italic text-violet-600">{no}</p>
              <div className="md:mt-3">
                <p className="text-lg font-bold">{title}</p>
                <p className="mt-1 text-sm text-neutral-500">{note}</p>
              </div>
            </li>
          ))}
        </ol>

        {/* 차감 예시 — 슬라이더 없이 숫자 셋으로 끝낸다 */}
        <div className="mt-4 rounded-2xl border border-violet-200 bg-white p-6 md:p-8">
          <p className="text-sm font-bold">먼저 낸 시안 비용은 본 계약에서 차감됩니다</p>

          <div className="mt-5 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-neutral-500">
            <Amount label="본 계약" value={formatPrice(SAMPLE_CONTRACT)} />
            <span className="text-lg">−</span>
            <Amount label="시안 비용" value={formatPrice(START_PRICE)} />
            <span className="text-lg">=</span>
            <span className="text-2xl font-black tracking-tight text-violet-600 md:text-3xl">
              {formatPrice(SAMPLE_CONTRACT - START_PRICE)}
            </span>
          </div>

          <p className="mt-4 text-xs leading-relaxed text-neutral-400">
            * 예시 금액이며 실제 금액은 프로젝트마다 다릅니다. 본 계약 때 메인 시안을 새로
            만들면 차감 없이 전액 결제합니다.
          </p>
        </div>
      </div>
    </section>
  )
}

const STEPS: [string, string, string][] = [
  ['I', '메인 시안 의뢰', `${formatPrice(START_PRICE)}부터 부담 없이`],
  ['II', '시안 확인', '퀄리티와 소통 방식을 직접 확인'],
  ['III', '본 계약', '마음에 들 때만, 시안 비용은 차감'],
]

function Amount({ label, value }: { label: string; value: string }) {
  return (
    <span className="whitespace-nowrap">
      <span className="text-xs">{label} </span>
      <span className="text-base font-semibold text-neutral-800 md:text-lg">{value}</span>
    </span>
  )
}

function Check() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden className="size-5 shrink-0">
      <circle cx="10" cy="10" r="10" className="fill-violet-600" />
      <path d="m6 10.2 2.6 2.6L14 7.4" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
