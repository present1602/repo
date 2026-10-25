/* 썸네일 영역(크롭)의 값과 규칙.

   클라이언트 컴포넌트도 이 값을 쓰므로 server-only 모듈에 두지 않는다 —
   designers-db.ts 에 두면 supabase-admin(service_role) 이 브라우저 번들로 끌려온다.

   좌표는 모두 원본에 대한 0~1 비율이다(009_work_thumb_crop.sql).
   픽셀로 다루면 미리보기 크기가 화면마다 달라 그대로 저장할 수 없다. */

/* 고를 수 있는 썸네일 비율.

   체크를 끄면 비율 고정이 풀린다 — 그래서 '없음' 같은 항목을 두지 않고
   선택값을 null 로 둔다. value 는 가로/세로. */
export const THUMB_RATIOS = [
  { key: '16:9', value: 16 / 9 },
  { key: '9:16', value: 9 / 16 },
  { key: '4:3', value: 4 / 3 },
  { key: '3:4', value: 3 / 4 },
  { key: '1:1', value: 1 },
] as const

export type RatioKey = (typeof THUMB_RATIOS)[number]['key']

export function ratioValue(key: RatioKey): number {
  return THUMB_RATIOS.find((r) => r.key === key)!.value
}

/* 영역 하나. 모두 0~1 비율이다. */
export type Crop = { x: number; y: number; w: number; h: number }

/* 영역이 너무 작으면 썸네일이 뭉개진다 — 원본의 5% 아래로는 줄이지 못하게 한다 */
export const MIN_CROP = 0.05

const clamp01 = (n: number) => Math.min(1, Math.max(0, n))

/* 이미지 밖으로 나간 영역을 안으로 밀어 넣는다.

   크기를 먼저 범위 안으로 줄인 뒤 위치를 민다 — 순서를 바꾸면
   큰 영역이 이미지보다 커진 채로 남아 위치를 아무리 밀어도 삐져나온다. */
export function clampCrop(c: Crop): Crop {
  const w = Math.min(1, Math.max(MIN_CROP, c.w))
  const h = Math.min(1, Math.max(MIN_CROP, c.h))
  return {
    w,
    h,
    x: clamp01(Math.min(c.x, 1 - w)),
    y: clamp01(Math.min(c.y, 1 - h)),
  }
}

/* 주어진 비율로 이미지 한가운데에 가장 크게 들어가는 영역.

   ratio 는 썸네일의 가로/세로다. 이미지 자체도 정사각형이 아니므로
   원본 비율(imgRatio)을 함께 받아 0~1 공간에서의 모양을 환산한다 —
   이 보정을 빼면 16:9 를 골랐는데 세로로 긴 이미지에서 찌그러진다. */
export function centeredCrop(ratio: number, imgRatio: number): Crop {
  /* 0~1 좌표계는 가로·세로를 각각 1로 정규화한 공간이라 비율이 왜곡돼 있다.
     원본에서의 ratio 는 이 공간에서 ratio / imgRatio 가 된다. */
  const r = ratio / imgRatio

  /* 너비를 꽉 채웠을 때 높이가 넘치면 높이를 기준으로 잡는다 */
  let w = 1
  let h = w / r
  if (h > 1) {
    h = 1
    w = h * r
  }

  return { x: (1 - w) / 2, y: (1 - h) / 2, w, h }
}

/* 이미 잡아 둔 영역을 다른 비율로 바꾼다 — 중심을 지킨다.

   한가운데로 다시 잡으면(centeredCrop) 공들여 맞춰 둔 위치가 날아간다.
   면적을 대략 유지하면서 중심만 그대로 두고 모양을 바꾼다. */
export function reshapeCrop(c: Crop, ratio: number, imgRatio: number): Crop {
  const r = ratio / imgRatio
  const cx = c.x + c.w / 2
  const cy = c.y + c.h / 2

  /* 지금 면적과 같은 면적을 가진 직사각형의 변 길이 */
  const area = c.w * c.h
  let w = Math.sqrt(area * r)
  let h = w / r

  /* 이미지를 넘으면 들어갈 때까지 같은 비율로 줄인다 —
     한 변만 줄이면 비율이 깨지므로 둘 다 같은 배수로 줄인다 */
  if (w > 1 || h > 1) {
    const k = Math.min(1 / w, 1 / h)
    w *= k
    h *= k
  }

  return clampCrop({ x: cx - w / 2, y: cy - h / 2, w, h })
}

/* DB 행에서 영역을 읽는다 — 넷 중 하나라도 비면 미지정으로 본다.

   일부만 채워진 상태는 만들지 않지만(DB check 제약), 마이그레이션 전의
   행이나 외부에서 들어온 값이 섞일 수 있어 여기서 한 번 더 거른다. */
export function cropOf(row: {
  crop_x: number | null
  crop_y: number | null
  crop_w: number | null
  crop_h: number | null
}): Crop | null {
  const { crop_x: x, crop_y: y, crop_w: w, crop_h: h } = row
  if (x == null || y == null || w == null || h == null) return null
  if (!(w > 0) || !(h > 0)) return null
  return { x, y, w, h }
}

/* 영역을 CSS 로 — object-fit:cover 로 그 부분만 보이게 한다.

   컨테이너가 영역과 같은 비율이라고 보고, 이미지를 1/w 배 키운 뒤
   영역의 좌상단이 컨테이너 좌상단에 오도록 민다. background 가 아니라
   <img> 를 쓰는 곳에서도 쓸 수 있도록 transform 대신 width/left 로 낸다. */
export function cropStyle(c: Crop): React.CSSProperties {
  return {
    position: 'absolute',
    width: `${100 / c.w}%`,
    height: `${100 / c.h}%`,
    left: `${(-c.x * 100) / c.w}%`,
    top: `${(-c.y * 100) / c.h}%`,
    maxWidth: 'none',
  }
}
