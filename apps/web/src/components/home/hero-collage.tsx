import Image from 'next/image'
import pcShot from '@/assets/about/gyeol-pc.jpg'
import mobileShot from '@/assets/about/gyeol-mobile.jpg'
import livingTile from '@/assets/home/gyeol-living.jpg'
import gardenTile from '@/assets/home/gyeol-garden.jpg'

/* 홈 히어로 오른쪽 — 샘플 사이트(결 스페이스, 건축·인테리어)를 PC·모바일로
   겹쳐 놓은 콜라주. "PC와 모바일을 함께 만든다"를 그림 한 장으로 보여 준다.

   사진 타일 두 장은 같은 샘플 사이트의 작업 구역(gyeol-works.jpg)에서 잘라 낸 것이다.

   모든 자리를 % 로 잡고, 글자는 콜라주 폭 기준 단위(cqw)로 잡는다 —
   화면이 줄면 그림 전체가 한 장처럼 같이 줄어든다.

   장식이라 화면 읽기 프로그램에는 한 줄 설명만 남긴다. */
export function HeroCollage() {
  return (
    <figure className="relative mx-auto w-full max-w-[600px] [container-type:inline-size]">
      <figcaption className="sr-only">샘플 사이트 결 스페이스의 PC 화면과 모바일 화면</figcaption>

      <div aria-hidden className="relative aspect-[100/86]">
        {/* 뒤를 흐르는 가는 선 — 손으로 그은 듯한 타원 */}
        <svg viewBox="0 0 100 86" preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible text-plum/35">
          <path
            d="M10 70 C 2 40, 30 6, 66 6 C 96 6, 104 40, 90 62 C 78 82, 40 90, 22 78"
            fill="none"
            stroke="currentColor"
            strokeWidth="0.25"
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        {/* 사진 타일 — 왼쪽 위 */}
        <div className="absolute left-0 top-[4%] w-[36%] overflow-hidden shadow-[0_24px_40px_-28px_rgb(60_30_40/0.55)]">
          <Image src={livingTile} alt="" placeholder="blur" sizes="(min-width: 1024px) 220px, 36vw" className="block h-auto w-full" />
        </div>

        {/* 브라우저 창 — PC 화면 */}
        <div className="absolute left-[14%] top-[20%] z-10 w-[66%] overflow-hidden rounded-[1.2cqw] border border-line bg-card shadow-[0_40px_60px_-36px_rgb(60_30_40/0.6)]">
          <div className="flex h-[3.4cqw] items-center gap-[0.8cqw] border-b border-line bg-[#f3eeea] px-[1.6cqw]">
            <i className="size-[0.9cqw] rounded-full bg-[#d8ccc5]" />
            <i className="size-[0.9cqw] rounded-full bg-[#d8ccc5]" />
            <i className="size-[0.9cqw] rounded-full bg-[#d8ccc5]" />
            <span className="mx-auto rounded-full bg-white/80 px-[2cqw] text-[1.5cqw] leading-[2.2cqw] tracking-wide text-ink-faint">gyeol-space.com</span>
          </div>
          <Image src={pcShot} alt="" placeholder="blur" sizes="(min-width: 1024px) 400px, 66vw" className="block h-auto w-full" priority />
        </div>

        {/* 기능 카드 — 오른쪽 위 */}
        <div className="float-bob absolute right-0 top-[8%] z-20 w-[34%] rounded-[1.4cqw] border border-line bg-card/95 px-[2.6cqw] py-[2cqw] shadow-[0_24px_40px_-26px_rgb(60_30_40/0.5)] backdrop-blur [animation-duration:5s]">
          {FEATURES.map(([label, icon]) => (
            <div key={label} className="flex items-center gap-[1.6cqw] py-[1cqw]">
              <svg viewBox="0 0 24 24" className="size-[2.6cqw] shrink-0 text-ink-soft" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d={icon} />
              </svg>
              <span className="flex-1 text-[2.2cqw] font-medium text-ink">{label}</span>
              <span className="grid h-[2.6cqw] w-[5cqw] place-items-center rounded-full bg-plum text-[1.6cqw] leading-none text-white">✓</span>
            </div>
          ))}
        </div>

        {/* 모바일 — 브라우저 창 오른쪽 아래에 겹친다 */}
        <div className="absolute bottom-0 left-[58%] z-30 w-[16%] rounded-[2.4cqw] bg-ink p-[0.8cqw] shadow-[0_30px_40px_-20px_rgb(40_20_30/0.6)]">
          <div className="overflow-hidden rounded-[1.8cqw] bg-black">
            <Image src={mobileShot} alt="" placeholder="blur" sizes="(min-width: 1024px) 100px, 16vw" className="block h-auto w-full" />
          </div>
        </div>

        {/* 사진 타일 — 오른쪽 아래 */}
        <div className="absolute bottom-[8%] right-0 z-20 w-[24%] overflow-hidden shadow-[0_24px_40px_-28px_rgb(60_30_40/0.55)]">
          <Image src={gardenTile} alt="" placeholder="blur" sizes="(min-width: 1024px) 150px, 24vw" className="block h-auto w-full" />
        </div>

        {/* 글꼴·색 카드 — 왼쪽 아래 */}
        <div className="float-bob absolute bottom-[4%] left-[6%] z-30 flex items-center gap-[2cqw] rounded-[1.4cqw] border border-line bg-card/95 px-[2.6cqw] py-[1.8cqw] shadow-[0_24px_40px_-26px_rgb(60_30_40/0.5)] backdrop-blur [animation-delay:-2s] [animation-duration:4.6s]">
          <span className="border-r border-line pr-[2cqw] font-serif text-[4cqw] leading-none text-ink">Aa</span>
          <span className="size-[3.4cqw] rounded-full bg-plum" />
          <span className="size-[3.4cqw] rounded-full bg-blush" />
          <span className="size-[3.4cqw] rounded-full border border-line bg-paper" />
        </div>
      </div>
    </figure>
  )
}

const FEATURES: [string, string][] = [
  ['Design', 'm12 3 1.8 4.6L18.5 9l-4.7 1.6L12 15l-1.8-4.4L5.5 9l4.7-1.4Z M19 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8Z'],
  ['AI Assist', 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Z M12 6a6 6 0 1 0 0 12 6 6 0 0 0 0-12Z M12 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z'],
  ['Fast Delivery', 'M13 2 4 14h7l-1 8 9-12h-7l1-8Z'],
]
