import type { Metadata } from 'next'
import { Suspense } from 'react'
import Link from 'next/link'
import { listVisibleFaqs } from '@/lib/faqs'
import { FaqAccordion } from '@/components/faq-accordion'

export const metadata: Metadata = {
  title: '자주 묻는 질문',
  description: 'SOOM 의뢰 전에 많이 묻는 질문과 답을 모았습니다.',
  alternates: { canonical: '/faq' },
}

/* 자주 묻는 질문 한 장(0015_faqs.sql).

   어드민 → FAQ 에서 적은 글을 그대로 보여준다 — 같은 표를 문의 챗봇도
   읽으므로(chat-prompt.ts), 한 곳만 고치면 화면과 챗봇이 함께 바뀐다.

   펼치고 접는 데 <details> 를 쓴다 — 자바스크립트 없이 동작하고, 검색
   크롤러도 접힌 내용을 읽는다. 하나를 열면 나머지를 닫는 일만 클라이언트가
   맡는다(faq-accordion.tsx).

   목록은 캐시하지 않는다 — 어드민에서 질문을 고치면 곧 반영돼야 한다.
   대신 Suspense 로 감싸 머리글이 먼저 나가게 한다(explore/page.tsx 와 같은
   방침) — 없으면 cacheComponents 아래에서 프리렌더가 막힌다. */
export default function FaqPage() {
  return (
    <main className="flex-1 bg-paper text-ink">
      <div className="mx-auto grid max-w-[1240px] gap-10 px-5 py-14 md:px-8 md:py-24 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] lg:gap-20">
        {/* 왼쪽 머리말 — 넓은 화면에서는 질문을 읽어 내려가는 동안 따라온다 */}
        <header className="lg:sticky lg:top-28 lg:self-start">
          <p className="eyebrow">FAQ</p>
          <h1 className="mt-4 text-[clamp(1.75rem,3.2vw,2.4rem)] leading-[1.3] font-medium tracking-[-0.045em]">
            자주 묻는 질문
            <span className="serif-i block text-[1.3em] leading-[1.1]">Good to know.</span>
          </h1>
        </header>

        <div className="min-w-0">
          <Suspense fallback={<FaqLoading />}>
            <FaqList />
          </Suspense>

          <p className="mt-10 text-[13px] text-ink-faint">
            환불·계약 같은 자세한 조건은{' '}
            <Link href="/terms" className="text-plum underline-offset-4 hover:underline">
              이용약관
            </Link>
            에서 볼 수 있습니다.
          </p>
        </div>
      </div>
    </main>
  )
}

/* 질문을 기다리는 동안 — 머리글은 이미 떠 있으므로 자리만 지킨다 */
function FaqLoading() {
  return (
    <div className="grid py-16 place-items-center">
      <div
        role="status"
        aria-label="불러오는 중"
        className="size-7 animate-spin rounded-full border-[3px] border-line border-t-plum"
      />
    </div>
  )
}

async function FaqList() {
  const faqs = await listVisibleFaqs()

  /* 마이그레이션 전이거나 아직 켜 둔 질문이 없을 때 — 빈 화면을 두지 않는다 */
  if (faqs.length === 0) {
    return (
      <p className="py-16 text-center text-sm text-ink-faint">아직 등록된 질문이 없습니다.</p>
    )
  }

  /* 여닫는 동작만 클라이언트로 넘긴다 — 글은 여기서 서버가 그린다 */
  return <FaqAccordion faqs={faqs} />
}
