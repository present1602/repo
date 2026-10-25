import type { Metadata } from 'next'
import { ProposalNav } from '@/components/proposal/proposal-nav'
import { ProposalRail } from '@/components/proposal/proposal-rail'
import { HtmlClass } from '@/components/html-class'

export const metadata: Metadata = {
  title: '디자이너 제안서 · SOOM',
  description: 'AI로 빠르게 만드는 웹·앱 메인 시안, 그리고 그 다음의 더 큰 계약.',
  /* 모집 자료라 링크를 받은 사람만 본다 — 검색에 걸릴 이유가 없다 */
  robots: { index: false, follow: false },
}

/* 디자이너 모집 제안서(ref/soom-design 의 ProposalV1).

   원본은 잡지 펼침면을 흉내 내 좌우 두 쪽으로 나뉜다. 넓은 화면에서는
   그 짜임을 그대로 두고, 좁은 화면에서는 위아래로 쌓는다.

   원본의 picsum 자리 채우기 사진은 넣지 않는다 — 내용이 없는 그림이
   모바일에서 화면을 통째로 먹는다. 분위기가 필요한 자리는 색과 글자로
   대신한다(ProposalArt). */

const TOTAL = 5
const pad = (n: number) => String(n).padStart(2, '0')
const BRAND = 'SOOM · Designer Proposal'

