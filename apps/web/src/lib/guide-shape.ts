/* 설정 가이드 챕터 한 건의 모양과 규칙(0024_setup_guide.sql).

   어드민 폼(클라이언트)·서버 액션·디자이너 화면이 함께 쓴다 — 허용 형식이나
   길이가 양쪽에서 어긋나면 화면은 통과시켰는데 서버가 거부한다.
   server-only 모듈에 두지 않는다 — guide-db.ts 에서 가져오면
   supabase-admin(service_role) 이 브라우저 번들로 끌려온다. */

/* 공개 버킷 — 폼이 서명 주소로 바로 올릴 때도 이름을 알아야 한다 */
export const GUIDE_IMAGES_BUCKET = 'guide-images'

/* 본문 블록 — 위에서부터 차례로 그린다. 이미지는 경로만 남기고
   주소는 그릴 때 만든다(publicUrl). 버킷 주소가 바뀌어도 데이터는 그대로다.
   팝업 본문과 같은 모양이다(popup-shape.ts 의 PopupBlock) — 가이드는 글에
   서식 표시를 쓰지 않고 줄바꿈만 그대로 살린다. */
export type GuideBlock = { type: 'text'; text: string } | { type: 'image'; path: string }

export type GuideChapter = {
  id: string
  /* 차례에 보이는 제목 */
  title: string
  /* 제목 아래 한 줄 설명. 비워 둘 수 있다 */
  summary: string
  body: GuideBlock[]
  sort_order: number
  /* 끄면 디자이너 화면에서 빠진다. 어드민 목록에는 '숨김' 으로 남는다 */
  visible: boolean
}

/* 0024 의 check 제약과 같은 길이 — 함께 고쳐야 한다 */
export const MAX_GUIDE_TITLE = 200
export const MAX_GUIDE_SUMMARY = 500

export const MAX_GUIDE_TEXT_BLOCK = 5000
export const MAX_GUIDE_BLOCKS = 40

/* 버킷의 file_size_limit 와 같은 값 — 실제로 막는 것은 버킷이다 */
export const MAX_GUIDE_IMAGE_BYTES = 10 * 1024 * 1024

export const GUIDE_IMAGE_EXT = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'avif']
export const GUIDE_IMAGE_ACCEPT = GUIDE_IMAGE_EXT.map((e) => `.${e}`).join(',')

export function guideFileExt(name: string) {
  return name.split('.').pop()?.toLowerCase() ?? ''
}

/* 공개 버킷 주소 */
export function guideImageUrl(path: string) {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${GUIDE_IMAGES_BUCKET}/${path}`
}

/* 본문이 비었는지 — 글이 있거나 이미지가 하나라도 있으면 찬 것이다.
   제목만 있는 챕터도 둘 수 있으므로 저장을 막지는 않는다(어드민 목록에 '내용 없음' 으로 표시) */
export function hasGuideBody(body: GuideBlock[]) {
  return body.some((b) => (b.type === 'image' ? Boolean(b.path) : b.text.trim().length > 0))
}

/* 목록에 쓰는 본문 요약 — '글 2 · 이미지 3' */
export function guideBodySummary(body: GuideBlock[]) {
  const texts = body.filter((b) => b.type === 'text').length
  const images = body.filter((b) => b.type === 'image').length
  return [texts > 0 ? `글 ${texts}` : null, images > 0 ? `이미지 ${images}` : null]
    .filter(Boolean)
    .join(' · ')
}
