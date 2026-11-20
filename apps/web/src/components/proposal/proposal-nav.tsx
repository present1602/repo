import Link from 'next/link'

/* 제안서 위에 붙는 쪽 번호.

   앵커(#p1)로만 움직인다 — globals.css 의 scroll-behavior:smooth 가
   부드럽게 흐르게 하고, "동작 줄이기"를 켠 사용자에게는 적용되지 않는다.
   스크립트로 직접 옮기면 그 설정을 무시하게 된다. */
export function ProposalNav({ total }: { total: number }) {
  const pad = (n: number) => String(n).padStart(2, '0')

  return (
    <header className="sticky top-0 z-30 border-b border-neutral-200 bg-neutral-100/90 backdrop-blur">
      {/* 본문과 같은 여백을 쓴다 — 바만 끝까지 붙으면 윗선이 어긋나 보인다 */}
      <div className="mx-auto flex h-14 max-w-[110rem] items-center justify-between gap-3 px-4 text-xs md:px-10 lg:px-16 xl:pl-16 xl:pr-28 2xl:pl-24 2xl:pr-32">
        <Link href="/" className="shrink-0 text-neutral-600 transition hover:text-neutral-900">
          ← 홈
        </Link>

        {/* 좁은 화면에서는 쪽 번호에 자리를 내준다.
            번호가 빠지는 xl 부터는 오른쪽 끝으로 보내 자리를 채운다. */}
        <span className="hidden tracking-[0.3em] text-neutral-500 lg:inline xl:ml-auto">
          SOOM · DESIGNER EDITION · VOL. 01
        </span>

        {/* 넓은 화면에서는 좌측 레일(ProposalRail)이 같은 일을 한다 —
            번호를 두 군데 두면 어느 쪽을 눌러야 할지 묻게 된다 */}
        <nav className="flex gap-1 xl:hidden">
          {Array.from({ length: total }, (_, i) => (
            <a
              key={i}
              href={`#p${i + 1}`}
              aria-label={`${i + 1}쪽으로`}
              className="grid size-7 place-items-center rounded-full text-[10px] text-neutral-500 transition hover:bg-violet-600 hover:text-white"
            >
              {pad(i + 1)}
            </a>
          ))}
        </nav>
      </div>
    </header>
  )
}
