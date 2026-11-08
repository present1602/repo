/* 공개 전 홈의 작업 자리 — 샘플 포트폴리오를 흐리게 깔고 그 위에 공개 예정 문구를 띄운다.
   빈 칸으로 두면 덜 만든 사이트로 보인다. 운영(soom.it)에서만 보인다 — 언제 켜지는지는 lib/pre-launch.ts 의 PRE_LAUNCH.

   이미지는 dev 의 샘플 작업 썸네일을 public/teaser 로 옮겨 둔 것이다 — 운영 DB 에는 아직 보여 줄
   작업이 없어 DB 에서 읽지 않는다. [파일, 가로, 세로] — 원본 비율을 살려 벽돌처럼 보이지 않게 */
const IMAGES: [string, number, number][] = [
  ['01.webp', 1600, 1245],
  ['02.webp', 1600, 1035],
  ['03.webp', 1600, 1168],
  ['06.webp', 1600, 3419],
  ['04.webp', 1600, 1169],
  ['05.webp', 1600, 1051],
  ['07.webp', 1600, 2395],
  ['09.webp', 1600, 1001],
  ['08.webp', 1400, 2783],
  ['11.webp', 1600, 1200],
  ['12.webp', 1600, 1150],
  ['10.webp', 1400, 2600],
  ['13.webp', 1600, 1250],
  ['14.webp', 1600, 1200],
  ['15.webp', 1600, 1200],
  ['16.webp', 1600, 1200],
]

export function WorksTeaser() {
  return (
    /* 높이를 잘라 아래로 더 이어질 것처럼 보이게 — 끝을 흰색으로 흐려 사진이 중간에 끊긴다 */
    <div className="relative h-[28rem] overflow-hidden rounded-2xl md:h-[36rem]">
      <div
        aria-hidden
        className="pointer-events-none columns-2 gap-3 blur-[10px] select-none md:columns-3 md:gap-4 lg:columns-4"
      >
        {IMAGES.map(([file, w, h]) => (
          <div
            key={file}
            style={{ aspectRatio: `${w}/${h}` }}
            className="mb-3 break-inside-avoid overflow-hidden rounded-xl bg-neutral-200 md:mb-4"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- 흐리게 까는 배경이라 최적화가 필요 없다 */}
            <img src={`/teaser/${file}`} alt="" loading="lazy" className="size-full object-cover" />
          </div>
        ))}
      </div>

      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-white/0 to-white" />

      <div className="absolute inset-0 grid place-items-center px-6">
        <p className="rounded-2xl bg-white/90 px-8 py-5 text-xl font-black tracking-[0.2em] shadow-lg ring-1 ring-neutral-200 backdrop-blur md:text-2xl">
          COMING SOON
        </p>
      </div>
    </div>
  )
}
