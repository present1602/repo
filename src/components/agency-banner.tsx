/* 홈 맨 아래, 의뢰 띠(home-cta.tsx)와 푸터 사이에 끼는 다른 회사 안내.

   SOOM 은 디자인 의뢰를 받는 자리다. 기업형 관리자페이지나 맞춤형 관리시스템을
   찾아 들어온 손님은 여기서 받을 수 없으니 같은 회사의 개발 에이전시로 보낸다.

   예전에는 이 글이 어두운 의뢰 띠 안에 작은 회색 한 줄로 끼어 있었다 —
   가격과 '의뢰하기' 버튼 옆에서는 아무도 읽지 않는다. 그래서 띠를 따로 뗀다.

   색은 위(거의 검정 + 보라 번짐)와 아래(흰 푸터) 사이를 잇는 다리로 고른다.
   한 단계 밝은 슬레이트에 보라를 살짝 섞어 두면, 같은 집안의 다른 간판으로
   읽히면서도 윗 띠의 '의뢰하기'와 경쟁하지 않는다 — 그래서 버튼이 아니라
   밑줄 링크다. */
export function AgencyBanner() {
  return (
    <section
      aria-labelledby="agency-banner-title"
      className="relative overflow-hidden border-t border-white/[0.08] bg-[#0f1016]"
    >
      {/* 왼쪽에서 번지는 옅은 빛 — 윗 띠는 오른쪽에서 보라가 번진다.
          반대쪽에 두면 두 띠가 한 덩어리로 뭉치지 않고 서로 다른 면으로 읽힌다 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_10%_120%,rgb(99_102_241/0.28),transparent_65%)]"
      />

      {/* 격자 질감 — 관리자페이지·대시보드의 표를 멀리서 암시한다.
          장식이므로 아주 옅게만 깐다. 위 띠와 맞닿는 선에서 격자가 뚝 끊기면
          이음매가 도드라지므로, 아래로 갈수록 드러나게 마스크를 씌운다. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.06] [background-image:linear-gradient(to_right,white_1px,transparent_1px),linear-gradient(to_bottom,white_1px,transparent_1px)] [background-size:3.5rem_3.5rem] [mask-image:linear-gradient(to_bottom,transparent,black_55%)]"
      />

      <div className="relative mx-auto flex max-w-7xl flex-col gap-6 px-5 py-9 md:flex-row md:items-center md:justify-between md:gap-10 md:px-8 md:py-11">
        <div className="min-w-0">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-semibold tracking-[0.12em] text-white/70">
            <span className="size-1.5 rounded-full bg-indigo-400" /> DEVELOPMENT
          </span>

          <h2
            id="agency-banner-title"
            className="mt-4 text-lg font-bold leading-snug tracking-tight text-white md:text-2xl"
          >
            혹시 기업형 관리자페이지나
            <br className="hidden sm:block" />{' '}
            <span className="text-indigo-300">맞춤형 관리시스템</span> 개발이 필요한가요?
          </h2>

          <p className="mt-2.5 text-xs leading-relaxed text-white/50 md:text-sm">
            디자인이 아닌 개발 의뢰는 같은 팀의 개발 에이전시에서 맡습니다.
          </p>
        </div>

        {/* 윗 띠의 '의뢰하기'가 이 화면의 주인공이다 — 여기서 같은 꼴의 채운
            버튼을 또 쓰면 둘이 싸운다. 밑줄 링크로 한 단계 낮춰 둔다. */}
        <a
          href="https://agency.soom.it/"
          target="_blank"
          rel="noopener noreferrer"
          className="group inline-flex shrink-0 items-center gap-3 self-start border-b border-indigo-300/40 pb-2 text-sm font-bold text-indigo-200 transition-colors hover:border-indigo-200 hover:text-white focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-8 focus-visible:outline-indigo-300 md:self-center md:text-base"
        >
          에이전시숨으로
          <span
            aria-hidden
            className="text-lg transition-transform group-hover:translate-x-1 motion-reduce:transform-none"
          >
            →
          </span>
          <span className="sr-only"> (새 탭에서 열기)</span>
        </a>
      </div>
    </section>
  )
}
