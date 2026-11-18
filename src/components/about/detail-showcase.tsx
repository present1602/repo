'use client'

import { useEffect, useRef, useSyncExternalStore } from 'react'
import Image, { type StaticImageData } from 'next/image'
import isoiShot from '@/assets/about/detail-isoi.png'
import koshortShot from '@/assets/about/detail-koshort.png'
import { embedUrl, playerCommand } from '@/lib/youtube'
import { MOTION_BANNER_VIDEO } from '@/lib/landing-package'

/* 소개 상세페이지 구역의 그림 무대 — 케이스 두 장을 엇갈려 겹치고, 모션배너 휴대폰을 얹는다.

   케이스 두 장은 박자를 어긋나게 위아래로 떴다 내려온다(globals.css 의 float-bob).
   모션배너는 무대가 화면 가운데까지 올라오면 제자리(넓은 화면 오른쪽 위, 좁은 화면 아래)에서
   가운데로 0.5초 만에 옮겨 가며 커지고, 도착하면 재생한다. 넓은 화면에서는 이때 케이스 두 장이
   휴대폰 좌우로 벌어진다(arrange). 다시 위로 올려
   무대가 내려가거나 화면을 벗어나면 제자리로 돌아가며 멈춘다.

   제자리는 offsetLeft/Top 으로 잰다 — transform 영향을 받지 않아 옮겨 간 뒤에도 같은 값이다.
   동작 줄이기를 켜면 옮기지 않고 재생만 한다. */

/* 무대 가운데가 화면 위에서 이 비율 선을 넘어 올라오면 옮겨 간다 */
const GO_AT = 0.55
/* 이 선 아래로 다시 내려가면 돌아온다 — 경계에서 오락가락하지 않게 간격을 둔다 */
const BACK_AT = 0.8
/* 옮겨 가는 시간 — transition 과 재생 시점이 같이 쓴다 */
const MOVE_MS = 500
/* 넓은 화면에서 좌우로 벌어질 때 케이스 크기 */
const CASE_SCALE = 0.9

/* 주소는 바뀌지 않으므로 구독할 것이 없다 */
const noop = () => () => {}