export default function ProposalV1Page() {
  return (
    /* 아래 여백은 안쪽 상자(py-14)가 맡는다 — 여기에 또 주면 이중이 된다 */
    <div className="min-h-screen bg-neutral-100 text-neutral-900">
      <ProposalNav total={TOTAL} />
      <ProposalRail total={TOTAL} />
      <HtmlClass names={['proposal-snap', 'smooth-anchor']} />

      {/* 큰 화면에서 좌우가 끝까지 붙으면 읽는 눈이 쉴 자리가 없다 —
          폭이 늘수록 여백도 함께 키우고, 아주 넓은 화면에서는 상한을 둔다.
          xl 부터는 좌측 레일(ProposalRail)이 설 자리도 함께 비운다. */}
      {/* 위아래로 숨 쉴 자리를 둔다 — 펼침면이 바와 화면 끝에 붙으면
          종이가 아니라 꽉 찬 패널처럼 보인다. 스냅이 걸린 화면에서는
          이 여백만큼을 빼고 한 장의 높이를 잡는다(globals.css). */}
      <div className="mx-auto max-w-[110rem] space-y-8 px-3 py-8 md:space-y-20 md:px-10 md:py-14 lg:px-16 xl:pl-16 xl:pr-28 2xl:pl-24 2xl:pr-32">
        {/* 01 COVER */}
        <Spread id={1}>
          <Half tone="cream" top={['Est. 2026', 'Vol. 01']} foot={['', '']}>
            <Label>Designer Proposal</Label>
            <h1 className="mt-5 text-5xl font-bold leading-[0.95] tracking-tight md:mt-6 md:text-8xl">
              The
              <br />
              <span className="text-violet-600">Designer</span>
              <br />
              Edition.
            </h1>
            <Rule />
            <p className="max-w-sm leading-relaxed text-neutral-600">
              디자이너를 위한 SOOM의 첫 번째 공식 제안서.
              <br />
              AI로 빠르게 만드는 웹·앱 메인 시안, 그리고 그 다음의 더 큰 계약.
            </p>
            <div className="mt-10 flex items-end justify-between md:mt-auto md:pt-16">
              <div>
                <p className="text-[10px] uppercase tracking-[0.3em] text-neutral-500">
                  Published by
                </p>
                <p className="mt-2 text-lg tracking-[0.3em]">SOOM</p>
              </div>
              <span className="grid size-12 place-items-center rounded-full bg-violet-600 text-sm font-semibold text-white md:size-14">
                01
              </span>
            </div>
          </Half>

          {/* 원본은 여기에 사진이 깔린다 — 글자만 남겨 좁은 화면에서
              한 화면을 통째로 먹지 않게 한다 */}
          <div className="relative flex min-h-[14rem] flex-col justify-end bg-neutral-950 p-7 md:min-h-[28rem] md:p-12">
            {/* 색은 직접 적는다 — 임의 값 안의 theme() 은 Tailwind v4 가
                변환하지 않아 클래스가 통째로 무시된다(단색만 남는다). */}
            <div
              aria-hidden
              className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgb(124_58_237/0.35),transparent_60%),radial-gradient(circle_at_80%_80%,rgb(139_92_246/0.2),transparent_55%)]"
            />
            <span className="absolute right-5 top-5 rounded-full bg-violet-600 px-3 py-1 text-[10px] font-semibold tracking-[0.25em] text-white md:right-6 md:top-6">
              NEW ISSUE
            </span>
            <div className="relative text-white">
              <p className="text-[10px] tracking-[0.35em] text-white/70">FEATURING</p>
              <p className="mt-2 text-xl font-semibold md:text-2xl">AI × 웹/앱 메인 시안</p>
            </div>
          </div>
        </Spread>

        {/* 02 HOW IT WORKS */}
        <Spread id={2}>
          <Half tone="cream" top={['Feature · 01', 'The Model']} foot={[BRAND, 'L']}>
            <Label>How it works</Label>
            <h2 className="mt-5 text-2xl font-semibold leading-snug tracking-tight md:text-4xl">
              메인 샘플 시안 몇 장이
              <br />더 큰 계약이 되기까지.
            </h2>
            <ol className="mt-8 space-y-5 border-l border-violet-600 pl-6 md:mt-10 md:space-y-6">
              {[
                ['의뢰 접수', '고객이 29,000원 ~ 99,000원으로 웹/앱 메인 샘플시안 의뢰'],
                ['AI 제작', 'AI를 활용해 주요 화면을 빠르게 기획/디자인'],
                ['시안 전달', '고객은 결과물을 보고 본 계약 여부를 결정'],
                ['본 계약', '전체 디자인 외주 · 전체 개발 외주로 확장'],
              ].map(([t, s], i) => (
                <li key={t} className="relative">
                  <span className="absolute -left-[1.85rem] top-1 size-2.5 rounded-full bg-violet-600" />
                  <p className="text-[10px] tracking-[0.3em] text-neutral-500">
                    STEP {pad(i + 1)}
                  </p>
                  <p className="mt-1 font-semibold">{t}</p>
                  <p className="text-sm text-neutral-600">{s}</p>
                </li>
              ))}
            </ol>
          </Half>

          <Half tone="white" top={['Quote', '2026']} foot={[BRAND, `02 / ${pad(TOTAL)}`]}>
            {/* 원본의 사진 자리 — 따옴표와 문장만 남긴다 */}
            <span className="grid size-9 place-items-center rounded-full bg-violet-600 text-lg font-serif text-white">
              &ldquo;
            </span>
            <p className="mt-5 text-xl font-medium leading-snug md:text-3xl">
              작은 시안 하나가
              <br />
              <span className="text-violet-600">더 큰 프로젝트</span>의 시작이 됩니다.
            </p>
            <p className="mt-4 text-sm leading-relaxed text-neutral-600">
              소액 외주로 시작하지만, 시안이 마음에 든 고객은 전체 디자인이나 개발까지 맡기게
              됩니다. 첫 시안을 만든 디자이너에게 다음 계약의 기회가 먼저 돌아갑니다.
            </p>
            <div className="mt-7 grid grid-cols-3 gap-2 md:mt-8">
              {['FIGMA', 'CHATGPT', 'CLAUDE', 'MIDJOURNEY', 'CLAUDE CODE', 'V0'].map((t) => (
                <span
                  key={t}
                  className="border border-neutral-300 py-2 text-center text-[10px] tracking-[0.2em]"
                >
                  {t}
                </span>
              ))}
            </div>
            <p className="mt-3 text-[10px] tracking-[0.3em] text-neutral-500">AI DESIGN STACK</p>
          </Half>
        </Spread>

        {/* 03 NUMBERS + BENEFITS */}
        <Spread id={3}>
          <Half
            tone="cream"
            top={['Feature · 02', 'SOOM Edition · Vol. 01']}
            foot={[BRAND, 'L']}
          >
            <Label>Revenue</Label>
            <h2 className="mt-5 text-2xl font-semibold leading-snug tracking-tight md:text-4xl">
              숫자로 보는
              <br />
              <span className="text-violet-600">샘플 시안 수익.</span>
            </h2>
            <p className="mt-8 text-[10px] tracking-[0.3em] text-neutral-500 md:mt-10">
              SAMPLE FEE
            </p>
            {/* 금액은 줄바꿈 없이 한 줄로 읽혀야 한다 — 좁은 화면에서
                글자를 줄여 끊기지 않게 한다 */}
            <p className="mt-1 text-3xl font-light tracking-tight text-violet-600 sm:text-4xl md:text-6xl">
              ₩29,000<span className="text-xl md:text-3xl"> ~ </span>99,000
            </p>
            <p className="mt-2 text-sm text-neutral-600">웹/앱 메인 · 주요 화면 시안 2~6장</p>
            <div className="mt-7 grid grid-cols-2 gap-6 border-t border-neutral-300 pt-7 md:mt-8 md:pt-8">
              <div>
                <p className="text-4xl font-light text-violet-600 md:text-5xl">
                  0<span className="text-xl md:text-2xl">%</span>
                </p>
                <p className="mt-1 text-sm text-neutral-600">
                  플랫폼 수수료
                  <br />
                  <span className="text-neutral-400">카드수수료만 제외하고 지급</span>
                </p>
              </div>
              <div>
                <p className="text-4xl font-light text-violet-600 md:text-5xl">
                  1<span className="text-xl md:text-2xl">건~</span>
                </p>
                <p className="mt-1 text-sm text-neutral-600">
                  원하는 만큼만
                  <br />
                  <span className="text-neutral-400">부담 없는 부업 구조</span>
                </p>
              </div>
            </div>
          </Half>

          <Half tone="white" top={['Why SOOM', '2026']} foot={[BRAND, `03 / ${pad(TOTAL)}`]}>
            <Label>Four benefits</Label>
            <div className="mt-6 grid grid-cols-2 gap-3">
              {[
                ['소액 · 빠른 제작', 'AI로 짧은 시간에 완성하는 메인 시안'],
                ['부업 수익', '퇴근 후 부업으로 더 벌 수 있어요.'],
                ['AI 포트폴리오', '돈을 벌면서 AI 작업물이 쌓임'],
                ['더 큰 계약', '전체 디자인 · 개발 외주로 연결'],
              ].map(([t, s], i) => (
                <div key={t} className="border border-neutral-300 p-4 md:p-5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] tracking-[0.2em] text-neutral-500">
                      NO.{pad(i + 1)}
                    </span>
                    <span className="grid size-6 place-items-center rounded-full bg-violet-600 text-[10px] text-white">
                      ✓
                    </span>
                  </div>
                  <p className="mt-4 font-semibold md:mt-5">{t}</p>
                  <p className="mt-1 text-xs text-neutral-600">{s}</p>
                </div>
              ))}
            </div>
            <p className="mt-4 bg-violet-600 px-5 py-4 text-sm font-semibold text-white">
              + 주요 시안: 웹 / 앱 메인 화면 · 주요 화면
            </p>
            <p className="mt-4 text-xs leading-relaxed text-neutral-500">
              본업이 있어도 괜찮습니다. 퇴근 후, 주말에 한 건씩 — 부업으로 시작하기 좋은
              구조입니다.
            </p>
          </Half>
        </Spread>

        {/* 04 ELIGIBILITY */}
        <Spread id={4}>
          <Half tone="cream" top={['Feature · 03', 'Who we look for']} foot={[BRAND, 'L']}>
            <Label>Eligibility</Label>
            <h2 className="mt-5 text-3xl font-semibold leading-tight tracking-tight md:text-5xl">
              이런 디자이너를
              <br />
              <span className="text-violet-600">찾습니다.</span>
            </h2>
            <Rule />
            <p className="max-w-sm leading-relaxed text-neutral-600">
              커뮤니케이션을 통해 요구사항을 잘 파악해서 클라이언트가 원하는 디자인으로 구현해낼
              수 있는 분,
              <br />
              책임감 있는 분.
            </p>
          </Half>

          <Half tone="white" top={['Requirements', '2026']} foot={[BRAND, `04 / ${pad(TOTAL)}`]}>
            <p className="text-[11px] tracking-[0.35em] text-violet-600">REQUIRED</p>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 bg-neutral-900 px-5 py-4 text-white">
              <span className="font-semibold">Figma 웹디자인 가능</span>
              <span className="text-xs text-white/60">필수(능숙하지 않아도 됩니다.)</span>
            </div>

            <p className="mt-6 text-[11px] tracking-[0.35em] text-violet-600">AND ONE OF</p>
            <div className="mt-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border border-neutral-300 px-5 py-4">
                <span className="font-medium">실무 경력</span>
                <span className="text-sm text-neutral-500">6개월 이상</span>
              </div>
              <div className="flex items-center gap-3 py-3">
                <span className="h-px flex-1 bg-neutral-200" />
                <span className="text-xs tracking-widest text-neutral-400">혹은</span>
                <span className="h-px flex-1 bg-neutral-200" />
              </div>
              <div className="border border-dashed border-neutral-300 px-5 py-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">디자인 전공자 + 웹 포트폴리오</span>
                  <span className="text-sm text-neutral-500">3학년 이상</span>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-neutral-500">
                  전공자이고 웹 포트폴리오가 있다면 실무경력이 없어도 활동 가능합니다.
                </p>
              </div>
            </div>
          </Half>
        </Spread>

        {/* 05 CONTACT */}
        <Spread id={5}>
          <div className="relative flex min-h-[18rem] flex-col justify-between overflow-hidden bg-violet-950 p-7 text-white md:min-h-[32rem] md:p-12">
            <div
              aria-hidden
              className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgb(139_92_246/0.45),transparent_60%),radial-gradient(circle_at_90%_90%,rgb(167_139_250/0.25),transparent_50%)]"
            />
            <div className="relative flex justify-between text-[10px] uppercase tracking-[0.3em] text-white/70">
              <span>Final note</span>
              <span>
                {pad(TOTAL)} / {pad(TOTAL)}
              </span>
            </div>
            <div className="relative py-10 md:py-0">
              <Label light>Now boarding</Label>
              <h2 className="mt-4 text-3xl font-semibold leading-tight md:text-5xl">
                SOOM 첫
                <br />
                디자이너 그룹에
                <br />
                <span className="text-violet-300">합류하세요.</span>
              </h2>
            </div>
            <p className="relative text-[10px] tracking-[0.3em] text-white/70">SOOM · 2026</p>
          </div>

          <Half tone="white" top={['Contact', '2026']} foot={[BRAND, `${pad(TOTAL)} / ${pad(TOTAL)}`]}>
            <Label>How to apply</Label>
            <h2 className="mt-5 text-2xl font-semibold leading-snug tracking-tight md:text-3xl">
              지원은 아래 메일로 보내주세요.
            </h2>
            <ul className="mt-7 space-y-3 md:mt-8">
              {[
                ['01', '이력서', '짧은 자기소개로 대체 가능'],
                ['02', '포트폴리오', '링크 또는 PDF'],
              ].map(([n, t, s]) => (
                <li
                  key={n}
                  className="flex items-center gap-4 border border-neutral-300 px-4 py-4 md:px-5"
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-violet-600 text-xs font-semibold text-white">
                    {n}
                  </span>
                  <span className="font-semibold">{t}</span>
                  <span className="ml-auto text-right text-xs text-neutral-500">{s}</span>
                </li>
              ))}
            </ul>

            <a
              href="mailto:manager@soom.it?subject=[SOOM 디자이너 지원]"
              className="group mt-6 flex flex-wrap items-center gap-x-4 gap-y-1 bg-violet-600 px-5 py-5 text-white transition hover:bg-violet-700"
            >
              <span className="text-[10px] tracking-[0.3em] text-violet-200">EMAIL</span>
              <span className="text-base font-semibold md:text-lg">manager@soom.it</span>
              <span className="ml-auto transition group-hover:translate-x-1">↗</span>
            </a>

            <div className="mt-8 flex justify-between border-t border-neutral-200 pt-6 text-[10px] tracking-[0.3em] text-neutral-500 md:mt-10">
              <span>END OF ISSUE 01</span>
              <span>THANK YOU</span>
            </div>
          </Half>
        </Spread>
      </div>
    </div>
  )
}

