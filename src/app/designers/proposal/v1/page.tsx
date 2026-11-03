import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import { AdminPdfBar } from '@/components/proposal/admin-pdf-bar'
import { ProposalNav } from '@/components/proposal/proposal-nav'
import { ProposalRail } from '@/components/proposal/proposal-rail'
import { HtmlClass } from '@/components/html-class'
import { Half, Label, Rule, Spread, pad } from '@/components/proposal/spread-bits'

export const metadata: Metadata = {
  title: '디자이너 제안서 · SOOM',
  description: '클라이언트의 리스크를 낮추고 소액 의뢰가 큰 의뢰로 이어질 수 있게 연결해드립니다.',
  /* 모집 자료라 링크를 받은 사람만 본다 — 검색에 걸릴 이유가 없다 */
  robots: { index: false, follow: false },
}

/* 디자이너 모집 제안서 v1.

   v0.1 의 소액 외주·부업 이야기를 걷어냈다 — 메인 시안을 맡긴 디자이너와
   본계약까지 가길 바라는 클라이언트에게, 본계약은 다른 디자이너가 한다는
   구조는 거부감을 준다. 그래서 SOOM 이 받는 의뢰와 AI 로 일하는 방식을 앞에 둔다.
     01 표지
     02 SOOM 이 받는 의뢰  랜딩페이지 개발 · Web/App 개발 · 로고/일러스트, 메인 시안 우선 의뢰
     03 AI               투입 시간은 줄이고 퀄리티는 높인다, AI 활용 포트폴리오
     04 선택             받을 분야만 고른다 + 바이브코딩 기술 지원
     05 자격
     06 11월 이벤트       첫 거래 축하 선물
     07 지원

   원본의 picsum 자리 채우기 사진은 넣지 않는다 — 내용이 없는 그림이
   모바일에서 화면을 통째로 먹는다. 분위기가 필요한 자리는 색으로 대신한다. */

const TOTAL = 7
const BRAND = 'SOOM · Designer Proposal'

