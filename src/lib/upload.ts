import 'server-only'
import { supabaseAdmin, DESIGNER_IMAGES_BUCKET } from './supabase-admin'
import { MAX_STACK_PARTS, MAX_UPLOAD_BYTES, type WorkPage } from './portfolio-limits'
import { MAX_VIDEO_BYTES, VIDEO_PATH_RE, WORK_VIDEOS_BUCKET, videoFileExt } from './video-upload'

/* 버킷에 이미지를 올리고 공개 URL을 돌려준다.
   파일명은 사용자가 준 이름을 쓰지 않는다 — 한글·공백·중복이 섞이면
   Storage 경로가 깨지고, 같은 이름으로 덮어쓸 위험도 있다. */
export async function putImage(
  file: File,
  prefix: string,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  if (!supabaseAdmin) return { ok: false, error: '서버 설정이 완료되지 않았습니다.' }

  if (!file.type.startsWith('image/')) {
    return { ok: false, error: '이미지 파일만 올릴 수 있습니다.' }
  }

  const ext = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'png'
  const path = `${prefix}/${crypto.randomUUID()}.${ext}`

  const { error } = await supabaseAdmin.storage
    .from(DESIGNER_IMAGES_BUCKET)
    .upload(path, file, { contentType: file.type || undefined, upsert: false })

  if (error) {
    console.error('[upload] 이미지 업로드 실패:', error.message)
    /* 버킷이 없을 때가 가장 흔하다 — 마이그레이션을 돌리지 않은 경우 */
    if (/bucket/i.test(error.message)) {
      return { ok: false, error: '이미지 버킷이 없습니다. 마이그레이션을 실행해 주세요.' }
    }
    return { ok: false, error: '이미지 업로드에 실패했습니다.' }
  }

  const { data } = supabaseAdmin.storage.from(DESIGNER_IMAGES_BUCKET).getPublicUrl(path)
  return { ok: true, url: data.publicUrl }
}


const UPLOAD_NAME_RE = /^[0-9a-f-]{36}\.[a-z0-9]+$/

/* 원본 이미지는 서버 액션으로 받지 않는다 — 본문 1MB 제한에 걸린다.
   경로는 여기서 정하고 서명 주소만 내준다. 브라우저가 올린 뒤 그 경로를
   claimImage 로 돌려받아 공개 URL 로 바꾼다. */
export async function signImageUpload(
  prefix: string,
  name: string,
  size: number,
): Promise<{ ok: true; path: string; token: string } | { ok: false; error: string }> {
  if (!supabaseAdmin) return { ok: false, error: '서버 설정이 완료되지 않았습니다.' }
  /* 버킷 한도(0009_designer_images_50mb.sql 의 file_size_limit)와 같다 */
  if (!size || size > MAX_UPLOAD_BYTES) {
    return { ok: false, error: `파일은 ${MAX_UPLOAD_BYTES / 1024 / 1024}MB를 넘을 수 없습니다.` }
  }

  const ext = name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'png'
  const path = `${prefix}/${crypto.randomUUID()}.${ext}`

  const { data, error } = await supabaseAdmin.storage.from(DESIGNER_IMAGES_BUCKET).createSignedUploadUrl(path)
  if (error || !data) {
    console.error('[upload] 업로드 주소 생성 실패:', error?.message)
    return { ok: false, error: '업로드를 준비하지 못했습니다.' }
  }
  return { ok: true, path: data.path, token: data.token }
}

/* 화면이 돌려준 경로를 믿지 않는다 — signImageUpload 가 만든 모양이고
   그 폴더 바로 아래일 때만 공개 URL 을 준다 */
export function claimImage(prefix: string, path: string): string | null {
  if (!supabaseAdmin) return null
  if (!path.startsWith(`${prefix}/`) || !UPLOAD_NAME_RE.test(path.slice(prefix.length + 1))) return null
  return supabaseAdmin.storage.from(DESIGNER_IMAGES_BUCKET).getPublicUrl(path).data.publicUrl
}

/* PDF 작업의 둘째 장부터 — 업로드 주소를 한 번에 내준다. 서른 장을 한 장씩
   물으면 액션이 서른 번 오간다. 작업 수 상한은 호출부가 먼저 센다. */
