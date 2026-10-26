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
  description: '책임감 있는 디자이너들의 부업 플랫폼. 받을 의뢰 유형은 직접 고릅니다.',
  /* 모집 자료라 링크를 받은 사람만 본다 — 검색에 걸릴 이유가 없다 */
  robots: { index: false, follow: false },
}

/* 디자이너 모집 제안서 v1-4.

   v1-2 와 같고 마지막 쪽만 다르다 — 메일로 받던 지원을 디자이너 신청
   화면(/designers/apply)으로 보낸다. 메일 주소는 문의 창구로 남겼다.

   아래는 v1.1 때의 설명이다.

   ref/soom-design 의 ProposalV2 를 옮겼다. v1(5쪽)보다 두 쪽이 늘고
   이야기가 다시 짜였다 —
     02 수익       숫자로 보는 샘플 시안 수익 + 네 가지 이점
     03 시안 먼저   기존 외주와의 대비, 본계약으로 가는 흐름
     04 의뢰 유형   받을 유형을 직접 체크
     05 부업       소액만 체크하면 부업, 더 받으면 본업
     06 자격
     07 11월 이벤트  첫 거래 축하 선물 + 소개 페이지 직접 공유
     08 지원

   원본의 picsum 자리 채우기 사진은 넣지 않는다 — 내용이 없는 그림이
   모바일에서 화면을 통째로 먹는다. 분위기가 필요한 자리는 색으로 대신한다. */

