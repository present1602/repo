import type { Metadata } from 'next'
import { AboutInquiryButton } from '@/components/about-inquiry-button'

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
      'SOOM은 뛰어난 바이브코딩 역량을 갖춘 Uxui 디자이너가 1차적으로 디자인과 개발까지 진행합니다.',
      'AI 효율적 활용으로 개발시간을 단축하고, 플랫폼 수수료도 낮춰 제작비용을 합리적으로 낮춥니다.',
    ],
    detail: '효율적인 제작 · 낮은 수수료',
  },
  {
    label: 'DEVELOPMENT',
    title: '완성도는 함께 지킵니다.',
    description: [
      '1차로 개발된 소스코드는 전문 개발자가 꼼꼼히 코드품질과 기능을 검수하고 코드를 개선해 클라이언트에게 전달합니다.',
      '이런 방식으로 비용은 줄이며, 전문성과 안정성은 동시에 보장합니다.',
    ],
    detail: '디자이너 제작 · 개발자 검수',
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
                회사와 고객특성을 잘 녹여낸 디자인, 고객을 끌어드리는 멋진 웹사이트 제작을 합리적인 비용으로 의뢰하세요.
              </p>
            </div>
          </div>
          <div className="mt-10 flex flex-wrap items-center gap-5 md:mt-12 md:gap-8">
            <AboutInquiryButton />
            <a href="#about-promises" className="inline-flex min-h-12 items-center gap-3 text-sm font-medium text-neutral-700 hover:text-violet-600 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-500">
              SOOM이 일하는 방법 <span aria-hidden="true">↓</span>
            </a>
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
