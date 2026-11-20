/* 판매가는 그대로, 실제 할인이 있을 때만 원래 가격을 함께 표시한다. */
export function PriceLabel({ label, original }: { label: string; original?: string }) {
  return <span className="inline-flex flex-wrap items-baseline justify-end gap-x-1.5 gap-y-0.5">
    {original && <del aria-label={`원래 가격 ${original}`} className="text-[11px] font-normal text-neutral-400">{original}</del>}
    <span>{label}</span>
  </span>
}
