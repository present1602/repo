import Image from 'next/image'
import pcShot from '@/assets/about/gyeol-pc.jpg'
import mobileShot from '@/assets/about/gyeol-mobile.jpg'

/* 샘플 사이트를 아이맥·갤럭시 모양 틀에 넣어 보여 준다.

   틀은 이미지로 굽지 않고 CSS 로 그린다 — 화면 크기마다 선명하고, 사이트
   캡처만 바꾸면 틀은 그대로 쓴다. 캡처는 src/assets/about 에 있다
   (PC 1440×810, 모바일 384×832 화면을 그대로 찍은 것).

   크기는 모두 % 로 잡아 부모 너비에 맞춰 함께 줄어든다. */
export function DeviceMockup() {
  return (
    <div className="relative mx-auto w-full max-w-[640px] pb-[6%] pr-[9%]">
      {/* 아이맥 — 흰 베젤 화면 + 연보라 턱 + 받침 */}
      <div className="relative">
        <div className="overflow-hidden rounded-[clamp(10px,2.4%,18px)] shadow-[0_30px_60px_-30px_rgb(60_30_40/0.45)] ring-1 ring-black/5">
          <div className="bg-white p-[1.6%] pb-[1.4%]">
            <div className="overflow-hidden rounded-[3px] bg-neutral-900 ring-1 ring-black/70">
              <Image
                src={pcShot}
                alt="샘플 사이트 결 스페이스의 PC 화면"
                placeholder="blur"
                sizes="(min-width: 1024px) 560px, 90vw"
                className="block h-auto w-full"
              />
            </div>
          </div>
          {/* 턱 — 높이를 % 로 주면 부모 높이가 없어 0 이 된다. 너비 기준인 aspect 로 잡는다 */}
          <div className="aspect-[100/6.5] bg-linear-to-b from-[#f1ebe4] to-[#e4dbd4]" />
        </div>
        {/* 받침 — 위가 좁고 아래가 넓은 사다리꼴 */}
        <div
          aria-hidden
          className="mx-auto aspect-[22/10] w-[22%] bg-linear-to-b from-[#ddd3cb] to-[#cfc3ba]"
          style={{ clipPath: 'polygon(8% 0, 92% 0, 100% 100%, 0 100%)' }}
        />
        <div aria-hidden className="mx-auto aspect-[26/1.1] w-[26%] rounded-b-md bg-[#c6b9b0]" />
      </div>

      {/* 갤럭시 — 얇고 고른 검은 베젤, 가운데 펀치홀 카메라 */}
      <div className="absolute bottom-0 right-0 w-[25%]">
        <div className="relative rounded-[18%/8.5%] bg-[#1b1b1f] p-[4.5%] shadow-[0_24px_40px_-16px_rgb(40_20_30/0.55)] ring-1 ring-white/10">
          {/* 옆 버튼 — 오른쪽 모서리에 음량·전원 */}
          <span aria-hidden className="absolute -right-[2.5%] top-[18%] h-[12%] w-[2.5%] rounded-r-sm bg-[#2a2a30]" />
          <span aria-hidden className="absolute -right-[2.5%] top-[33%] h-[7%] w-[2.5%] rounded-r-sm bg-[#2a2a30]" />
          <div className="relative overflow-hidden rounded-[13%/6%] bg-black">
            <Image
              src={mobileShot}
              alt="샘플 사이트 결 스페이스의 모바일 화면"
              placeholder="blur"
              sizes="(min-width: 1024px) 160px, 25vw"
              className="block h-auto w-full"
            />
            <span aria-hidden className="absolute left-1/2 top-[1.6%] aspect-square w-[6%] -translate-x-1/2 rounded-full bg-black ring-1 ring-white/10" />
          </div>
        </div>
      </div>
    </div>
  )
}
