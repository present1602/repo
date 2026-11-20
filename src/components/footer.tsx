import Link from 'next/link'

/* 모든 화면 아래에 붙는 사업자 정보.

   전자상거래법이 요구하는 표기(상호·사업자등록번호·소재지)를 담는다.
   관리 화면(/admin, /studio)에는 붙이지 않는다 — 로그인한 사람만 보는
   작업 화면이라 자리만 차지한다.

   주소·전화·상호는 layout.tsx 의 ORG_JSON_LD 와 반드시 같아야 한다. */
export function Footer() {
  return (
    <footer className="border-t border-line bg-paper-2">
      <div className="mx-auto max-w-[1240px] px-5 py-12 md:px-8 md:py-14">
        {/* 좁은 화면에서는 사업자 정보 아래로 메뉴가 쌓이고,
            넓어지면 좌우로 갈라진다 */}
        <div className="flex flex-col justify-between gap-10 sm:flex-row">
          <div className="min-w-0">
            <p className="flex items-baseline gap-2.5 text-ink">
              <span className="font-serif text-2xl leading-none font-semibold tracking-[0.08em]">SOOM</span>
              <span className="serif-i text-base">by designers,</span>
            </p>
            {/* 로고는 영문 SOOM 뿐이라, 사람들이 검색창에 적는 이름 꼴
                (에이전시숨·soom.it·숨it)을 화면 글자로 한 번 둔다 —
                구글은 페이지에 보이는 글자로만 검색어와 맞춰 본다 */}
            <p className="mt-2 text-[11px] text-ink-faint">
              에이전시숨 · soom.it · 숨it — 숨 웹디자인 · 웹개발 · 홈페이지 개발
            </p>

            <dl className="mt-5 space-y-1 text-[11px] leading-relaxed text-ink-faint">
              <Row k="상호">밸런스</Row>
              <Row k="사업자등록번호">464-12-02831</Row>
              <Row k="사업장 소재지">서울 마포구 서교동 와우산로 162-10 2층</Row>
              <Row k="전화번호">02-6954-2567</Row>
              <Row k="이메일">
                <a href="mailto:manager@soom.it" className="transition hover:text-plum">
                  manager@soom.it
                </a>
              </Row>
            </dl>
          </div>

          {/* 디자이너를 위한 길 — 고객용 화면 어디에도 없어 여기서만 들어간다 */}
          <nav aria-label="하단 메뉴" className="flex shrink-0 flex-col gap-2.5 text-xs sm:mt-1 sm:items-end">
            <Link href="/studio/login" className="text-ink-soft transition hover:text-plum">
              디자이너 로그인
            </Link>
            <Link href="/designers/proposal/v1" className="text-ink-faint transition hover:text-plum">
              디자이너 제안서
            </Link>
            <Link href="/terms" className="text-ink-faint transition hover:text-plum">
              이용약관
            </Link>
          </nav>
        </div>

        <p className="mt-10 border-t border-line pt-6 text-[11px] text-ink-faint">
          © 2026 Balance. All rights reserved.
        </p>
      </div>
    </footer>
  )
}

/* 좁은 화면에서는 라벨과 값이 한 줄에 이어 붙고, 넓어지면 라벨 폭이 맞춰진다 */
function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap gap-x-2">
      <dt className="shrink-0 sm:w-28">{k}</dt>
      <dd className="min-w-0 text-ink-soft">{children}</dd>
    </div>
  )
}
