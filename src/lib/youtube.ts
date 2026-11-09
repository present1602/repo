/* 유튜브 주소에서 영상 id 를 뽑고, 보여줄 embed 주소를 만든다.

   화면(입력 칸)과 서버 액션이 같이 쓴다 — 한쪽만 고치면 입력은 받아 놓고
   서버가 거절하거나, 거르지 않은 값이 저장된다.

   저장하는 것은 11자 id 뿐이다. 주소를 통째로 담아 iframe src 에 그대로
   넣으면 임의 주소가 박히는 자리가 된다 — id 만 담고 주소는 아래
   embedUrl 이 조립한다. DB 도 같은 모양을 제약으로 막는다
   (0019_work_video.sql). */

/* 유튜브 영상 id — 11자, URL 안전 문자만 */
const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/

export function isVideoId(s: string): boolean {
  return VIDEO_ID_RE.test(s)
}

/* 받아들이는 주소 모양. 디자이너가 어디서 복사해 오든 되게 넷 다 받는다.
   youtu.be 짧은 주소, 일반 시청 주소(watch?v=), 쇼츠, 그리고 이미 embed 주소. */
const PATTERNS = [
  /[?&]v=([A-Za-z0-9_-]{11})/,
  /youtu\.be\/([A-Za-z0-9_-]{11})/,
  /\/shorts\/([A-Za-z0-9_-]{11})/,
  /\/embed\/([A-Za-z0-9_-]{11})/,
  /\/live\/([A-Za-z0-9_-]{11})/,
]

/* 주소(또는 id 를 그대로 붙여넣은 것)에서 id 를 뽑는다 — 못 읽으면 null.

   빈 문자열은 null 이다 — "영상 없음"과 "주소가 틀렸다"를 부르는 쪽이
   가려야 하므로, 비었는지는 부르는 쪽에서 먼저 본다. */
export function youtubeId(input: string): string | null {
  const s = input.trim()
  if (!s) return null
  /* id 를 그대로 붙여넣는 사람도 있다 */
  if (isVideoId(s)) return s
  for (const re of PATTERNS) {
    const m = re.exec(s)
    if (m) return m[1]
  }
  return null
}

/* 보여줄 iframe 주소.

   youtube-nocookie 를 쓴다 — 재생하기 전에는 추적 쿠키를 심지 않는다.
   rel=0 은 끝난 뒤 남의 영상을 띄우지 않게(같은 채널 안에서만 추천),
   playsinline 은 iOS 에서 전체화면으로 튀지 않게 한다. */
export function embedUrl(id: string): string {
  return `https://www.youtube-nocookie.com/embed/${id}?rel=0&playsinline=1`
}

/* 영상의 가로세로 비를 알아내는 그림.

   유튜브 oEmbed 는 세로 영상(쇼츠)에도 16:9 를 돌려주므로 쓸 수 없다.
   'oar' 는 original aspect ratio — 원래 비율 그대로의 그림이라, 받아서
   크기를 재면 세로 영상인지 알 수 있다(세로 쇼츠 406×720, 가로 1280×720).
   API 키 없이 <img> 한 장으로 끝난다.

   oar2 가 없는 영상도 있다 — 그때는 16:9 로 본다(아래 DEFAULT_RATIO). */
export function youtubeRatioProbe(id: string): string {
  return `https://i.ytimg.com/vi/${id}/oar2.jpg`
}

/* 비율을 모를 때 — 가로 영상이 압도적으로 많다 */
export const DEFAULT_RATIO = 16 / 9

/* 저장해 둔 id 를 사람이 보는 주소로 — 편집 화면 입력 칸의 처음 값.
   id 만 띄우면 무엇인지 알기 어렵고, 눌러서 확인할 수도 없다. */
export function youtubeWatchUrl(id: string): string {
  return `https://youtu.be/${id}`
}

/* 영상이 들어간 작업의 표지 그림 — 아직 쓰지 않지만, 유튜브가 주는 썸네일
   주소를 한곳에 적어 둔다. 지금은 표지로 PDF 첫 장이나 올린 그림을 쓴다. */
export function youtubeThumb(id: string): string {
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`
}

/* 주소를 잘못 적었을 때 보여줄 말 — 스튜디오와 어드민이 같은 말을 쓴다 */
export const BAD_VIDEO = '유튜브 주소를 확인해 주세요. 예: https://youtu.be/abc12345678'

/* 폼에서 영상 id 를 읽는다 — 스튜디오·어드민 액션이 같이 쓴다.

   셋을 가린다. 키가 없으면 undefined("영상 칸을 다루지 않는 호출"),
   비워 보냈으면 null("영상 없음" — 붙였던 것을 떼는 경우), 주소를 읽지
   못하면 false(거절). 떼는 것과 다루지 않는 것을 섞으면, 영상 칸이 없는
   화면에서 저장할 때마다 붙여 둔 영상이 조용히 사라진다. */
export function readVideoId(form: {
  get(key: string): unknown
}): string | null | undefined | false {
  const raw = form.get('videoUrl')
  if (raw == null) return undefined
  const s = String(raw).trim()
  if (!s) return null
  return youtubeId(s) ?? false
}
