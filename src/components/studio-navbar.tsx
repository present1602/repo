import Link from 'next/link'

/* 디자이너 화면(/studio — 로그인·가입 포함) 바.

   스튜디오는 디자이너가 일하는 자리다 — 방문자용 메뉴(탐색·의뢰하기)는
   클라이언트가 쓰는 것이라 두지 않는다. 지금은 로고만 왼쪽 끝에 두고,
   누르면 방문자 홈으로 간다. 디자이너용 메뉴가 생기면 여기에 더한다.

   좌측 메뉴가 화면 왼쪽 끝에 붙으므로(studio/page.tsx) 로고도 가운데로
   모으지 않고 같은 끝에 붙인다. */
export function StudioNavbar() {
  return (
    <header className="sticky top-0 z-20 border-b border-neutral-200 bg-white/90 backdrop-blur">
      <div className="flex h-14 items-center px-6">
        <Link
          href="/"
          className="bg-gradient-to-r from-violet-600 to-blue-500 bg-clip-text text-lg font-black tracking-tight text-transparent"
        >
          SOOM
        </Link>
      </div>
    </header>
  )
}
