import type { Metadata } from 'next'
import { AboutInquiryButton } from '@/components/about-inquiry-button'
import { DeviceMockup } from '@/components/about/device-mockup'
import { EstimateBuilder } from '@/components/about/estimate-builder'
import Image from 'next/image'
import appShot from '@/assets/about/app-nople.png'
import { ServiceTabs } from '@/components/about/service-tabs'
import { DetailShowcase } from '@/components/about/detail-showcase'
import {
  APP_INQUIRY_CATEGORY,
  DETAIL_INQUIRY_CATEGORY,
} from '@/lib/landing-package'
import { ABOUT_INQUIRY_CATEGORY, SITE_KINDS, ESTIMATE_EVENT_LABEL, LANDING_INCLUDES, LANDING_PRICE, SAMPLE_SITE_URL, won } from '@/lib/landing-package'

export const metadata: Metadata = {
  title: '소개',
  description: '전문 디자이너의 감각에 개발자의 교육과 검수를 더합니다. SOOM의 디자인, 비용, 개발에 대한 세 가지 약속을 소개합니다.',
  alternates: { canonical: '/about' },
}

const container = 'mx-auto max-w-[1200px] px-5 md:px-10'
const eyebrow = 'text-[11px] font-semibold tracking-[0.18em] text-violet-600'

/* description 은 문단 배열이다 — 한 칸이 한 문단으로 나간다.
   예전에는 한 줄에 <br/> 를 적었는데, React 는 문자열 안의 태그를 글자
   그대로 그리므로 화면에 "<br/>" 이 보였다. 줄을 나누려면 여기서 쪼갠다. */
const PROMISES = [
  {
    label: 'DESIGN',
    title: '브랜드의 개성을 담습니다.',
    description: [
      '전문 디자이너가 브랜드와 상품, 고객을 이해하고 화면을 설계합니다.',
      '보기 좋은 디자인에서 한 걸음 더 나아가, 문의와 구매로 이어지는 경험을 고민합니다.',
    ],
    detail: '브랜드 · 타겟 · 사용자 경험',
  },
  {
    label: 'PRICE',
    title: '비용은 합리적으로.',
    description: [
      'SOOM은 디자이너 친화적 수익모델로 디자이너에게 프로젝트(디자인 + 개발) 의뢰 건은 최소 50% 이상, 디자인 의뢰 건은 90% 이상의 수익을 배분합니다.',
      '플랫폼 수수료도 낮추고 ai 효율적 활용을 장려해 비용을 낮춥니다.',
    ],
    detail: '효율적인 제작 · 낮은 수수료',
  },
  {
    label: 'DEVELOPMENT',
    title: '완성도를 보장합니다.',
    description: [
      '리드개발자가 꼼꼼히 코드품질과 기능을 검수하고 코드를 개선해 클라이언트에게 전달합니다.',
    ],
    detail: '코드 품질 보장',
  },
]

const RESPONSIBILITIES = [
  {
    title: '심사를 거친 디자이너',
    description: [
      'SOOM의 디자이너는 심사를 거쳐 등록됩니다.',
      '심사를 통과한 전문 디자이너가 프로젝트를 진행합니다.',
    ],
  },
  {
    title: 'SOOM이 책임지는 결과물',
    description: [
      'SOOM은 디자이너와 고객을 연결하는 단순 중개 플랫폼이 아닙니다.',
      '결과물의 품질을 직접 확인하고, SOOM이 책임지고 보장합니다.',
    ],
  },
  {
    title: '사후 관리도 SOOM이 직접',
    description: [
      '제작이 끝난 뒤에도 SOOM이 사후 관리의 주체가 됩니다.',
      '필요한 소통과 관리를 직접 이끌며, 완성 이후까지 책임 있게 함께합니다.',
    ],
  },
]

const STEPS = [
  {
    title: '의뢰·상담 & 디자이너 선정',
    description: '필요한 작업과 브랜드의 방향을 함께 정리합니다.\n디자이너를 직접 선택해 의뢰도 가능합니다.',
  },
  { title: '디자인 · 개발', description: '전문 디자이너가 AI를 활용해 화면과 기능을 구현합니다.' },
  { title: '검수 · 배포', description: '개발자의 코드·기능 검수를 거쳐 서비스를 공개합니다.' },
]

