import type { TeaserImage } from '@/lib/public-designers'

/* 공개 전 홈의 작업 자리 — 베타 디자이너들의 작업을 흐리게 깔고 그 위에 공개 예정 문구를 띄운다.
   빈 칸으로 두면 덜 만든 사이트로 보인다. 운영(soom.it)에서만 보인다 — 언제 켜지는지는 explore-gate.tsx 의 PRE_LAUNCH.

   images 가 비면(작업이 아직 없거나 불러오는 중) 회색 칸으로 같은 벽 모양을 채운다. */
const RATIOS = ['3/4', '1/1', '4/5', '3/5', '4/3', '2/3']
const COUNT = 16

export function WorksTeaser({ images = [] }: { images?: TeaserImage[] }) {
  const tiles = images.length > 0 ? images : Array.from({ length: COUNT }, () => null)

  return (
    <div className="relative overflow-hidden rounded-2xl">
      <div
        aria-hidden
        className="pointer-events-none columns-2 gap-3 blur-md select-none md:columns-3 md:gap-4 lg:columns-4"
      >
        {tiles.map((img, i) => (
          <div
            key={i}
            style={{
              /* 원본 비율을 살린다 — 모르면 번갈아 가며 높이를 달리해 벽돌처럼 보이지 않게 */
              aspectRatio: img?.width && img.height ? `${img.width}/${img.height}` : RATIOS[i % RATIOS.length],
            }}
            className="mb-3 break-inside-avoid overflow-hidden rounded-xl bg-neutral-200 md:mb-4"
          >
            {img && (
              /* eslint-disable-next-line @next/next/no-img-element -- 흐리게 까는 배경이라 최적화가 필요 없다 */
              <img src={img.url} alt="" loading="lazy" className="size-full object-cover" />
            )}
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
