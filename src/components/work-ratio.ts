import type { PublicWork } from '@/lib/designer-shape'

/* 작업 썸네일의 자리를 미리 잡는 Tailwind aspect 클래스.

   목업은 'aspect-[9/16]' 같은 문자열을 데이터에 직접 들고 있었지만,
   실제 데이터에는 업로드 때 받아 둔 width·height 가 있다.

   Tailwind 는 빌드 시점에 클래스를 훑어 CSS 를 만든다. 임의 값(aspect-[W/H])을
   런타임에 조립하면 그 클래스가 CSS 에 없어 무시된다 — 그래서 미리 적어 둔
   몇 단계로 반올림한다. 자리만 잡는 용도이므로 정확한 비율일 필요는 없다. */

/* 세로로 가장 길게 허용하는 비율 — 가로 1에 세로 1.8.
   긴 페이지 스크린샷은 이보다 훨씬 길어서, 그대로 두면 카드 하나가
   열을 독차지하고 옆 열과 높이가 크게 어긋난다. 여기서 끊고
   잘린 티가 나도록 아래쪽을 흐리게 덮는다(WorkGallery). */
const MAX_TALL = 1 / 1.8

const STEPS: { ratio: number; cls: string }[] = [
  { ratio: 16 / 10, cls: 'aspect-[16/10]' }, // 가로형
  { ratio: 4 / 3, cls: 'aspect-[4/3]' },
  { ratio: 1, cls: 'aspect-square' },
  { ratio: 3 / 4, cls: 'aspect-[3/4]' },
  { ratio: MAX_TALL, cls: 'aspect-[1/1.8]' }, // 세로형 — 여기가 상한
]

/* 비율을 모르면 세로형으로 둔다 — 포트폴리오는 대개 세로로 길다 */
const FALLBACK = { cls: 'aspect-[1/1.8]', clipped: false }

export type Thumb = {
  /* 카드가 차지할 자리 */
  cls: string
  /* 1:1.8 보다 길어 아래가 잘렸는지 — 잘렸으면 페이드를 덮는다 */
  clipped: boolean
}

export function thumbOf(w: Pick<PublicWork, 'width' | 'height'>): Thumb {
  if (!w.width || !w.height) return FALLBACK

  const r = w.width / w.height
  if (!Number.isFinite(r) || r <= 0) return FALLBACK

  /* 상한보다 세로로 길면 상한에서 끊는다.
     object-cover + object-top 이라 위쪽이 남고 아래가 잘린다. */
  if (r < MAX_TALL) {
    return { cls: 'aspect-[1/1.8]', clipped: true }
  }

  /* 가장 가까운 단계를 고른다. 비율은 곱셈 척도이므로 로그 거리로 비교한다 —
     그냥 차를 쓰면 가로로 긴 쪽이 과하게 당겨진다. */
  let best = STEPS[0]
  let bestGap = Infinity
  for (const s of STEPS) {
    const gap = Math.abs(Math.log(r / s.ratio))
    if (gap < bestGap) {
      bestGap = gap
      best = s
    }
  }
  return { cls: best.cls, clipped: false }
}

/* 모달처럼 자리만 필요한 곳 — 잘림 여부는 쓰지 않는다 */
export function aspectOf(w: Pick<PublicWork, 'width' | 'height'>): string {
  return thumbOf(w).cls
}