/* ─────────── 부품 ─────────── */

function Label({ children, light }: { children: React.ReactNode; light?: boolean }) {
  return (
    <p
      className={`text-[11px] font-medium uppercase tracking-[0.35em] ${
        light ? 'text-violet-300' : 'text-violet-600'
      }`}
    >
      {children}
    </p>
  )
}

function Rule() {
  return <div className="my-6 h-0.5 w-16 bg-violet-600 md:my-8" />
}

/* 펼침면 한 장 — 넓은 화면에서는 좌우 두 쪽, 좁은 화면에서는 위아래로 쌓인다 */
function Spread({ id, children }: { id: number; children: React.ReactNode }) {
  return (
    <section
      id={`p${id}`}
      /* 폭을 묶지 않는다 — 넓은 화면에서 펼침면이 화면을 가득 쓴다.
         proposal-spread — 스냅 지점이자 한 화면에 맞는 높이(globals.css) */
      className="proposal-spread grid w-full scroll-mt-20 overflow-hidden rounded-lg shadow-xl shadow-neutral-300/60 md:grid-cols-2 md:divide-x md:divide-neutral-300"
    >
      {children}
    </section>
  )
}

/* 펼침면의 한 쪽.

   위아래의 작은 글자는 잡지의 난외주를 흉내 낸 것이다 — 좁은 화면에서는
   자리만 차지하므로 감춘다. */
function Half({
  children,
  tone = 'cream',
  top,
  foot,
}: {
  children: React.ReactNode
  tone?: 'cream' | 'white'
  top: [string, string]
  foot: [string, string]
}) {
  const bg = tone === 'cream' ? 'bg-[#faf6f0]' : 'bg-white'

  return (
    <div className={`relative flex flex-col p-7 md:p-12 ${bg}`}>
      <div className="hidden justify-between text-[10px] uppercase tracking-[0.3em] text-neutral-500 md:flex">
        <span>{top[0]}</span>
        <span>{top[1]}</span>
      </div>

      <div className="flex flex-1 flex-col justify-center md:py-12">{children}</div>

      <div className="hidden justify-between text-[10px] uppercase tracking-[0.3em] text-neutral-500 md:flex">
        <span>{foot[0]}</span>
        <span>{foot[1]}</span>
      </div>
    </div>
  )
}