export default function ProposalV14Page() {
  return (
    <div className="min-h-screen bg-neutral-100 text-neutral-900">
      <Suspense fallback={null}>
        <AdminPdfBar />
      </Suspense>
      {/* PDF 에는 쪽 번호 바·레일이 찍히지 않는다. contents 로 감싸야
          바의 sticky 가 감싼 상자에 갇히지 않는다. */}
      <div className="contents print:hidden">
        <ProposalNav total={TOTAL} />
        <ProposalRail total={TOTAL} />
      </div>
      <HtmlClass names={['proposal-snap', 'smooth-anchor']} />

      {/* proposal-pages — PDF 로 찍을 때 여백을 걷어내는 기준(pdf-export.tsx) */}
      <div className="proposal-pages mx-auto max-w-[110rem] space-y-8 px-3 py-8 md:space-y-20 md:px-10 md:py-14 lg:px-16 xl:pl-16 xl:pr-28 2xl:pl-24 2xl:pr-32">
        {/* ─────────── 01 COVER ─────────── */}
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
            {/* 줄바꿈 자리를 직접 정한다 — 흐르는 대로 두면 '계 / 약.' 처럼
                마지막 낱말만 넘어가 끝이 허전해진다 */}
            <p className="max-w-md leading-relaxed text-neutral-600">
              디자이너를 위한 SOOM의 초대 제안서.
              <br />
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

          {/* 원본은 여기에 사진이 깔린다 — 글자만 남기고 색으로 분위기를 낸다 */}
          <div className="relative flex min-h-[20rem] flex-col justify-between bg-neutral-950 p-7 md:min-h-[28rem] md:p-12">
            <div
              aria-hidden
              className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgb(124_58_237/0.35),transparent_60%),radial-gradient(circle_at_80%_80%,rgb(139_92_246/0.2),transparent_55%)]"
            />
            <span className="absolute right-5 top-5 rounded-full bg-violet-600 px-3 py-1 text-[10px] font-semibold tracking-[0.25em] text-white md:right-6 md:top-6">
              NEW ISSUE
            </span>

            {/* 이 제안서가 한 줄로 말하는 것 — 표지 우측에 둔다.
                표지에서 가장 먼저 읽혀야 하므로 크게 세운다. */}
            {/* @container — 글씨 크기를 화면이 아니라 이 쪽의 폭에 맞춘다(cqw). 펼침면은
                화면 폭의 반이라 화면 기준으로 잡으면 md~lg 에서 줄이 넘친다.
                폭을 꽉 채워야(w-full) 쪽의 폭이 잡힌다 — 내용 폭으로 줄면 cqw 가 0 이 된다. */}
            <div className="@container relative mt-14 w-full pr-1 text-right text-white md:mt-0 md:flex md:flex-1 md:flex-col md:justify-center md:pr-4">
              <span className="ml-auto block h-0.5 w-12 bg-violet-400" />
              {/* 큰 글씨 세 줄이 PC에서는 너무 붙어 보인다 — 넓은 화면만 줄간격을 올린다.
                  줄은 <br /> 로만 나누고 꺾지 않는다. 가장 긴 둘째 줄(약 12글자 폭)이
                  쪽 폭의 90% 안에 들도록 7.5cqw 로 잡고, 넓은 화면에서는 2.75rem 에서 멈춘다 */}
              <p className="mt-6 whitespace-nowrap text-[min(7.5cqw,2.75rem)] font-semibold leading-tight md:leading-[1.4]">
                소액의뢰로 시작해                <br />
                더 큰 계약으로 <br/>
                이어질 수 있는
                <br />
                <span className="text-violet-300">디자인 외주 플랫폼</span>
              </p>
            </div>

            <div className="relative mt-10 text-white md:mt-0">
              <p className="text-[10px] tracking-[0.35em] text-white/70">FEATURING</p>
              <p className="mt-2 text-xl font-semibold md:text-2xl">AI × 웹/앱 메인 시안</p>
            </div>
          </div>
        </Spread>

        {/* ─────────── 02 WHAT WE DO ─────────── */}
        <Spread id={2}>
          <Half tone="cream" top={['Feature · 01', 'What we do']} foot={[BRAND, 'L']}>
            <Label>What we do</Label>
            <h2 className="mt-5 text-3xl font-semibold leading-snug tracking-tight md:text-5xl">
              SOOM에서는
              <br />
              <span className="text-violet-600">세 가지 의뢰</span>를 받아요.
            </h2>
            <Rule />
            {/* 분야 이름만 크게 — 무엇을 어떻게 하는지는 오른쪽 쪽에서 */}
            <ul className="border-t border-neutral-300">
              {['랜딩페이지 개발', 'Web/App 개발', '로고/일러스트'].map((t, i) => (
                <li
                  key={t}
                  className="flex items-baseline gap-4 border-b border-neutral-300 py-3.5 md:py-4"
                >
                  <span className="font-mono text-xs text-violet-600">{pad(i + 1)}</span>
                  <span className="text-lg font-semibold md:text-2xl">{t}</span>
                </li>
              ))}
            </ul>
          </Half>

          <Half tone="white" top={['How it works', '2026']} foot={[BRAND, `02 / ${pad(TOTAL)}`]}>
            <Label>How it works</Label>
            <dl className="mt-6 space-y-5 md:mt-7">
              {[
                [
                  '랜딩페이지',
                  '디자인과 개발까지 포함된 의뢰예요. 디자이너는 디자인만 맡고, 개발은 SOOM이 해요.',
                ],
                [
                  'Web/App',
                  '클라이언트가 디자인 의뢰, 또는 디자인 + 개발 전체 의뢰 중에서 골라요. 개발은 마찬가지로 SOOM 개발자와 협력해요.',
                ],
                ['로고/일러스트', '로고 · 일러스트 디자인 의뢰예요.'],
              ].map(([t, s]) => (
                <div key={t}>
                  <dt className="font-semibold">{t}</dt>
                  <dd className="mt-1 text-sm leading-relaxed text-neutral-600">{s}</dd>
                </div>
              ))}
            </dl>

            {/* 메인 시안 우선 의뢰 — 클라이언트 쪽 장치지만 디자이너에게는
                더 큰 계약으로 가는 길이라 이 쪽의 결론으로 둔다 */}
            <div className="mt-7 bg-violet-600 px-5 py-5 text-white md:mt-8 md:px-6">
              <p className="text-[10px] tracking-[0.3em] text-violet-200">MAIN DRAFT FIRST</p>
              <p className="mt-2 font-semibold md:text-lg">메인 시안 우선 의뢰</p>
              <p className="mt-1.5 text-sm leading-relaxed text-violet-50">
                클라이언트는 Web/App 메인 시안만 먼저 의뢰할 수 있어 의뢰 부담이 낮아요. 시안이
                마음에 들면 더 큰 계약, 더 큰 수익으로 이어져요.
              </p>
            </div>
          </Half>
        </Spread>

        {/* ─────────── 03 AI ─────────── */}
        <Spread id={3}>
          <Half tone="cream" top={['Feature · 02', 'AI workflow']} foot={[BRAND, 'L']}>
            <Label>AI × Design</Label>
            <h2 className="mt-5 text-3xl font-semibold leading-snug tracking-tight md:text-5xl">
              투입 시간은 줄이고,
              <br />
              <span className="text-violet-600">퀄리티는 높이고.</span>
            </h2>
            <Rule />
            <p className="max-w-md text-base leading-relaxed text-neutral-600 md:text-lg">
              SOOM은 AI의 효율적인 활용을 추구해요. 반복되는 작업은 AI에 맡기고, 디자이너는
              판단과 완성도에 집중합니다.
            </p>
          </Half>

          <Half tone="white" top={['For designers', '2026']} foot={[BRAND, `03 / ${pad(TOTAL)}`]}>
            <span className="grid size-9 place-items-center rounded-full bg-violet-600 font-serif text-lg text-white">
              &ldquo;
            </span>
            <p className="mt-5 text-xl font-medium leading-snug md:text-3xl">
              전통적인 웹 · UI/UX 디자이너에게는
              <br />
              <span className="text-violet-600">AI 실무 역량</span>을 키울 기회예요.
            </p>

            <div className="mt-7 grid grid-cols-2 gap-3 md:mt-8">
              {[
                ['실무 AI 활용', '실제 클라이언트 작업에서 AI 활용 기술을 높여요.'],
                ['AI 포트폴리오', 'AI를 활용한 결과물이 포트폴리오로 쌓여요.'],
              ].map(([t, s], i) => (
                <div key={t} className="border border-neutral-300 p-4 md:p-5">
                  <span className="text-[10px] tracking-[0.2em] text-neutral-500">NO.{pad(i + 1)}</span>
                  <p className="mt-3 font-semibold md:mt-4">{t}</p>
                  <p className="mt-1 text-xs leading-relaxed text-neutral-600">{s}</p>
                </div>
              ))}
            </div>

            <div className="mt-5 grid grid-cols-3 gap-2">
              {['FIGMA AI', 'FIGMA MAKE', 'DESIGN SYSTEM', 'CHATGPT', 'CLAUDE', 'V0'].map((t) => (
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

        {/* ─────────── 04 CHOICE ─────────── */}
        <Spread id={4}>
          <Half tone="cream" top={['Feature · 03', 'Your choice']} foot={[BRAND, 'L']}>
            <Label>Your choice</Label>
            <h2 className="mt-5 text-3xl font-semibold leading-snug tracking-tight md:text-5xl">
              받고 싶은 의뢰만
              <br />
              <span className="text-violet-600">골라서 받으세요.</span>
            </h2>
            <Rule />
            <p className="max-w-md text-base leading-relaxed text-neutral-600 md:text-lg">
              로고 디자인만 원한다면 로고만, 랜딩페이지나 Web/App만 원한다면 그것만. 설정에서
              언제든 바꿀 수 있어요.
            </p>
          </Half>

          <Half tone="white" top={['Settings', '2026']} foot={[BRAND, `04 / ${pad(TOTAL)}`]}>
            <p className="text-sm font-medium tracking-[0.2em] text-violet-600">받을 분야 고르기</p>

            {/* 앞 쪽의 세 가지 중 무엇을 켤지 — 체크 모양 그대로 */}
            <div className="mt-4 space-y-2.5">
              {[
                { t: '랜딩페이지 개발', s: '디자인만 하면 개발은 SOOM이', on: true },
                { t: 'Web/App 개발', s: '디자인 의뢰 · 디자인 + 개발 의뢰', on: true },
                { t: '로고/일러스트', s: '로고 · 일러스트 디자인', on: false },
              ].map((x) => (
                <div
                  key={x.t}
                  className={`flex items-start gap-3 border px-4 py-3.5 md:px-5 md:py-4 ${
                    x.on ? 'border-violet-600 bg-violet-50/50' : 'border-neutral-300'
                  }`}
                >
                  <span
                    className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded text-[11px] font-bold ${
                      x.on ? 'bg-violet-600 text-white' : 'border border-neutral-300'
                    }`}
                  >
                    {x.on ? '✓' : ''}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">{x.t}</span>
                    <span className="mt-0.5 block text-xs text-neutral-500">{x.s}</span>
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-2.5 text-xs leading-relaxed text-neutral-500">
              * Web/App의 &lsquo;디자인 + 개발 의뢰&rsquo;는 SOOM과 협력하는 일부 디자이너분들만
              받을 수 있어요.
            </p>

            {/* 개발은 SOOM 이 하지만, 직접 만들고 싶은 디자이너에게는 길을 열어 둔다 */}
            <div className="mt-6 flex items-start gap-3 bg-neutral-900 px-5 py-4 text-white md:mt-7">
              <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-violet-500 font-mono text-[9px] font-bold">
                {'</>'}
              </span>
              <p className="text-sm leading-relaxed text-white/85">
                <b className="font-semibold text-white">바이브코딩 기술 지원</b> — 원한다면 간단한
                랜딩페이지는 디자이너가 바이브코딩으로 직접 제작할 수 있도록 SOOM이 도와드려요.
              </p>
            </div>
          </Half>
        </Spread>

        {/* ─────────── 05 ELIGIBILITY ─────────── */}
        <Spread id={5}>
          <Half tone="cream" top={['Feature · 04', 'Who we look for']} foot={[BRAND, 'L']}>
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

          <Half tone="white" top={['Requirements', '2026']} foot={[BRAND, `05 / ${pad(TOTAL)}`]}>
            {/* 분야마다 요건이 다르다 — 필수 하나(검은 띠) + 둘 중 하나(나란히).
                둘 중 하나를 위아래로 쌓으면 두 묶음이 한 쪽에 들어가지 않는다 */}
            <div className="space-y-8 md:space-y-9">
              {[
                {
                  area: 'Web/App · 랜딩페이지',
                  required: 'Figma 웹디자인 가능 (웹 or 앱 포폴 필수)',
                  oneOf: ['디자인 실무 경력 보유자', '디자인계열 전공자'],
                },
                {
                  area: '로고/일러스트',
                  required: '로고 포트폴리오 보유',
                  oneOf: ['디자인 실무 경력 보유자', '디자인계열 전공자'],
                },
              ].map((g) => (
                <div key={g.area}>
                  <p className="text-sm font-semibold md:text-base">{g.area}</p>
                  <p className="mt-3 text-[11px] tracking-[0.35em] text-violet-600">REQUIRED</p>
                  <div className="mt-2 bg-neutral-900 px-5 py-3.5 text-sm font-semibold text-white md:text-base">
                    {g.required}
                  </div>
                  <p className="mt-4 text-[11px] tracking-[0.35em] text-violet-600">AND ONE OF</p>
                  <div className="mt-2 grid grid-cols-[1fr_auto_1fr] gap-2">
                    <span className="grid place-items-center border border-neutral-300 px-3 py-3 text-center text-xs font-medium md:px-4 md:text-sm">
                      {g.oneOf[0]}
                    </span>
                    {/* 그림으로 뜰 때 글자 폭이 조금 넓게 잡혀도 끊기지 않게 묶는다 */}
                    <span className="self-center whitespace-nowrap text-[10px] tracking-widest text-neutral-400">
                      OR
                    </span>
                    <span className="grid place-items-center border border-dashed border-neutral-300 px-3 py-3 text-center text-xs font-medium md:px-4 md:text-sm">
                      {g.oneOf[1]}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Half>
        </Spread>

        {/* ─────────── 06 LAUNCH EVENT ─────────── */}
        <Spread id={6}>
          <Half tone="cream" top={['Feature · 05', 'Launch event']} foot={[BRAND, 'L']}>
            <Label>November Event</Label>
            <h2 className="mt-5 text-3xl font-semibold leading-tight tracking-tight md:text-5xl">
              첫 거래 <span className="text-violet-600">축하선물</span>
            </h2>
            <Rule />
            <p className="max-w-sm text-base leading-relaxed text-neutral-600 md:text-lg">
              11월 한 달 동안 의뢰를 <b className="font-semibold text-neutral-900">한 건이라도</b>{' '}
              수행하면, 첫 거래 축하 선물을 드립니다.
            </p>
          </Half>

          <Half tone="white" top={['Gift', '2026']} foot={[BRAND, `06 / ${pad(TOTAL)}`]}>
            {/* 선물 카드 — 이 쪽의 주인공. 금액을 가장 크게 둔다 */}
            <div className="relative overflow-hidden bg-violet-950 p-6 text-white md:p-8">
              <div
                aria-hidden
                className="absolute inset-0 bg-[radial-gradient(circle_at_85%_15%,rgb(139_92_246/0.5),transparent_55%)]"
              />
              <div className="relative flex items-center justify-between">
                <span className="text-[10px] tracking-[0.3em] text-violet-200">FIRST DEAL GIFT</span>
                <span className="rounded-full bg-violet-500 px-3 py-1 text-[10px] font-semibold tracking-[0.15em]">
                  선착순 7명
                </span>
              </div>
              <p className="relative mt-6 text-sm text-white/80">네이버페이 상품권</p>
              <p className="relative mt-1 whitespace-nowrap text-4xl font-light tracking-tight md:text-6xl">
                ₩50,000
              </p>
            </div>

            <dl className="mt-5 divide-y divide-neutral-200 border-y border-neutral-200 text-sm">
              {[
                ['기간', '11월 1일 ~ 11월 30일'],
                ['조건', '의뢰 1건 이상 수행'],
                ['대상', '선착순 7명 한정'],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between gap-4 py-3">
                  <dt className="text-xs tracking-[0.2em] text-neutral-500">{k}</dt>
                  <dd className="font-medium">{v}</dd>
                </div>
              ))}
            </dl>

            {/* 의뢰를 기다리지만 않아도 된다는 것 — 선물 조건을 채우는 방법으로 잇는다 */}
            <div className="mt-5 flex items-start gap-3 bg-violet-50 px-5 py-4">
              <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-violet-600 text-[11px] text-white">
                ↗
              </span>
              <p className="text-sm leading-relaxed text-neutral-700">
                <b className="font-semibold text-neutral-900">내 소개 페이지를 직접 공유</b>해서
                의뢰를 유도할 수도 있어요.
              </p>
            </div>
          </Half>
        </Spread>

        {/* ─────────── 07 CONTACT ─────────── */}
        <Spread id={7}>
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
                SOOM의
                <br />
                디자이너 그룹에
                <br />
                <span className="text-violet-300">합류하세요.</span>
              </h2>
              {/* 읽고 바로 신청으로 — 제안서의 마지막 행동 */}
              <Link
                href="/designers/apply"
                className="group mt-8 inline-flex items-center gap-3 bg-white px-6 py-4 text-sm font-semibold text-violet-950 transition hover:bg-violet-100 md:mt-10 md:text-base"
              >
                지금 바로 SOOM 디자이너 신청하러 가기 
                <span className="transition group-hover:translate-x-1">→</span>
              </Link>
            </div>
            <p className="relative text-[10px] tracking-[0.3em] text-white/70">SOOM · 2026</p>
          </div>

          <Half
            tone="white"
            top={['Contact', '2026']}
            foot={[BRAND, `${pad(TOTAL)} / ${pad(TOTAL)}`]}
          >
            {/* 신청 길은 둘 — 신청 화면에서 직접, 또는 포트폴리오 링크만 보내고
                계정은 SOOM 이 만들어 준다. 첫 길은 작게 줄이고 둘째 길에 자리를 넘긴다 */}
            <div className="md:-mt-6">
              <Label>How to apply</Label>
              <p className="mt-4 text-sm text-neutral-600">아래 링크에서 신청해 주세요.</p>
              <Link
                href="/designers/apply"
                className="group mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 bg-violet-600 px-5 py-3.5 text-white transition hover:bg-violet-700"
              >
                <span className="text-[10px] tracking-[0.3em] text-violet-200">APPLY</span>
                <span className="text-sm font-semibold md:text-base">SOOM 디자이너 신청하기</span>
                <span className="ml-auto transition group-hover:translate-x-1">→</span>
              </Link>

              <div className="flex items-center gap-3 py-4">
                <span className="h-px flex-1 bg-neutral-200" />
                <span className="shrink-0 whitespace-nowrap text-xs font-medium text-neutral-500">
                  OR
                </span>
                <span className="h-px flex-1 bg-neutral-200" />
              </div>

              {/* 링크만 받으면 계정·포트폴리오는 SOOM 이 대신 만든다 — 신청 폼을
                  채우기 번거로운 디자이너를 놓치지 않으려고 */}
              <div className="bg-violet-50 px-5 py-4">
                <p className="text-[15px] leading-relaxed text-neutral-700 md:text-base">
                  포트폴리오를 다운받을 수 있는 링크(노트폴리오 등)가 있다면,{' '}
                  <b className="font-semibold text-neutral-900">이메일 · 링크 · 이름 · 전공 </b>만 SOOM에게
                  전달해 주세요. 
                  <br/>
                  직접 디자이너 계정을 만들고 포트폴리오까지 업로드한 뒤, 임시
                  비밀번호와 함께 계정을 전달드려요.
                  <br/>
                  (물론 직접 로그인 후 모든 정보를 수정 가능합니다.)
                </p>
                {/* 링크(mailto)로 두지 않는다 — 웹메일을 쓰는 사람에게는 쓰지 않는 메일 앱이
                    열린다. 주소만 보여 주고 각자 메일에서 보내게 한다(복사하기 쉽게 select-all) */}
                <p className="mt-3 text-[15px] text-neutral-700 md:text-base">
                  <span className="mr-2 text-[11px] tracking-[0.3em] text-neutral-500">EMAIL</span>
                  <span className="select-all font-semibold text-violet-700">manager@soom.it</span>
                </p>
              </div>
            </div>

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
