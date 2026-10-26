import Link from 'next/link'

/* 모든 화면 아래에 붙는 사업자 정보.

   전자상거래법이 요구하는 표기(상호·사업자등록번호·소재지)를 담는다.
   관리 화면(/admin, /studio)에는 붙이지 않는다 — 로그인한 사람만 보는
   작업 화면이라 자리만 차지한다. */
export function Footer() {
  return (
    <footer className="border-t border-neutral-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-10 md:px-8 md:py-12">
        {/* 좁은 화면에서는 사업자 정보 아래로 메뉴가 쌓이고,
            넓어지면 좌우로 갈라진다 */}
        <div className="flex flex-col justify-between gap-8 sm:flex-row">
          <div className="min-w-0">
            {/* 본문보다 한 단계 연하게 — 푸터는 눈에 띄라고 두는 자리가 아니다 */}
            <p className="text-base font-black tracking-tight text-neutral-400">SOOM</p>

            <dl className="mt-3.5 space-y-1 text-[11px] leading-relaxed text-neutral-400">
              <Row k="상호">밸런스</Row>
              <Row k="사업자등록번호">464-12-02831</Row>
              <Row k="사업장 소재지">서울 마포구 서교동 와우산로 162-10 2층</Row>
              <Row k="이메일">
                <a href="mailto:manager@soom.it" className="transition hover:text-neutral-700">
                  manager@soom.it
                </a>
              </Row>
            </dl>
          </div>

          {/* 디자이너를 위한 길 — 고객용 화면 어디에도 없어 여기서만 들어간다.
              첫 줄을 '상호'와 나란히 세운다 — 왼쪽 SOOM(한 줄)과 그 아래
              여백(mt-3.5)만큼 내려야 윗선이 맞는다. */}
          <nav className="flex shrink-0 flex-col gap-2 text-[11px] sm:mt-[2.375rem] sm:items-end">
            <Link
              href="/studio/login"
              className="text-neutral-500 transition hover:text-violet-600"
            >
              디자이너 로그인
            </Link>
            <Link
              href="/designers/proposal/v1-4"
              className="text-neutral-400 transition hover:text-violet-600"
            >
              디자이너 제안서
            </Link>
            <Link href="/terms" className="text-neutral-400 transition hover:text-violet-600">
              이용약관
            </Link>
          </nav>
        </div>

        <p className="mt-8 border-t border-neutral-200 pt-6 text-[11px] text-neutral-400">
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
      <dd className="min-w-0 text-neutral-600">{children}</dd>
    </div>
  )
}