export async function signPageUploads(
  prefix: string,
  files: { name: string; size: number }[],
): Promise<{ ok: true; uploads: { path: string; token: string }[] } | { ok: false; error: string }> {
  if (files.length >= MAX_STACK_PARTS) return { ok: false, error: 'PDF가 너무 길어 올릴 수 없습니다.' }
  const uploads: { path: string; token: string }[] = []
  for (const f of files) {
    const r = await signImageUpload(`${prefix}/pages`, f.name, f.size)
    if (!r.ok) return r
    uploads.push({ path: r.path, token: r.token })
  }
  return { ok: true, uploads }
}

/* 화면이 보낸 장 목록(work-file.ts 의 pagesField) — 경로는 claimImage 로 다시
   확인하고 크기는 숫자만 받는다. 비어 있으면 null(이미지 작업), 하나라도
   이상하면 false. */
export function claimPages(prefix: string, raw: FormDataEntryValue | null): WorkPage[] | null | false {
  if (raw == null || raw === '') return null
  let list: unknown
  try {
    list = JSON.parse(String(raw))
  } catch {
    return false
  }
  if (!Array.isArray(list) || list.length >= MAX_STACK_PARTS) return false

  const pages: WorkPage[] = []
  for (const p of list) {
    const url = claimImage(`${prefix}/pages`, String(p?.path ?? ''))
    const width = Number(p?.width)
    const height = Number(p?.height)
    if (!url || !(width > 0) || !(height > 0)) return false
    pages.push({ url, width: Math.round(width), height: Math.round(height) })
  }
  return pages
}

/* ─────────── 포트폴리오 영상(0028_work_video_upload.sql) ───────────

   이미지와 버킷이 다르다(work-videos) — 100MB 한도가 이미지 버킷(10MB)과
   맞지 않고, 썸네일 변환 같은 이미지 전용 처리가 영상에 걸리면 안 된다.

   파일 선택 순간이 아니라 '저장'을 눌렀을 때만 올라간다 — 화면(work-uploader.tsx
   등)이 서명 주소를 받아 두고도 실제 업로드는 저장 시점에 한다. 올리다
   취소하면 버킷에 안 쓰는 영상이 남는 일을 없앤다. */

/* 서명 업로드 주소 — 서버 액션은 본문 1MB 제한에 걸려 영상을 직접 받지 못한다 */
export async function signVideoUpload(
  name: string,
  size: number,
): Promise<{ ok: true; path: string; token: string } | { ok: false; error: string }> {
  if (!supabaseAdmin) return { ok: false, error: '서버 설정이 완료되지 않았습니다.' }
  if (!size || size > MAX_VIDEO_BYTES) {
    return { ok: false, error: `영상은 ${MAX_VIDEO_BYTES / 1024 / 1024}MB를 넘을 수 없습니다.` }
  }

  const ext = videoFileExt(name) || 'mp4'
  const path = `works/${crypto.randomUUID()}.${ext}`

  const { data, error } = await supabaseAdmin.storage.from(WORK_VIDEOS_BUCKET).createSignedUploadUrl(path)
  if (error || !data) {
    console.error('[upload] 영상 업로드 주소 생성 실패:', error?.message)
    if (error && /bucket|related resource does not exist/i.test(error.message)) {
      return { ok: false, error: '영상 저장소가 없습니다. 0028_work_video_upload.sql 을 실행해 주세요.' }
    }
    return { ok: false, error: '업로드를 준비하지 못했습니다.' }
  }
  return { ok: true, path: data.path, token: data.token }
}

/* 화면이 돌려준 경로를 믿지 않는다 — signVideoUpload 가 만든 모양일 때만 받는다.
   공개 URL 이 아니라 경로 그 자체를 저장한다(claimImage 와 달리) — 버킷 주소가
   바뀌어도 데이터는 그대로이고, 보여줄 때 videoFileUrl 이 주소를 조립한다
   (0025_work_link.sql·0019_work_video.sql 과 같은 방침). */
export function claimVideoPath(path: string): string | null {
  if (!VIDEO_PATH_RE.test(path)) return null
  return path
}

/* 지워진 영상 파일을 버킷에서도 치운다 — 저장을 되돌리지 않는다(실패해도
   남는 것은 안 쓰는 파일뿐이다. popup/actions.ts 의 removeObjects 와 같은 방침) */
export async function removeVideoFile(path: string) {
  if (!supabaseAdmin) return
  const { error } = await supabaseAdmin.storage.from(WORK_VIDEOS_BUCKET).remove([path])
  if (error) console.error('[upload] 영상 파일 정리 실패:', error.message)
}
