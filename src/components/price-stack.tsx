import type { HomePrice } from './home-cta'

/* 홈 가격 블록 — 히어로·플랜 카드(서버)와 의뢰 띠(클라이언트)가 같이 쓴다.
   훅이 없어 어느 쪽에서 불러도 된다.

   가격은 세 단계로 읽힌다.
     1) 정상가 줄 — 할인 전 금액(was)에 줄을 긋고 바로 옆에 지금 정상가(price)
     2) 보라 상자 — 사례 게재에 동의하면 caseDiscount 만큼 더 깎은 최종가를 가장 크게
   caseDiscount 가 없는 상품(프리미엄)은 정상가 줄에 줄 그은 금액만 두고,
   상자에 price 를 '할인가'로 크게 둔다. */
const won = (n: number) => n.toLocaleString('ko-KR')

export function PriceStack({ price, was, caseDiscount, startingAt }: Pick<HomePrice, 'price' | 'was' | 'caseDiscount' | 'startingAt'>) {
  const tilde = startingAt ? '~' : ''
  const hasCase = caseDiscount != null
  const final = hasCase ? price - caseDiscount : price

  return (
    <div className="text-left">
      <div className="flex min-h-6 items-baseline justify-between gap-3 px-1 text-sm">
        <span className="shrink-0 text-xs font-medium text-neutral-500">정상가</span>
        <span className="flex flex-wrap items-baseline justify-end gap-x-2 tabular-nums">
          {was != null && (
            <s className="text-xs text-neutral-400 decoration-neutral-400">
              <span className="sr-only">할인 전 </span>
              {won(was)}원
            </s>
          )}
          {hasCase && (
            <span className="font-bold text-neutral-800">
              {won(price)}원{tilde}
            </span>
          )}
        </span>
      </div>

      <div className="mt-2.5 rounded-xl bg-violet-50 px-4 py-3.5 ring-1 ring-inset ring-violet-100">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-violet-700">{hasCase ? '사례 게재 동의 시' : '할인가'}</span>
          {hasCase && (
            <span className="rounded-full bg-violet-600 px-2 py-0.5 text-[11px] font-bold tabular-nums text-white">
              −{caseDiscount / 10_000}만원
            </span>
          )}
        </div>
        <p className="mt-1 text-[1.75rem] font-extrabold leading-tight tabular-nums tracking-tight text-violet-600 sm:text-3xl">
          {won(final)}
          <span className="ml-0.5 text-sm font-semibold">원{tilde}</span>
        </p>
      </div>
    </div>
  )
}