export function DetailShowcase() {
  const stageRef = useRef<HTMLDivElement>(null)
  const phoneRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef<HTMLIFrameElement>(null)
  const case1Ref = useRef<HTMLElement>(null)
  const case2Ref = useRef<HTMLElement>(null)
  /* 플레이어에 명령을 보내려면 이 페이지 주소(origin)를 embed 주소에 실어야 한다 —
     서버에서는 모르므로 그때는 영상 칸을 비워 둔다 */
  const origin = useSyncExternalStore(noop, () => window.location.origin, () => null)
  const src = origin
    ? `${embedUrl(MOTION_BANNER_VIDEO, origin)}&loop=1&playlist=${MOTION_BANNER_VIDEO}&controls=0`
    : null

  useEffect(() => {
    const stage = stageRef.current
    const phone = phoneRef.current
    if (!stage || !phone) return
    const still = window.matchMedia('(prefers-reduced-motion: reduce)')
    let active = false
    let playing = false
    let frame = 0
    let playTimer = 0

    /* 옮겨 간 모습 — 화면 크기가 바뀌면 다시 잰다.
       넓은 화면: 휴대폰은 무대 가운데보다 조금 왼쪽(무대 폭의 48% 자리)에 서고, 케이스 두 장이
       그 좌우로 비스듬히 벌어져 각자 10% 만 휴대폰 뒤에 가려진다.
       좁은 화면: 휴대폰만 무대 한가운데로 온다(케이스는 그대로) */
    const arrange = (on: boolean) => {
      const wide = window.matchMedia('(min-width: 1024px)').matches
      const cases = [case1Ref.current, case2Ref.current]
      if (!on || still.matches) {
        phone.style.transform = ''
        for (const c of cases) {
          if (!c) continue
          c.style.translate = ''
          c.style.rotate = ''
          c.style.scale = ''
        }
        return
      }
      const w = phone.offsetWidth
      const h = phone.offsetHeight
      const cx = stage.clientWidth * (wide ? 0.48 : 0.5)
      /* 좁은 화면은 무대 가운데까지 끌어올리면 케이스를 덮으며 위로 튀어 오른다 —
         제자리에서 무대 높이의 6% 만 살짝 올리고 조금만 키운다 */
      const cy = wide ? stage.clientHeight / 2 : phone.offsetTop + h / 2 - stage.clientHeight * 0.06
      /* 무대 높이의 92% 안에서 가장 크게 — 넓은 화면 1.5배, 좁은 화면 1.12배까지 */
      const scale = Math.max(1, Math.min(wide ? 1.5 : 1.12, (stage.clientHeight * 0.92) / h))
      phone.style.transform = `translate(${cx - (phone.offsetLeft + w / 2)}px, ${cy - (phone.offsetTop + h / 2)}px) scale(${scale})`

      cases.forEach((c, i) => {
        if (!c) return
        if (!wide) {
          c.style.translate = ''
          c.style.rotate = ''
          c.style.scale = ''
          return
        }
        const cw = c.offsetWidth
        const ch = c.offsetHeight
        /* 휴대폰 가장자리에서 케이스 폭의 10% 만 안쪽으로 들어가 겹친다 — 제품이 가려지지 않게.
           그만큼 바깥으로 밀려나므로 90% 크기로 줄여 무대 밖으로 덜 나가게 한다 */
        const side = i === 0 ? -1 : 1
        const shown = cw * CASE_SCALE
        const tx = cx + side * ((w * scale) / 2 + shown * 0.4)
        /* 나란히 세우지 않고 비스듬히 — 오른쪽은 위로, 왼쪽은 아래로(무대 높이의 11%씩) */
        const ty = cy - side * stage.clientHeight * 0.11
        c.style.translate = `${tx - (c.offsetLeft + cw / 2)}px ${ty - (c.offsetTop + ch / 2)}px`
        /* 바깥쪽으로 조금 더 기울인다 — 제자리 각도(-7°, 5°)에서 5°씩 더 */
        c.style.rotate = side < 0 ? '-12deg' : '10deg'
        c.style.scale = String(CASE_SCALE)
      })
    }

    const play = (on: boolean) => {
      window.clearTimeout(playTimer)
      if (on === playing) return
      playing = on
      playerCommand(frameRef.current, on ? 'playVideo' : 'pauseVideo')
    }

    const update = () => {
      frame = 0
      const r = stage.getBoundingClientRect()
      const vh = window.innerHeight
      const mid = r.top + r.height / 2
      const visible = r.bottom > 0 && r.top < vh

      if (!active && visible && mid <= vh * GO_AT) {
        active = true
        arrange(true)
        /* 다 옮겨 간 뒤 재생 */
        window.clearTimeout(playTimer)
        playTimer = window.setTimeout(() => play(true), still.matches ? 0 : MOVE_MS)
      } else if (active && (!visible || mid > vh * BACK_AT)) {
        active = false
        arrange(false)
        play(false)
      } else if (active) {
        arrange(true)
      }
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    /* 플레이어가 늦게 뜨면 처음 보낸 재생 명령을 놓친다 — 다 뜬 뒤 다시 보낸다 */
    const frameEl = frameRef.current
    const onLoad = () => {
      if (active) {
        playing = false
        play(true)
      }
    }
    frameEl?.addEventListener('load', onLoad)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      frameEl?.removeEventListener('load', onLoad)
      cancelAnimationFrame(frame)
      window.clearTimeout(playTimer)
    }
  }, [src])

  return (
    <div ref={stageRef} className="relative aspect-[1/1.55] w-full lg:aspect-[1/0.86]">
      {/* 뒤에 깔리는 은은한 보라 빛 */}
      <div
        aria-hidden
        className="absolute inset-[10%_8%_4%_2%] rounded-full bg-[radial-gradient(circle,rgb(167_139_250/0.35),transparent_68%)] blur-2xl"
      />

      {/* 두 그림 모두 얼굴이 바깥쪽에 오게 — KOSHORT 는 얼굴이 왼쪽, ISOI 는 오른쪽이라
          벌어졌을 때 휴대폰 뒤로 가려지지 않는다 */}
      <CaseCard
        src={koshortShot}
        alt="KOSHORT 아이 팔레트 상세페이지 디자인 예시"
        sticker="CASE 01"
        figRef={case1Ref}
        className="left-0 top-[2%] w-[56%] -rotate-6 lg:top-[4%] lg:w-[44%] lg:-rotate-[7deg]"
        bob={{ animationDelay: '-1.4s' }}
      />
      <CaseCard
        src={isoiShot}
        alt="ISOI 진정세럼 상세페이지 디자인 예시"
        sticker="CASE 02"
        figRef={case2Ref}
        stickerTone="violet"
        className="right-0 top-[18%] z-10 w-[56%] rotate-[5deg] lg:right-auto lg:left-[24%] lg:top-[34%] lg:w-[44%]"
        bob={{ animationDuration: '5s' }}
      />

      {/* 모션배너 — 스크롤에 따라 가운데로 옮겨 가며 커진다(위 update) */}
      <div
        ref={phoneRef}
        className="absolute left-[27%] top-[50%] z-20 w-[46%] origin-center transition-transform duration-500 ease-out will-change-transform motion-reduce:transition-none lg:left-auto lg:right-[2%] lg:top-0 lg:w-[28%]"
      >
        <span className="absolute -top-3 left-3 z-10 rounded-full bg-rose-500 px-2.5 py-1 text-[10px] font-bold tracking-[0.1em] text-white shadow-md">
          ● MOTION
        </span>
        <div className="relative aspect-[9/16] overflow-hidden rounded-[1.6rem] bg-neutral-900 shadow-[0_0_0_6px_#171717,0_24px_50px_-20px_rgb(25_23_42/0.5)]">
          {src && (
            <iframe
              ref={frameRef}
              src={src}
              title="모션배너 예시 영상"
              allow="autoplay; encrypted-media; picture-in-picture"
              className="absolute inset-0 size-full"
            />
          )}
        </div>
      </div>
    </div>
  )
}

