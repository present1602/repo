import 'server-only'
import { supabaseAdmin, DESIGNER_IMAGES_BUCKET } from './supabase-admin'

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

/* 버킷 한도(0007_designer_images_20mb.sql 의 file_size_limit)와 같다 */
const MAX_IMAGE_BYTES = 20 * 1024 * 1024

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
  if (!size || size > MAX_IMAGE_BYTES) return { ok: false, error: '이미지는 20MB를 넘을 수 없습니다.' }

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
