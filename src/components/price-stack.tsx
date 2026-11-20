import type { HomePrice } from './home-cta'

/* 플랜 카드의 가격 블록 — 훅이 없어 서버·클라이언트 어디서 불러도 된다.

   가격은 세 줄로 읽힌다.
     1) 정가 줄 — 할인 전 금액(was)에 줄을 긋고 옆에 지금 정상가(price)
     2) 최종가 — 사례 게재에 동의하면 caseDiscount 만큼 더 깎은 금액을 가장 크게
     3) 추가 할인 안내 · VAT
   caseDiscount 가 없는 상품(프리미엄)은 줄 그은 금액만 두고 price 를 크게 둔다.
   그 자리(3번째 줄)는 비워 둔 채 높이만 지켜, 카드끼리 가격 줄이 나란히 선다. */
const won = (n: number) => n.toLocaleString('ko-KR')

export function PriceStack({
  price,
  was,
  caseDiscount,
  startingAt,
  vat = false,
}: Pick<HomePrice, 'price' | 'was' | 'caseDiscount' | 'startingAt'> & {
  vat?: boolean
}) {
  const tilde = startingAt ? '~' : ''
  const hasCase = caseDiscount != null
  const final = hasCase ? price - caseDiscount : price

  return (
    <div className="text-left">
      <p className="flex min-h-5 flex-wrap items-baseline gap-x-2 text-xs tabular-nums text-ink-faint">
        {was != null && (
          <s className="decoration-ink-faint">
            <span className="sr-only">할인 전 </span>
            {won(was)}원
          </s>
        )}
        {hasCase && <span>정상가 {won(price)}원{tilde}</span>}
      </p>
      <p className="mt-1 flex flex-wrap items-baseline gap-1.5">
        <b className="text-[2rem] leading-[1.15] font-semibold tracking-[-0.04em] tabular-nums text-ink">{won(final)}</b>
        <small className="text-sm text-ink-soft">원{tilde}</small>
      </p>
      <p className={`mt-1 text-xs font-semibold text-plum ${hasCase ? '' : 'invisible'}`} aria-hidden={!hasCase}>
        {hasCase ? `사례 게재 동의 시 ${caseDiscount / 10_000}만원 추가 할인` : '—'}
      </p>
      {vat && <p className="mt-0.5 text-[11px] text-ink-faint">VAT 별도</p>}
    </div>
  )
}
