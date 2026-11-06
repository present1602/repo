import 'server-only'
import { supabaseAdmin, DESIGNER_IMAGES_BUCKET } from './supabase-admin'
import { MAX_PDF_PAGES, MAX_UPLOAD_BYTES, type WorkPage } from './portfolio-limits'

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
  if (files.length >= MAX_PDF_PAGES) return { ok: false, error: `PDF는 ${MAX_PDF_PAGES}쪽까지 올릴 수 있습니다.` }
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
  if (!Array.isArray(list) || list.length >= MAX_PDF_PAGES) return false

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
