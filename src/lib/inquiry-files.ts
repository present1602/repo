import 'server-only'
import { supabaseAdmin, INQUIRY_FILES_BUCKET } from './supabase-admin'
import { INQUIRY_FILE_EXTS, INQUIRY_FILE_MAX_MB } from './inquiry-shape'

/* 문의 첨부 — 브라우저가 서명 주소로 Storage 에 바로 올리고, 접수 API 에는 경로만 보낸다.

   파일을 접수 API 본문에 실으면 Vercel 함수의 요청 크기 한도(약 4.5MB)에 걸려
   우리 코드에 닿기 전에 413 으로 끊긴다. 경로는 여기서 정하고(signInquiryUpload),
   접수 때 그 모양인지·실제로 올라왔는지·크기가 맞는지 다시 본다(claimInquiryFile). */

export const INQUIRY_FILE_MAX_BYTES = INQUIRY_FILE_MAX_MB * 1024 * 1024

export function fileExt(name: string) {
  return name.split('.').pop()?.toLowerCase() ?? ''
}

/* Storage 경로용 이름 — 한글·공백은 _ 로. 원래 이름은 문의에 따로 남는다 */
export function safeName(name: string) {
  const e = fileExt(name)
  const base = name.slice(0, name.length - e.length - 1) || 'file'
  const cleaned = base.replace(/[^\w.-]+/g, '_').slice(0, 60)
  return e ? `${cleaned}.${e}` : cleaned
}

/* 형식·크기가 맞는지 — 맞으면 null, 아니면 고객에게 보일 문구 */
export function fileProblem(name: string, size: number): string | null {
  if (size > INQUIRY_FILE_MAX_BYTES) return `파일당 ${INQUIRY_FILE_MAX_MB}MB를 넘을 수 없습니다: ${name}`
  if (!INQUIRY_FILE_EXTS.includes(fileExt(name))) return `허용되지 않는 형식입니다: ${name}`
  return null
}

/* 날짜 폴더/uuid-이름 — 접수 API 가 직접 올리던 때와 같은 모양(어드민 내려받기가 그대로 쓴다) */
const PATH_RE = /^\d{4}-\d{2}-\d{2}\/[0-9a-f-]{36}-[\w.-]+$/

export async function signInquiryUpload(
  name: string,
  size: number,
): Promise<{ ok: true; bucket: string; path: string; token: string } | { ok: false; error: string }> {
  if (!supabaseAdmin) return { ok: false, error: '서버 설정이 완료되지 않았습니다.' }
  const problem = fileProblem(name, size)
  if (problem || !size) return { ok: false, error: problem ?? '빈 파일은 올릴 수 없습니다.' }

  const path = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}-${safeName(name)}`
  const { data, error } = await supabaseAdmin.storage.from(INQUIRY_FILES_BUCKET).createSignedUploadUrl(path)
  if (error || !data) {
    console.error('[inquiry] 첨부 업로드 주소 생성 실패:', error?.message)
    /* 버킷이 없을 때가 가장 흔하다 — 마이그레이션을 돌리지 않은 경우 */
    return {
      ok: false,
      error: /bucket/i.test(error?.message ?? '')
        ? '첨부 저장소가 준비되지 않았습니다. 관리자에게 알려 주세요.'
        : '첨부를 준비하지 못했습니다. 잠시 후 다시 시도해 주세요.',
    }
  }
  return { ok: true, bucket: INQUIRY_FILES_BUCKET, path: data.path, token: data.token }
}

/* 화면이 돌려준 경로를 믿지 않는다 — signInquiryUpload 가 만든 모양이고, 실제로 올라와 있고,
   크기가 한도 안일 때만 받는다. 크기는 Storage 에 남은 값을 쓴다 */
export async function claimInquiryFile(path: string, name: string): Promise<{ size: number } | null> {
  if (!supabaseAdmin || !PATH_RE.test(path) || fileExt(path) !== fileExt(name)) return null
  const [folder, file] = path.split('/')
  const { data, error } = await supabaseAdmin.storage.from(INQUIRY_FILES_BUCKET).list(folder, { search: file })
  if (error) {
    console.error('[inquiry] 첨부 확인 실패:', path, error.message)
    return null
  }
  const size = Number(data?.find((o) => o.name === file)?.metadata?.size ?? 0)
  if (!size || size > INQUIRY_FILE_MAX_BYTES) return null
  return { size }
}
