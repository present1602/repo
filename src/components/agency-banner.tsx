/* 홈 맨 아래, 의뢰 띠(home-cta.tsx)와 푸터 사이에 끼는 다른 회사 안내.

   SOOM 은 디자인 의뢰를 받는 자리다. 기업형 관리자페이지나 맞춤형 관리시스템을
   찾아 들어온 손님은 여기서 받을 수 없으니 같은 회사의 개발 에이전시로 보낸다.

   어두운 띠로 바닥색을 바꿔 "여기부터는 다른 회사 이야기"로 읽히게 한다.
   위 의뢰 띠의 '의뢰하기'가 주인공이라 여기 버튼은 테두리만 두른다. */
export function AgencyBanner() {
  return (
    <section aria-labelledby="agency-banner-title" className="bg-night text-[#efe6e9]">
      <div className="mx-auto flex max-w-[1240px] flex-col gap-5 px-5 py-11 md:flex-row md:items-center md:justify-between md:gap-10 md:px-8">
        <div className="min-w-0">
          <p className="eyebrow text-[#d9a9b9]">Development</p>
          <h2 id="agency-banner-title" className="mt-2.5 text-[clamp(1.1rem,2vw,1.45rem)] leading-[1.45] font-medium tracking-[-0.03em]">
            기업형 관리자페이지나 맞춤형 관리시스템 개발이 필요한가요?
          </h2>
          <p className="mt-1.5 text-[13px] text-[#efe6e9]/60">개발 중심 의뢰는 에이전시숨으로 의뢰주세요.</p>
        </div>

        <a
          href="https://agency.soom.it/"
          target="_blank"
          rel="noopener noreferrer"
          className="group inline-flex min-h-12 shrink-0 items-center gap-4 self-start border border-[#efe6e9]/35 px-6 text-sm font-semibold transition hover:bg-[#efe6e9] hover:text-night focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#d9a9b9] md:self-center"
        >
          에이전시숨으로
          <span aria-hidden="true" className="transition-transform group-hover:translate-x-1 motion-reduce:transform-none">→</span>
          <span className="sr-only"> (새 탭에서 열기)</span>
        </a>
      </div>
    </section>
  )
}
