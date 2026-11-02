'use client'

import { useState } from 'react'
import Link from 'next/link'
import { InquiryModal } from '@/components/inquiry/inquiry-modal'

/* 사이트 공통 바.

   좌측 메뉴는 두지 않는다 — 홈으로 가는 길은 SOOM 로고가 맡고,
   그 밖에 모든 화면에서 갈 곳은 탐색과 의뢰뿐이라 우측에 모았다.
   메뉴가 다시 필요해지면 로고와 우측 묶음 사이에 nav 를 넣으면 된다. */
export function Navbar() {
  const [inquiry, setInquiry] = useState(false)

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-neutral-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-4 md:px-8">
          {/* 글자에 보라→파랑 그라데이션을 입힌다 — 배경을 글자 모양으로 잘라 낸다 */}
          <Link
            href="/"
            className="bg-gradient-to-r from-violet-600 to-blue-500 bg-clip-text text-lg font-black tracking-tight text-transparent"
          >
            SOOM
          </Link>

          <div className="ml-auto flex items-center gap-5">
            <Link
              href="/explore"
              className="text-sm font-medium text-neutral-600 transition hover:text-neutral-900"
            >
              탐색
            </Link>

            {/* 가장 하고 싶은 일 — 유일하게 색을 채운 버튼으로 둔다.
                페이지를 옮기지 않고 그 자리에서 폼을 띄운다. */}
            <button
              type="button"
              onClick={() => setInquiry(true)}
              className="rounded-lg bg-violet-600 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-violet-700"
            >
              의뢰하기
            </button>
          </div>
        </div>
      </header>

      {/* 모달은 헤더 밖에 둔다 — 헤더가 sticky 라 그 안의 fixed 는
          뷰포트가 아니라 헤더를 기준으로 자리잡는다(56px 안에 갇힌다).
          position 이 static 이 아닌 조상은 fixed 의 기준이 된다. */}
      {inquiry && <InquiryModal onClose={() => setInquiry(false)} />}
    </>
  )
}