function CaseCard({
  src,
  alt,
  sticker,
  stickerTone = 'white',
  className,
  bob,
  figRef,
}: {
  src: StaticImageData
  alt: string
  sticker: string
  stickerTone?: 'white' | 'violet'
  className: string
  /* 떴다 내려오는 박자 — 두 장이 같이 움직이지 않게 늦춤·길이를 다르게 준다.
     globals.css 의 animation 묶음 선언이 클래스보다 앞서므로 style 로 덮는다 */
  bob: React.CSSProperties
  /* 모션배너가 가운데로 올 때 좌우로 벌리려고 위에서 잡는다 */
  figRef: React.Ref<HTMLElement>
}) {
  return (
    <figure ref={figRef} className={`absolute m-0 transition-[translate,rotate,scale] duration-500 ease-out motion-reduce:transition-none ${className}`}>
      <div className="float-bob" style={bob}>
        <span
          className={`absolute -top-3 left-3 z-10 rounded-full px-2.5 py-1 text-[10px] font-bold tracking-[0.1em] shadow-md ${
            stickerTone === 'violet' ? 'bg-violet-600 text-white' : 'bg-white text-neutral-900'
          }`}
        >
          {sticker}
        </span>
        <Image
          src={src}
          alt={alt}
          sizes="(min-width: 1024px) 300px, 56vw"
          className="block h-auto w-full rounded-xl bg-white shadow-[0_22px_44px_-20px_rgb(40_20_60/0.42)]"
        />
      </div>
    </figure>
  )
}
