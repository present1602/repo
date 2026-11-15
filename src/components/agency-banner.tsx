/* 홈 맨 아래, 의뢰 띠(home-cta.tsx)와 푸터 사이에 끼는 다른 회사 안내.

   SOOM 은 디자인 의뢰를 받는 자리다. 기업형 관리자페이지나 맞춤형 관리시스템을
   찾아 들어온 손님은 여기서 받을 수 없으니 같은 회사의 개발 에이전시로 보낸다.

   예전에는 이 글이 어두운 의뢰 띠 안에 작은 회색 한 줄로 끼어 있었다 —
   가격과 '의뢰하기' 버튼 옆에서는 아무도 읽지 않는다. 그래서 띠를 따로 뗀다.

   색이 들어간 어두운 띠다. 위 의뢰 띠가 흰 바탕이라 여기서 바닥색이 바뀌며
   "여기부터는 다른 회사 이야기"로 읽힌다. 다만 본 서비스의 보라(violet)가
   아니라 인디고로 둔다 — 가까운 색이되 다른 갈래로 보이게. */
export function AgencyBanner() {
  return (
    <section
      aria-labelledby="agency-banner-title"
      className="relative overflow-hidden bg-[#0f1016]"
    >
      {/* 왼쪽 아래에서 번지는 인디고 — 단색 검정보다 덜 납작하다.
          장식이라 클릭을 먹지 않는다 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_10%_120%,rgb(99_102_241/0.3),transparent_65%)]"
      />

      {/* 격자 질감 — 관리자페이지·대시보드의 표를 멀리서 암시한다.
          장식이므로 아주 옅게만 깐다. 위 띠와 맞닿는 선에서 격자가 뚝 끊기면
          이음매가 도드라지므로, 아래로 갈수록 드러나게 마스크를 씌운다. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.06] [background-image:linear-gradient(to_right,white_1px,transparent_1px),linear-gradient(to_bottom,white_1px,transparent_1px)] [background-size:3.5rem_3.5rem] [mask-image:linear-gradient(to_bottom,transparent,black_55%)]"
      />

      <div className="relative mx-auto flex max-w-7xl flex-col gap-5 px-5 py-10 md:flex-row md:items-center md:justify-between md:gap-10 md:px-8 md:py-12">
        <div className="min-w-0">
          <p className="text-[11px] font-bold tracking-[0.18em] text-indigo-300">DEVELOPMENT</p>

          <h2
            id="agency-banner-title"
            className="mt-3 text-lg font-bold leading-snug tracking-tight text-white md:text-2xl"
          >
            혹시 기업형 관리자페이지나
            <br className="hidden sm:block" />{' '}
            <span className="text-indigo-300">맞춤형 관리시스템</span> 개발이 필요한가요?
          </h2>

          <p className="mt-2.5 text-xs leading-relaxed text-white/50 md:text-sm">
            디자인이 아닌 개발 의뢰는 같은 팀의 개발 에이전시에서 맡습니다.
          </p>
        </div>

        {/* 위 띠의 '의뢰하기'가 이 화면의 주인공이다 — 여기서 같은 꼴의 채운
            버튼을 또 쓰면 둘이 싸운다. 테두리만 두른 버튼으로 한 단계 낮춘다. */}
        <a
          href="https://agency.soom.it/"
          target="_blank"
          rel="noopener noreferrer"
          className="group inline-flex shrink-0 items-center gap-2.5 self-start rounded-xl border border-white/20 bg-white/5 px-5 py-3 text-sm font-semibold text-indigo-100 transition hover:border-white/35 hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-300 md:self-center md:text-base"
        >
          에이전시숨으로
          <span
            aria-hidden
            className="transition-transform group-hover:translate-x-0.5 motion-reduce:transform-none"
          >
            →
          </span>
          <span className="sr-only"> (새 탭에서 열기)</span>
        </a>
      </div>
    </section>
  )
}