export default function AboutPage() {
  return (
    <main className="flex-1 bg-white text-neutral-950">
      <section aria-labelledby="about-title" className="bg-[#f5f4ef]">
        <div className={`${container} py-16 md:py-24`}>
          <p className={eyebrow}>ABOUT SOOM</p>
          <div className="mt-7 grid gap-8 lg:grid-cols-[1.4fr_1fr] lg:items-end lg:gap-16">
            <h1 id="about-title" className="text-[clamp(1.75rem,3.2vw,2.25rem)] font-bold leading-[1.35] tracking-[-0.04em] text-balance">
              전문 디자이너의 <span className="text-violet-600">감각적인 디자인</span>에 더해
              <br />
              전문 개발자가 <span className="text-violet-600">신뢰를 보장</span>합니다.
            </h1>
            <div>
              {/* <p className="text-base font-semibold leading-relaxed md:text-lg">
                전문 디자이너가 만들고,
                <br />
                개발자가 함께 완성합니다.
              </p> */}
              <p className="mt-4 max-w-md text-[15px] leading-[1.85] text-neutral-600">
                AI가 만드는 속도에 전문가의 기획과 브랜딩 감각을 녹여냅니다.<br/>
                회사와 고객특성을 잘 반영한 <span className="text-violet-600">고객을 끌어드리는 감각적인 웹사이트 제작을 합리적인 비용</span>으로 의뢰하세요.
              </p>
            </div>
          </div>
          <div className="mt-10 flex flex-wrap items-center gap-5 md:mt-12 md:gap-8">
            <AboutInquiryButton category={ABOUT_INQUIRY_CATEGORY} />
          </div>
        </div>
      </section>

      <section id="about-promises" aria-labelledby="promises-title" className="scroll-mt-24">
        <div className={`${container} py-16 md:py-20`}>
          <p className={eyebrow}>OUR PROMISES</p>
          <h2 id="promises-title" className="mt-4 text-[clamp(1.625rem,2.6vw,2.25rem)] font-bold leading-snug tracking-[-0.035em]">
            좋은 결과를 위한 세 가지 약속
          </h2>
          <div className="mt-10 grid gap-8 md:grid-cols-3 md:gap-10">
            {PROMISES.map((promise, index) => (
              <article key={promise.label} className="flex min-w-0 flex-col border-t border-neutral-200 pt-6">
                <p className="flex items-baseline justify-between gap-3 text-[11px] font-medium tracking-[0.12em] text-neutral-500">
                  {promise.label}
                  <span className="font-mono text-violet-600">0{index + 1}</span>
                </p>
                <h3 className="mt-5 text-xl font-bold leading-snug tracking-tight">{promise.title}</h3>
                {/* 문단마다 <p> 를 따로 둔다 — 두 번째 문단부터 위에 간격을 준다 */}
                <div className="mt-4 space-y-3 text-[15px] leading-[1.85] text-neutral-600">
                  {promise.description.map((line) => (
                    <p key={line}>{line}</p>
                  ))}
                </div>
                <p className="mt-auto pt-6 text-xs font-medium text-violet-700">{promise.detail}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <LandingPackage />
      {/* 의뢰 유형 탭은 세 구역을 감싼 이 안에서만 따라 내려온다 */}
      <div className="relative">
        <ServiceTabs />
        <div id="service-website" className="scroll-mt-32">
          <AddOns />
        </div>
        <AppDesign />
        <DetailDesign />
      </div>

      <section aria-labelledby="about-process-title" className="border-y border-neutral-200 bg-[#f8f8fa]">
        <div className={`${container} py-16 md:py-20`}>
          <div className="grid gap-5 lg:grid-cols-2 lg:items-end lg:gap-16">
            <div>
              <p className={eyebrow}>HOW WE WORK</p>
              {/* <h2 id="about-process-title" className="mt-4 text-[clamp(1.625rem,2.6vw,2.25rem)] font-bold leading-snug tracking-[-0.035em]">
                의뢰부터, 완성까지.
              </h2> */}
            </div>
            {/* <p className="max-w-md text-[15px] leading-[1.85] text-neutral-600">
              브랜드에 맞는 디자이너를 찾는 일부터 시작합니다.
              방향을 맞춘 뒤 디자인과 개발, 검수까지 이어갑니다.
            </p> */}
          </div>
          <ol className="mt-10 grid gap-x-8 gap-y-7 md:grid-cols-3">
            {STEPS.map((step, index) => (
              <li key={step.title} className="border-t border-neutral-300 pt-5">
                <p className="font-mono text-[11px] tracking-wide text-violet-600">STEP 0{index + 1}</p>
                <h3 className="mt-3 text-lg font-bold">{step.title}</h3>
                <p className="mt-2 whitespace-pre-line text-sm leading-[1.85] text-neutral-600">{step.description}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section aria-labelledby="about-responsibility-title" className="bg-[#19172a] text-white">
        <div className={`${container} py-16 md:py-20`}>
          <p className="text-[11px] font-semibold tracking-[0.18em] text-violet-300">THE SOOM STANDARD</p>

          <h2
            id="about-responsibility-title"
            className="mt-4 max-w-3xl text-[clamp(1.5rem,2.6vw,2.125rem)] font-bold leading-[1.45] tracking-[-0.035em]"
          >
            디자이너 선정부터 사후 관리까지,
            <br />
            SOOM이 책임집니다.
          </h2>

          <div className="mt-10 grid gap-x-10 gap-y-8 md:mt-12 md:grid-cols-3">
            {RESPONSIBILITIES.map((item, index) => (
              <article key={item.title} className="min-w-0 border-t border-white/20 pt-6">
                <p className="font-mono text-[11px] tracking-wide text-violet-300">
                  0{index + 1}
                </p>
                <h3 className="mt-3 text-lg font-bold leading-snug tracking-tight">{item.title}</h3>
                <div className="mt-3 space-y-3 text-[15px] leading-[1.85] text-white/70">
                  {item.description.map((line) => (
                    <p key={line}>{line}</p>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  )
}

/* 랜딩페이지 기본형 — 샘플 사이트 목업 + 포함 내용 + 가격.
   가격 숫자는 홈 가격 카드와 같은 곳(landing-package.ts)에서 온다. */
function LandingPackage() {
  const final = LANDING_PRICE.price - LANDING_PRICE.caseDiscount
  return (
    <section id="landing-package" aria-labelledby="landing-package-title" className="scroll-mt-24 border-t border-neutral-200 bg-[#f5f4ef]">
      <div className={`${container} py-16 md:py-24`}>
        <p className={eyebrow}>LANDING PACKAGE</p>
        <div className="mt-4 grid gap-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-center lg:gap-16">
          {/* 목업 — 넓은 화면에서는 오른쪽 글보다 먼저 눈에 들어오게 왼쪽에 */}
          <div className="order-2 lg:order-1">
            <DeviceMockup />
            <div className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-3">
              <a
                href={SAMPLE_SITE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex min-h-11 items-center gap-2 rounded-full border border-neutral-900 bg-neutral-900 px-5 text-sm font-semibold text-white transition hover:bg-neutral-700 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-500"
              >
                View sample web
                <span aria-hidden className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5">↗</span>
                <span className="sr-only">(새 창)</span>
              </a>
              <span className="text-xs text-neutral-500">샘플 · 결 스페이스 (건축·인테리어 스튜디오)</span>
            </div>
          </div>

          <div className="order-1 lg:order-2">
            <h2 id="landing-package-title" className="text-[clamp(1.75rem,3vw,2.5rem)] font-bold leading-tight tracking-[-0.04em]">
              랜딩페이지 <span className="text-violet-600">기본형</span>
            </h2>
            <p className="mt-3 text-[15px] leading-[1.85] text-neutral-600">
              브랜드를 소개하고 문의를 받는 한 페이지 웹사이트.
              <br className="hidden sm:block" /> 이것만으로 바로 시작할 수 있습니다.
            </p>

            <ul className="mt-7 grid gap-x-6 gap-y-4 sm:grid-cols-2">
              {LANDING_INCLUDES.map((item) => (
                <li key={item.title} className="flex gap-3">
                  <span aria-hidden className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-violet-600 text-[10px] font-bold text-white">✓</span>
                  <div>
                    <p className="text-sm font-bold leading-snug text-neutral-900">{item.title}</p>
                    <p className="mt-1 text-[12.5px] leading-relaxed text-neutral-500">{item.note}</p>
                  </div>
                </li>
              ))}
            </ul>

            {/* 가격 — 정상가를 크게, 이벤트 할인은 아래에 한 단계 작게(견적표와 같은 문구) */}
            <div className="mt-8 rounded-3xl bg-white p-6 shadow-[0_12px_40px_-24px_rgb(60_40_120/0.35)] ring-1 ring-neutral-200/70">
              <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
                <div>
                  <p className="text-xs font-medium text-neutral-500">
                    <s className="tabular-nums text-neutral-400">
                      <span className="sr-only">할인 전 </span>최소 {won(LANDING_PRICE.was)}~
                    </s>
                  </p>
                  <p className="mt-1 text-[2.25rem] font-extrabold leading-none tracking-tight tabular-nums text-neutral-900">
                    {LANDING_PRICE.price.toLocaleString('ko-KR')}
                    <span className="ml-1 text-base font-bold">원~</span>
                  </p>
                </div>
                <p className="text-xs text-neutral-400">VAT 별도</p>
              </div>

              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-violet-50 px-4 py-3.5 ring-1 ring-inset ring-violet-100">
                <p className="flex min-w-0 items-start gap-1.5 text-xs font-semibold leading-snug text-violet-700">
                  <span aria-hidden className="text-orange-400">✦</span>
                  {ESTIMATE_EVENT_LABEL}
                </p>
                <p className="text-2xl font-extrabold tracking-tight tabular-nums text-violet-600">
                  {final.toLocaleString('ko-KR')}
                  <span className="ml-0.5 text-sm font-bold">원~</span>
                </p>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <AboutInquiryButton category={ABOUT_INQUIRY_CATEGORY} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/* 앱디자인/개발 — 화면만이 아니라 UX 설계부터 한다는 점을 실제 작업 한 장으로 보여 준다 */
function AppDesign() {
  return (
    <section
      id="service-app"
      aria-labelledby="service-app-title"
      className="scroll-mt-32 overflow-hidden border-t border-neutral-200 bg-[#f4f3fb]"
    >
      <div className={`${container} grid items-center gap-10 py-16 md:py-24 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-16`}>
        <div>
          <p className={eyebrow}>APP DESIGN · DEVELOPMENT</p>
          <h2
            id="service-app-title"
            className="mt-4 text-[clamp(1.75rem,3vw,2.5rem)] font-bold leading-tight tracking-[-0.04em]"
          >
            앱디자인/개발
          </h2>
          <p className="mt-5 max-w-md text-[17px] font-semibold leading-relaxed text-neutral-800 md:text-lg">
            단순한 화면 디자인이 아닌,
            <br />
            <span className="text-violet-600">UX 설계 경험이 있는 전문 디자이너</span>가 디자인합니다.
          </p>
          {/* 개발 방식 — 디자인 문장보다 한 단계 낮춰 덧붙인다 */}
          <p className="mt-4 flex max-w-md items-start gap-2.5 text-[15px] leading-relaxed text-neutral-600">
            <span aria-hidden className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-md bg-violet-600 font-mono text-[9px] font-bold text-white">
              {'</>'}
            </span>
            <span>
              크로스플랫폼 앱개발(리액트네이티브)과 웹뷰 방식 혼합으로
              유연하고 효율적으로 개발합니다.
            </span>
          </p>
          <div className="mt-8">
            <AboutInquiryButton category={APP_INQUIRY_CATEGORY} />
          </div>
        </div>

        <figure className="relative mx-auto w-4/5 max-w-[460px] lg:w-full">
          {/* 휴대폰 뒤에 은은한 보라 빛 — 배경과 사진의 경계를 지운다 */}
          <div
            aria-hidden
            className="absolute inset-[6%] rounded-full bg-[radial-gradient(circle,rgb(124_58_237/0.2),transparent_70%)] blur-2xl"
          />
          <Image
            src={appShot}
            alt="여행 앱 NO:PLE 의 홈 화면과 로그인 화면 디자인"
            sizes="(min-width: 1024px) 460px, 80vw"
            className="relative h-auto w-full drop-shadow-[0_30px_40px_rgb(25_23_42/0.18)]"
          />
          <figcaption className="relative mt-3 text-center text-[11.5px] text-neutral-500">
            예) NO:PLE — 여행 일정 앱
          </figcaption>
        </figure>
      </div>
    </section>
  )
}

/* 상세페이지 디자인 — 왼쪽 글, 오른쪽 그림 무대(케이스 두 장 + 모션배너, detail-showcase.tsx).

   좁은 화면 차례: 글 → 그림 무대 → 의뢰 버튼(order).
   글 묶음은 좁은 화면에서 contents 로 풀려 그 안의 버튼만 맨 아래로 내려간다 */
function DetailDesign() {
  return (
    <section
      id="service-detail"
      aria-labelledby="service-detail-title"
      className="scroll-mt-32 overflow-hidden border-t border-neutral-200 bg-[#fbf7f8]"
    >
      <div className={`${container} grid gap-10 py-16 md:py-24 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:items-center lg:gap-12`}>
        <div className="contents lg:block">
          <div className="order-1">
            <p className={eyebrow}>DETAIL PAGE</p>
            <h2
              id="service-detail-title"
              className="mt-4 text-[clamp(1.75rem,3vw,2.5rem)] font-bold leading-tight tracking-[-0.04em]"
            >
              상세페이지 디자인
            </h2>
            <p className="mt-5 max-w-md text-[17px] font-semibold leading-relaxed text-neutral-800 md:text-lg">
              제품의 매력을 한눈에 담은 상세페이지부터,
              <br />
              <span className="text-violet-600">다이나믹한 모션배너</span>까지 의뢰할 수 있습니다.
            </p>
            <ul className="mt-5 flex flex-wrap gap-2">
              {['상세페이지', '썸네일', '모션배너'].map((t) => (
                <li key={t} className="rounded-full border border-violet-100 bg-white px-3 py-1 text-xs font-semibold text-violet-700">
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="order-3 lg:mt-8">
            <AboutInquiryButton category={DETAIL_INQUIRY_CATEGORY} />
          </div>
        </div>

        <div className="order-2 mx-auto w-full max-w-md lg:max-w-none">
          <DetailShowcase />
        </div>
      </div>
    </section>
  )
}

/* 추가 기능 — 기본형 위에 필요한 것만 더하는 구조를 견적표로 보여 준다 */
function AddOns() {
  return (
    <section id="add-ons" aria-labelledby="add-ons-title" className="scroll-mt-32 bg-white">
      <div className={`${container} py-16 md:py-24`}>
        <p className={eyebrow}>ADD-ONS</p>
        <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <h2 id="add-ons-title" className="text-[clamp(1.625rem,2.6vw,2.25rem)] font-bold leading-snug tracking-[-0.035em]">
              기본형에, 필요한 기능만 더하세요.
            </h2>
            <p className="mt-3 max-w-2xl text-[15px] leading-[1.85] text-neutral-600">
              랜딩페이지는 기본형에 관리자페이지·회원가입·예약·챗봇·앱처럼 필요한 기능을 고르면 그만큼만
              더해집니다.{' '}
              <b className="font-semibold text-neutral-800">특화된 기능/복잡한 시스템도 개발 가능해요.</b>{' '}
              기업형 홈페이지, 프리미엄 맞춤형 홈페이지는 작업양과 기능 상담에 따라 견적이 정해집니다.
            </p>
          </div>
          {/* 구조를 한 줄로 — 기본 + 추가 = 견적 */}
          <p aria-hidden className="hidden items-center gap-2 text-xs font-semibold text-neutral-500 lg:flex">
            <span className="rounded-full bg-violet-600 px-3 py-1.5 text-white">기본형</span>+
            <span className="rounded-full border border-violet-300 px-3 py-1.5 text-violet-700">추가 기능</span>=
            <span className="rounded-full bg-[#19172a] px-3 py-1.5 text-white">내 견적</span>
          </p>
        </div>

        {/* 웹사이트 개발은 아래 견적표에서 세 갈래로 나뉜다 */}
        <p className="mt-10 rounded-2xl border border-violet-200 bg-violet-50/60 px-4 py-3.5 text-[13px] leading-relaxed text-neutral-600 md:px-5 md:text-sm">
          <b className="font-semibold text-violet-700">{ABOUT_INQUIRY_CATEGORY}</b>은{' '}
          <b className="font-semibold text-neutral-800">{SITE_KINDS.map((k) => k.label).join(' · ')}</b>{' '}
          세 가지로 나뉘고, 고른 유형에 따라 견적이 산정됩니다.
        </p>

        <div className="mt-6">
          <EstimateBuilder />
        </div>
      </div>
    </section>
  )
}
