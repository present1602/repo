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
