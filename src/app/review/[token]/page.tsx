import type { Metadata } from 'next'
import Link from 'next/link'
import { checkReviewToken } from '@/lib/reviews-db'
import { ReviewForm } from '@/components/review-form'

export const metadata: Metadata = {
  title: '후기 남기기 · SOOM',
  /* 링크를 받은 사람만 여는 화면이다 — 검색에 걸릴 이유가 없다 */
  robots: { index: false, follow: false },
}

/* 후기 작성 — 로그인 없이 링크로 들어온다(028_reviews.sql).

   의뢰가 끝나면 그 의뢰에만 쓸 수 있는 링크를 메일·카카오로 보내고,
   링크를 연 사람을 그 의뢰의 당사자로 본다. 계정이 아니라 '의뢰' 가
   신원을 보증하는 구조라, 비회원도 후기를 남길 수 있다.

   토큰 상태를 매번 DB 에서 확인해야 하므로 즉시 그려지는 화면이 아니다 —
   다른 화면들과 같게 instant 를 꺼 둔다(cacheComponents 가 켜져 있어
   dynamic 대신 이 값을 쓴다). */
export const instant = false

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const state = await checkReviewToken(token)

  return (
    <main className="flex-1 bg-neutral-50">
      <div className="mx-auto max-w-xl px-5 py-12 md:py-20">
        {state.ok ? (
          <>
            <header>
              <p className="text-xs font-semibold tracking-widest text-violet-600">REVIEW</p>
              <h1 className="mt-3 text-2xl font-bold tracking-tight md:text-3xl">
                {state.designerName
                  ? `${state.designerName} 디자이너와의 작업,`
                  : '이번 작업,'}
                <br />
                어떠셨나요?
              </h1>
              <p className="mt-4 text-sm leading-relaxed text-neutral-600">
                남겨 주신 후기는 확인 후 공개됩니다. 다른 분들이 디자이너를 고를 때
                큰 도움이 됩니다.
              </p>
            </header>

            <ReviewForm token={token} />
          </>
        ) : (
          <Unusable reason={state.reason} />
        )}
      </div>
    </main>
  )
}

/* 못 쓰는 링크 — 왜 못 쓰는지를 구분해 알려 준다.
   "잘못된 링크입니다" 하나로 뭉치면 기간이 지난 것인지 이미 쓴 것인지
   몰라 무작정 다시 보내 달라고 하게 된다. */
function Unusable({ reason }: { reason: 'notfound' | 'expired' | 'used' }) {
  const text = {
    used: {
      title: '이미 후기를 남기셨습니다',
      body: '한 의뢰에는 후기를 한 번만 쓸 수 있습니다. 고쳐야 할 내용이 있으면 문의해 주세요.',
    },
    expired: {
      title: '링크 사용 기간이 지났습니다',
      body: '후기 링크는 발송 후 30일간 쓸 수 있습니다. 아직 남기고 싶으시면 다시 보내 드릴게요.',
    },
    notfound: {
      title: '유효하지 않은 링크입니다',
      body: '주소가 잘못되었거나 만료된 링크입니다. 메일에 있는 링크를 다시 확인해 주세요.',
    },
  }[reason]

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-8 text-center">
      <h1 className="text-xl font-bold tracking-tight">{text.title}</h1>
      <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-neutral-600">
        {text.body}
      </p>
      <Link
        href="/"
        className="mt-7 inline-block rounded-xl bg-neutral-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-violet-600"
      >
        SOOM 둘러보기
      </Link>
    </div>
  )
}
