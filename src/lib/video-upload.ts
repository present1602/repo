/* 포트폴리오 작업에 올리는 영상 파일(0028_work_video_upload.sql).

   유튜브 주소(youtube.ts)의 대안이다 — 유튜브에 올리지 않은 영상도 쓸 수
   있게 파일로 직접 올린다. 한 작업에는 영상 소스가 하나뿐이라, 이 칸을
   채우면 유튜브 칸은 비우고 저장한다(반대도 같다). 화면(입력 칸)과 서버
   액션이 같이 쓴다. */

export const WORK_VIDEOS_BUCKET = 'work-videos'

/* 버킷의 file_size_limit(0028)과 같은 값 — 실제로 막는 것은 버킷이다 */
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024
/* 화면 문구에 쓰는 한도 — "50MB 이하" */
export const MAX_VIDEO_MB = MAX_VIDEO_BYTES / 1024 / 1024

export const VIDEO_MIME_TYPES = ['video/mp4', 'video/webm', 'video/quicktime', 'video/ogg']
export const VIDEO_EXT = ['mp4', 'webm', 'mov', 'ogg', 'ogv']
export const VIDEO_ACCEPT = VIDEO_MIME_TYPES.join(',')

export function videoFileExt(name: string) {
  return name.split('.').pop()?.toLowerCase() ?? ''
}

export function isVideoFile(file: File): boolean {
  if (file.type) return VIDEO_MIME_TYPES.includes(file.type)
  /* 일부 브라우저·OS 는 .mov 의 type 을 비워서 준다 — 확장자로 한 번 더 본다 */
  return VIDEO_EXT.includes(videoFileExt(file.name))
}

/* 선택한 파일이 바로 거절될지 미리 본다 — 올리기 전에 알려 준다
   (AGENTS.md: 미리 막을 수 있으면 누르기 전에 막는다) */
export function checkVideoFile(file: File): string | null {
  if (!isVideoFile(file)) return '영상 파일만 올릴 수 있습니다 (MP4·WebM·MOV·OGG).'
  if (file.size > MAX_VIDEO_BYTES) {
    const mb = (file.size / 1024 / 1024).toFixed(1)
    return `영상은 ${MAX_VIDEO_MB}MB 이하만 올릴 수 있습니다. (고른 파일 ${mb}MB)`
  }
  return null
}

/* 공개 버킷 주소 */
export function videoFileUrl(path: string) {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${WORK_VIDEOS_BUCKET}/${path}`
}

/* 0028 의 check 제약과 같은 모양 — works/<uuid>.<ext> */
export const VIDEO_PATH_RE = /^works\/[0-9a-f-]{36}\.[a-z0-9]+$/
