/* 공개 전 홈의 작업 자리 — 임시 이미지를 흐리게 깔고 그 위에 공개 예정 문구를 띄운다.
   빈 칸으로 두면 덜 만든 사이트로 보인다. 운영(soom.it)에서만 보인다 — 언제 켜지는지는 explore-gate.tsx 의 PRE_LAUNCH.

   이미지는 picsum 의 고정 시드라 매번 같은 사진이 온다 — 흐려서 무엇인지는 보이지 않는다. */
const RATIOS = ['aspect-[3/4]', 'aspect-square', 'aspect-[4/5]', 'aspect-[3/5]', 'aspect-[4/3]', 'aspect-[2/3]']

export function WorksTeaser() {
  return (
    <div className="relative overflow-hidden rounded-2xl">
      <div aria-hidden className="pointer-events-none columns-2 gap-3 blur-md select-none md:columns-3 md:gap-4 lg:columns-4">
        {Array.from({ length: 16 }, (_, i) => (
          <div key={i} className={`mb-3 break-inside-avoid overflow-hidden rounded-xl bg-neutral-200 md:mb-4 ${RATIOS[i % RATIOS.length]}`}>
            {/* eslint-disable-next-line @next/next/no-img-element -- 임시 자리 채움이라 최적화가 필요 없다 */}
            <img src={`https://picsum.photos/seed/soom-${i}/480/640`} alt="" loading="lazy" className="size-full object-cover" />
          </div>
        ))}
      </div>

      {/* 흐린 사진 위에 하얀 막을 한 겹 더 — 글이 사진 색에 묻히지 않게 */}
      <div className="absolute inset-0 grid place-items-center bg-white/40 px-6">
        <div className="rounded-2xl bg-white/85 px-7 py-6 text-center shadow-lg ring-1 ring-neutral-200 backdrop-blur">
          <span className="inline-flex rounded-full bg-violet-600 px-2.5 py-0.5 text-[11px] font-semibold tracking-wide text-white">
            COMING SOON
          </span>
          <p className="mt-3 text-lg font-bold tracking-tight md:text-xl">곧 디자이너분들의 포트폴리오가 공개됩니다</p>
        </div>
      </div>
    </div>
  )
}