const TOTAL = 8
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
            <div className="relative ml-auto mt-14 max-w-[16rem] text-right text-white md:mt-0 md:max-w-[20rem] md:flex-1 md:self-center">
              <span className="ml-auto block h-0.5 w-12 bg-violet-400" />
              {/* 큰 글씨 세 줄이 PC에서는 너무 붙어 보인다 — 넓은 화면만 줄간격을 올린다.
                  줄은 <br /> 로만 나눈다 — '디자이너들의'가 상자 폭에 거의 꽉 차서,
                  그림으로 뜰 때 글자 폭이 조금만 넓게 잡혀도 '의'가 넘어간다 */}
              <p className="mt-6 whitespace-nowrap text-3xl font-semibold leading-tight md:text-5xl md:leading-[1.4]">
                책임감 있는
                <br />
                디자이너들의
                <br />
                <span className="text-violet-300">부업 플랫폼</span>
              </p>
            </div>

            <div className="relative mt-10 text-white md:mt-0">
              <p className="text-[10px] tracking-[0.35em] text-white/70">FEATURING</p>
              <p className="mt-2 text-xl font-semibold md:text-2xl">AI × 웹/앱 메인 시안</p>
            </div>
          </div>
        </Spread>

        {/* ─────────── 02 REVENUE ─────────── */}
        <Spread id={2}>
          <Half
            tone="cream"
            top={['Feature · 01', 'SOOM Edition · Vol. 01']}
            foot={[BRAND, 'L']}
          >
            <Label>Revenue</Label>
            <h2 className="mt-5 text-2xl font-semibold leading-snug tracking-tight md:text-4xl">
              <span className="text-violet-600"></span>
            </h2>
            {/* 금액은 줄바꿈 없이 한 줄로 읽혀야 한다 — 좁은 화면에서
                글자를 줄여 끊기지 않게 한다 */}
            <p className="mt-1 text-2xl font-light tracking-tight text-violet-600 sm:text-3xl md:text-4xl md:mb-8">
              건당 ₩29,000<span className="text-base md:text-2xl">~</span>129,000
            </p>

            {/* 건당 금액보다 "한 달에 얼마"가 와닿는다 — 여기를 크게 둔다 */}
            <p className="mt-4 text-lg font-semibold leading-snug tracking-tight md:text-2xl">
              퇴근 후 한 건, 주말에 한 건,
              <br />
              매주 두 건 정도만 해도{' '}
              <span className="text-violet-600">50~80만원</span>의 부가수익을 얻을 수 있어요.
            </p>
            <p className="mt-2 text-sm text-neutral-600">웹/앱 메인 · 주요 화면 시안 2장 ~ 6장</p>
            {/* <p className="mt-2 text-sm text-neutral-600">AI 활용으로 빠르고 효율적으로 작업합니다.</p> */}

            {/* 상한은 디자이너마다 다르다 — 금액 바로 아래에서 짚어야
                처음 보는 사람이 129,000원부터 받는 것으로 오해하지 않는다 */}
            {/* <p className="mt-2 text-sm leading-relaxed text-neutral-500">
              처음에는 99,000원 이하 의뢰만 가능하지만, 경력이나 프로젝트 실적에 따라 상한
              금액이 올라갑니다.
            </p> */}

            {/* 어떤 도구를 쓰는지 — 이 쪽의 주인공은 금액과 수익이라
                테두리 없이 옅은 바탕으로만 두어 눈에 덜 걸리게 한다 */}
            {/* <div className="mt-3 flex flex-wrap gap-1.5">
              {['FIGMA AI', 'FIGMA MAKE', 'DESIGN SYSTEM'].map((t) => (
                <span
                  key={t}
                  className="rounded bg-neutral-200/70 px-2 py-1 text-[10px] font-medium tracking-[0.12em] text-neutral-500"
                >
                  {t}
                </span>
              ))}
            </div> */}

            <div className="mt-7 grid grid-cols-2 gap-6 border-t border-neutral-300 pt-7 md:mt-8 md:pt-8">
              <div>
                <p className="text-4xl font-light text-violet-600 md:text-5xl">
                  0<span className="text-xl md:text-2xl">%</span>
                </p>
                <p className="mt-1 text-sm text-neutral-600">
                  플랫폼 수수료
                  <br />
                  <span className="text-neutral-400">소액 의뢰 건은 수수료 0%</span>
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

          <Half tone="white" top={['Why SOOM', '2026']} foot={[BRAND, `02 / ${pad(TOTAL)}`]}>
            <Label>Four benefits</Label>
            <div className="mt-6 grid grid-cols-2 gap-3">
              {[
                ['부업 수익', '퇴근 후 부업으로 더 벌 수 있어요.'],
                ['디자이너 친화적 수익모델', '소액 외주 건과 개발협력 건에 대해서는 수수료 0%'],
                ['포트폴리오', '돈을 벌면서 자연스럽게 결과물 쌓여요.'],
                ['더 큰 계약', '소액 외주가 더 큰 계약으로 이어질 수 있어요.'],
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
          </Half>
        </Spread>

        {/* ─────────── 03 SAMPLE FIRST ─────────── */}
        <Spread id={3}>
          <Half tone="cream" top={['Feature · 02', 'Your choice']} foot={[BRAND, 'L']}>
            {/* 우측 쪽과 같은 값만큼 올려 두 쪽의 첫 줄이 같은 높이에서 시작한다 */}
            <div className="md:-mt-12">
              <Label>Choice</Label>

              {/* 같은 문장이 우측에서 크게 나오므로 좌측은 한 줄로만 받는다.
                  라벨 쪽으로 당겨 붙이고, 줄어든 만큼 아래 본문과 벌린다. */}
              <h2 className="mt-3 text-2xl font-semibold leading-snug tracking-tight md:mt-4 md:text-4xl">
                클라이언트와 디자이너 모두 <br/>
                <span className="text-violet-600">원하는 의뢰 유형 선택</span>
              </h2>

              {/* 클라이언트가 무엇을 의뢰하는지 먼저 — 그걸 알아야
                  "그중에서 고른다"가 이해된다. */}
              <p className="mt-8 text-lg leading-relaxed text-neutral-600 md:mt-12 md:text-xl">
                SOOM에게 의뢰를 주는 클라이언트는
                <br />
                <b className="font-semibold text-neutral-900">메인 시안만 의뢰</b>,{' '}
                <b className="font-semibold text-neutral-900">디자인 전체 의뢰</b>,{' '}
                <b className="font-semibold text-neutral-900">디자인 + 개발 의뢰</b> 중에서
                선택합니다.
              </p>
            </div>
          </Half>

          <Half tone="white" top={['The client', '2026']} foot={[BRAND, `03 / ${pad(TOTAL)}`]}>
            {/* Half 의 세로 가운데 정렬은 그대로 두고 그 자리에서만 조금 올린다 —
                mb-auto 로 아래를 비우면 쪽 맨 위에 붙어버린다. */}
            <div className="md:-mt-12">
              <p className="text-sm font-medium tracking-[0.2em] text-violet-600">
                클라이언트가 고르는 것
              </p>

              {/* 디자이너에게는 배경 설명일 뿐이다 — 테두리 대신 사이 구분선만 두고
                  한 줄에 셋을 나란히 놓아 아래 핵심 문장에 자리를 넘긴다. */}
              <ul className="mt-5 grid grid-cols-3 divide-x divide-neutral-200">
                {[
                  ['메인 시안만 의뢰', '29,000 ~ 129,000원'],
                  ['디자인 전체 의뢰', '본계약'],
                  ['디자인 + 개발 의뢰', '본계약'],
                ].map(([t, price], i) => (
                  /* 첫 칸만 왼쪽 패딩을 떼어 글자가 쪽의 왼쪽 선에 맞는다 */
                  <li key={t} className={i === 0 ? 'pr-3' : 'px-3 last:pr-0'}>
                    <span className="block font-mono text-xs text-violet-600">{pad(i + 1)}</span>
                    <span className="mt-1.5 block text-sm font-medium">{t}</span>
                    <span className="mt-1 block text-xs text-neutral-500">{price}</span>
                  </li>
                ))}
              </ul>

              {/* 제안서의 핵심 문장 — 좌측에서 넘겨받아 여기서 크게 말한다 */}
              <p className="mt-8 text-2xl md:text-3xl font-semibold leading-snug tracking-tight md:text-3xl md:leading-[1.45]">
                디자이너는 그 중 <br/>
                <span className="text-violet-600">받고자 하는 의뢰유형만
                <br />
                직접 선택</span> 합니다.
              </p>

             

            </div>
          </Half>
        </Spread>

        {/* ─────────── 04 SIDE JOB ─────────── */}
        <Spread id={4}>
          <Half tone="cream" top={['Feature · 03', 'Side job']} foot={[BRAND, 'L']}>
            <Label>For side job</Label>
            <h2 className="mt-5 text-3xl font-semibold leading-snug tracking-tight md:text-5xl">
              본업이 바빠 <br/>
              <span className="text-violet-600">
                시간이 별로 없다면
              <br />
              소액 의뢰만
              체크</span>하세요.
            </h2>
            <Rule />
            <p className="max-w-sm text-base leading-relaxed text-neutral-600 md:text-lg">
              시간 부담 없이, 퇴근 후·주말에 한 건씩 진행할 수 있습니다.
            </p>
          </Half>

          <Half tone="white" top={['Types', '2026']} foot={[BRAND, `04 / ${pad(TOTAL)}`]}>

            <p className="mt-4 text-md md:text-xl leading-relaxed">
              <span className="text-violet-600 font-semibold">바쁠 때는 메인 시안만, 여유가 생기면 더 큰 건까지 — </span>
              <br/>설정에서 언제든 바꿀 수
              있습니다.
            </p>

            <p className="mt-4 text-md md:text-xl leading-relaxed">
              <span className="text-violet-600 font-semibold">
                혹시 소액외주는 싫다면 — </span>
              <br/>
              본계약 건 의뢰만 체크할 수도 있어요.            
            </p>

            <p className="mt-10 text-sm font-medium tracking-[0.2em] text-violet-600 md:mt-10">
              받을 유형 고르기
            </p>

            {/* 앞 쪽에서 본 세 유형 중 무엇을 켤지 — 체크 모양 그대로 */}
            <div className="mt-4 space-y-2.5">
              {[
                {
                  t: '메인 시안 의뢰',
                  s: '웹/앱 메인 · 주요 화면 시안',
                  price: '29,000 ~ 129,000원',
                  on: true,
                  tag: '기본',
                },
                {
                  t: '디자인 전체 의뢰',
                  s: '서비스 전체 화면 디자인',
                  price: '본계약',
                  on: false,
                },
                {
                  t: '디자인 + 개발 의뢰',
                  s: '개발자와 협업하는 통합 프로젝트',
                  price: '본계약',
                  on: false
                },
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
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold">{x.t}</span>
                      {x.tag && (
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                            x.on ? 'bg-violet-600 text-white' : 'bg-neutral-200 text-neutral-600'
                          }`}
                        >
                          {x.tag}
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 block text-xs text-neutral-500">{x.s}</span>
                  </span>
                  <span className="shrink-0 text-right text-xs font-semibold text-violet-600">
                    {x.price}
                  </span>
                </div>
              ))}
            </div>

            <p className="mt-2.5 text-xs leading-relaxed text-neutral-500">
              * &lsquo;디자인 + 개발 의뢰&rsquo;건은 SOOM과 협력하는 일부 디자이너분들만 받을 수
              있어요.
            </p>
          </Half>
        </Spread>

        {/* ─────────── 05 THE MODEL ─────────── */}
        <Spread id={5}>
          <Half tone="cream" top={['Feature · 04', 'The Model']} foot={[BRAND, 'L']}>
            <Label>How it works</Label>
            <h2 className="mt-5 text-2xl font-semibold leading-snug tracking-tight md:text-4xl">
              소액 메인 시안 의뢰가
              <br />더 큰 계약으로 이어질 수도 있어요.
            </h2>
            <ol className="mt-8 space-y-5 border-l border-violet-600 pl-6 md:mt-10 md:space-y-6">
              {[
                ['의뢰 접수', '고객이 29,000원 ~ 129,000원으로 웹/앱 메인 샘플시안 의뢰'],
                [
                  'AI 제작',
                  'AI를 통해 빠르게 디자인시스템 생성, 혹은 기존 디자인시스템을 활용하면서, AI 활용으로 웹/앱 시안을 제작합니다.',
                ],
                ['시안 전달', '고객은 결과물을 보고 본 계약 여부를 결정'],
                ['본 계약', '전체 디자인 외주 · 전체 개발 외주로 확장'],
              ].map(([t, s], i) => (
                <li key={t} className="relative">
                  <span className="absolute -left-[1.85rem] top-1 size-2.5 rounded-full bg-violet-600" />
                  <p className="text-[10px] tracking-[0.3em] text-neutral-500">
                    STEP {pad(i + 1)}
                  </p>
                  <p className="mt-1 font-semibold">{t}</p>
                  <p className="text-sm leading-relaxed text-neutral-600">{s}</p>
                </li>
              ))}
            </ol>
          </Half>

          <Half tone="white" top={['Quote', '2026']} foot={[BRAND, `05 / ${pad(TOTAL)}`]}>
            <span className="grid size-9 place-items-center rounded-full bg-violet-600 font-serif text-lg text-white">
              &ldquo;
            </span>
            <p className="mt-5 text-xl font-medium leading-snug md:text-3xl">
              작은 시안 하나가
              <br />
              <span className="text-violet-600">더 큰 프로젝트</span>의 시작이 됩니다.
            </p>
            <p className="mt-5 text-sm leading-relaxed text-neutral-600">
              소액 외주로 시작하지만, 시안이 마음에 든 고객은 전체 디자인이나 개발까지 맡기게
              됩니다. 첫 시안을 만든 디자이너에게 다음 계약의 기회가 먼저 돌아갑니다.
            </p>

            <div className="mt-7 grid grid-cols-3 gap-2 md:mt-8">
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

        {/* ─────────── 06 ELIGIBILITY ─────────── */}
        <Spread id={6}>
          <Half tone="cream" top={['Feature · 05', 'Who we look for']} foot={[BRAND, 'L']}>
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

          <Half tone="white" top={['Requirements', '2026']} foot={[BRAND, `06 / ${pad(TOTAL)}`]}>
            <p className="text-[11px] tracking-[0.35em] text-violet-600">REQUIRED</p>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 bg-neutral-900 px-5 py-4 text-white">
              <span className="font-semibold">Figma 웹디자인 가능(웹 or 앱 포폴 필수)</span>
            </div>

            <p className="mt-6 text-[11px] tracking-[0.35em] text-violet-600">AND ONE OF</p>
            <div className="mt-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border border-neutral-300 px-5 py-4">
                <span className="font-medium">실무 경력</span>
                <span className="text-sm text-neutral-500">6개월 이상</span>
              </div>
              <div className="flex items-center gap-3 py-3">
                <span className="h-px flex-1 bg-neutral-200" />
                {/* 그림으로 뜰 때 글자 폭이 화면보다 조금 넓게 잡혀 '혹 / 은'으로
                    끊긴다 — 줄을 못 바꾸게 묶고, 양옆 선이 대신 줄어들게 한다 */}
                <span className="shrink-0 whitespace-nowrap text-xs tracking-widest text-neutral-400">
                  OR
                </span>
                <span className="h-px flex-1 bg-neutral-200" />
              </div>
              <div className="border border-dashed border-neutral-300 px-5 py-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">디자인계열 전공자</span>
                </div>
              </div>
            </div>
          </Half>
        </Spread>

        {/* ─────────── 07 LAUNCH EVENT ─────────── */}
        <Spread id={7}>
          <Half tone="cream" top={['Feature · 06', 'Launch event']} foot={[BRAND, 'L']}>
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

          <Half tone="white" top={['Gift', '2026']} foot={[BRAND, `07 / ${pad(TOTAL)}`]}>
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

        {/* ─────────── 08 CONTACT ─────────── */}
        <Spread id={8}>
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
            <Label>How to apply</Label>
            <h2 className="mt-5 text-2xl font-semibold leading-snug tracking-tight md:text-3xl">
              신청은 두 가지면 충분해요.
            </h2>
            <ul className="mt-7 space-y-3 md:mt-8">
              {[
                ['01', '이력서', '파일 또는 짧은 자기소개'],
                ['02', '포트폴리오', '파일 또는 URL'],
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

            {/* v1-2 에서는 여기가 지원 메일이었다 — 신청은 신청 화면으로 보내고,
                메일은 궁금한 점을 묻는 창구로 작게 남긴다 */}
            <Link
              href="/designers/apply"
              className="group mt-6 flex flex-wrap items-center gap-x-4 gap-y-1 bg-violet-600 px-5 py-5 text-white transition hover:bg-violet-700"
            >
              <span className="text-[10px] tracking-[0.3em] text-violet-200">APPLY</span>
              <span className="text-base font-semibold md:text-lg">SOOM 디자이너 신청하기</span>
              <span className="ml-auto transition group-hover:translate-x-1">→</span>
            </Link>
            <a
              href="mailto:manager@soom.it?subject=[SOOM 디자이너 문의]"
              className="mt-3 flex items-center gap-3 text-sm text-neutral-500 transition hover:text-violet-600"
            >
              <span className="text-[10px] tracking-[0.3em]">문의</span>
              manager@soom.it
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
