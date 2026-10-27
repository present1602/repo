'use server'

import { revalidatePath } from 'next/cache'
import { getAdminUser } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import {
  POPUP_FILES_BUCKET,
  POPUP_IMAGE_EXT,
  POPUP_FILE_EXT,
  MAX_POPUP_FILE_BYTES,
  MAX_TITLE,
  MAX_TEXT_BLOCK,
  MAX_BLOCKS,
  MAX_FILES,
  fileExt,
  hasBody,
  isPopupStatus,
  localInputToIso,
  type PopupBlock,
  type PopupFile,
  type PopupStatus,
  type UploadKind,
} from '@/lib/popup-shape'

/* 서버 액션은 누구나 호출할 수 있는 엔드포인트다.
   페이지에서 막았더라도 여기서 권한을 다시 확인해야 한다. */
async function guard() {
  const user = await getAdminUser()
  if (!user) throw new Error('권한이 없습니다.')
  if (!supabaseAdmin) throw new Error('서버 설정이 완료되지 않았습니다.')
  return supabaseAdmin
}

export type Result = { ok: true } | { ok: false; error: string }

function fail(error: string) {
  return { ok: false as const, error }
}

function refresh() {
  revalidatePath('/admin/popups', 'layout')
  /* 팝업은 홈에 뜬다 */
  revalidatePath('/')
}

/* ─────────── 업로드 ───────────

   파일은 서버 액션을 거치지 않는다 — 요청 본문 크기 제한에 걸린다.
   지원서(api/apply)와 같게 서명 업로드 주소를 주고 브라우저가 바로 올린다.
   저장 경로는 원래 파일명을 쓰지 않는다(한글·공백이 경로를 깨뜨린다). */

export async function preparePopupUpload(
  kind: UploadKind,
  name: string,
  size: number,
): Promise<{ ok: true; path: string; token: string } | { ok: false; error: string }> {
  const db = await guard()

  const ext = fileExt(name)
  const allowed = kind === 'image' ? POPUP_IMAGE_EXT : POPUP_FILE_EXT
  if (!allowed.includes(ext)) {
    return fail(kind === 'image' ? '이미지 파일만 넣을 수 있습니다.' : `허용되지 않는 형식입니다 (${name})`)
  }
  if (!size || size > MAX_POPUP_FILE_BYTES) return fail('파일은 20MB를 넘을 수 없습니다.')

  const path = `${kind === 'image' ? 'images' : 'files'}/${crypto.randomUUID()}.${ext}`
  const { data, error } = await db.storage.from(POPUP_FILES_BUCKET).createSignedUploadUrl(path)

  if (error || !data) {
    console.error('[popup] 업로드 주소 생성 실패:', error?.message)
    /* 버킷이 없으면 "The related resource does not exist" 로 답한다 — 023 전 */
    if (error && /bucket|related resource does not exist/i.test(error.message)) {
      return fail('팝업 저장소가 없습니다. 마이그레이션(023)을 실행해 주세요.')
    }
    return fail('업로드를 준비하지 못했습니다.')
  }
  return { ok: true, path: data.path, token: data.token }
}

/* ─────────── 저장 ─────────── */

export type PopupInput = {
  title: string
  body: PopupBlock[]
  files: PopupFile[]
  /* datetime-local 값(한국 시간) — 비우면 그쪽 끝이 열린다 */
  startsAt: string
  endsAt: string
  status: PopupStatus
}

const PATH_RE = /^(images|files)\/[0-9a-f-]{36}\.[a-z0-9]+$/

/* 화면이 보낸 값을 하나도 믿지 않는다 — 경로는 이 액션이 만든 모양만,
   글은 길이를 잘라 받는다 */
function readInput(input: PopupInput) {
  const title = String(input.title ?? '').trim()
  if (title.length > MAX_TITLE) return { error: `제목은 ${MAX_TITLE}자 이내로 입력해 주세요.` }

  const raw = Array.isArray(input.body) ? input.body : []
  if (raw.length > MAX_BLOCKS) return { error: `본문 블록은 ${MAX_BLOCKS}개까지 넣을 수 있습니다.` }

  const body: PopupBlock[] = []
  for (const b of raw) {
    if (b?.type === 'image') {
      const path = String(b.path ?? '')
      if (!PATH_RE.test(path) || !path.startsWith('images/')) return { error: '본문 이미지가 올바르지 않습니다.' }
      body.push({ type: 'image', path })
    } else if (b?.type === 'text') {
      const text = String(b.text ?? '')
      if (text.length > MAX_TEXT_BLOCK) return { error: `본문 글은 한 칸에 ${MAX_TEXT_BLOCK}자까지입니다.` }
      /* 빈 글 칸은 버린다 — 공개 화면에 빈 여백만 남는다 */
      if (text.trim()) body.push({ type: 'text', text: text.replace(/\s+$/, '') })
    }
  }
  if (!hasBody(body)) return { error: '본문에 글이나 이미지를 넣어 주세요.' }

  const rawFiles = Array.isArray(input.files) ? input.files : []
  if (rawFiles.length > MAX_FILES) return { error: `첨부 파일은 ${MAX_FILES}개까지입니다.` }
  const files: PopupFile[] = []
  for (const f of rawFiles) {
    const path = String(f?.path ?? '')
    const name = String(f?.name ?? '').trim().slice(0, 200)
    if (!PATH_RE.test(path) || !path.startsWith('files/') || !name) {
      return { error: '첨부 파일이 올바르지 않습니다.' }
    }
    files.push({ name, path, size: Math.max(0, Number(f.size) || 0) })
  }

  const startsAt = localInputToIso(String(input.startsAt ?? ''))
  const endsAt = localInputToIso(String(input.endsAt ?? ''))
  if (input.startsAt && !startsAt) return { error: '시작 일시를 확인해 주세요.' }
  if (input.endsAt && !endsAt) return { error: '종료 일시를 확인해 주세요.' }
  if (startsAt && endsAt && Date.parse(startsAt) >= Date.parse(endsAt)) {
    return { error: '종료 일시는 시작 일시보다 뒤여야 합니다.' }
  }

  const status = String(input.status ?? '')
  if (!isPopupStatus(status)) return { error: '알 수 없는 상태입니다.' }

  return { title: title || null, body, files, startsAt, endsAt, status }
}

/* 노출로 두려는데 이미 기간이 끝났으면 막는다 — 저장하자마자 만료로
   바뀌어 "노출했는데 안 뜬다"가 된다 */
function overdue(status: PopupStatus, endsAt: string | null) {
  return status === 'visible' && endsAt !== null && Date.parse(endsAt) <= Date.now()
}

const OVERDUE_MSG = '게시 기간이 이미 지났습니다. 종료 일시를 늘린 뒤 노출해 주세요.'

export async function createPopup(input: PopupInput): Promise<Result & { id?: string }> {
  const db = await guard()

  const v = readInput(input)
  if ('error' in v) return fail(v.error!)
  /* 만료는 시스템이 붙이는 상태다 — 새로 만들 때 고를 이유가 없다 */
  if (v.status === 'expired') return fail('노출 또는 숨김을 골라 주세요.')
  if (overdue(v.status, v.endsAt)) return fail(OVERDUE_MSG)

  const { data, error } = await db
    .from('popups')
    .insert({
      title: v.title,
      body: v.body,
      files: v.files,
      starts_at: v.startsAt,
      ends_at: v.endsAt,
      status: v.status,
      status_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (error) {
    console.error('[popup] 등록 실패:', error.message)
    if (/popups/i.test(error.message)) return fail('팝업 테이블이 없습니다. 마이그레이션(023)을 실행해 주세요.')
    return fail('등록에 실패했습니다.')
  }

  refresh()
  return { ok: true, id: data.id as string }
}

/* 본문 이미지·첨부의 경로 모음 — 고치거나 지울 때 버킷에서 함께 치운다 */
function pathsOf(row: { body: PopupBlock[]; files: PopupFile[] }) {
  return [
    ...(row.body ?? []).flatMap((b) => (b.type === 'image' ? [b.path] : [])),
    ...(row.files ?? []).map((f) => f.path),
  ]
}

/* 버킷 정리는 실패해도 저장을 되돌리지 않는다 — 남는 것은 안 쓰는 파일뿐이다 */
async function removeObjects(db: NonNullable<typeof supabaseAdmin>, paths: string[]) {
  if (paths.length === 0) return
  const { error } = await db.storage.from(POPUP_FILES_BUCKET).remove(paths)
  if (error) console.error('[popup] 파일 정리 실패:', error.message)
}

export async function updatePopup(id: string, input: PopupInput): Promise<Result> {
  const db = await guard()
  if (!id) return fail('팝업을 찾을 수 없습니다.')

  const v = readInput(input)
  if ('error' in v) return fail(v.error!)

  const { data: before, error: readErr } = await db
    .from('popups')
    .select('status, body, files')
    .eq('id', id)
    .maybeSingle()
  if (readErr || !before) return fail('팝업을 찾을 수 없습니다.')

  /* 만료는 이미 만료된 팝업을 그대로 둘 때만 받는다 */
  if (v.status === 'expired' && before.status !== 'expired') return fail('노출 또는 숨김을 골라 주세요.')
  if (overdue(v.status, v.endsAt)) return fail(OVERDUE_MSG)

  const now = new Date().toISOString()
  const { error } = await db
    .from('popups')
    .update({
      title: v.title,
      body: v.body,
      files: v.files,
      starts_at: v.startsAt,
      ends_at: v.endsAt,
      status: v.status,
      updated_at: now,
      ...(v.status !== before.status ? { status_at: now } : {}),
    })
    .eq('id', id)

  if (error) {
    console.error('[popup] 수정 실패:', error.message)
    return fail('저장에 실패했습니다.')
  }

  /* 빠진 이미지·첨부는 버킷에서도 치운다 */
  const keep = new Set(pathsOf(v))
  await removeObjects(db, pathsOf(before as { body: PopupBlock[]; files: PopupFile[] }).filter((p) => !keep.has(p)))

  refresh()
  return { ok: true }
}

/* 목록에서 바로 노출 / 숨김 전환 */
export async function setPopupStatus(id: string, status: string): Promise<Result> {
  const db = await guard()

  if (!id) return fail('팝업을 찾을 수 없습니다.')
  if (status !== 'visible' && status !== 'hidden') return fail('노출 또는 숨김만 고를 수 있습니다.')

  const { data: row, error: readErr } = await db
    .from('popups')
    .select('ends_at')
    .eq('id', id)
    .maybeSingle()
  if (readErr || !row) return fail('팝업을 찾을 수 없습니다.')
  if (overdue(status, row.ends_at as string | null)) return fail(OVERDUE_MSG)

  const now = new Date().toISOString()
  const { error } = await db
    .from('popups')
    .update({ status, status_at: now, updated_at: now })
    .eq('id', id)

  if (error) {
    console.error('[popup] 상태 변경 실패:', error.message)
    return fail('변경에 실패했습니다.')
  }

  refresh()
  return { ok: true }
}

export async function deletePopup(id: string): Promise<Result> {
  const db = await guard()
  if (!id) return fail('팝업을 찾을 수 없습니다.')

  const { data: row } = await db.from('popups').select('body, files').eq('id', id).maybeSingle()

  const { error } = await db.from('popups').delete().eq('id', id)
  if (error) {
    console.error('[popup] 삭제 실패:', error.message)
    return fail('삭제에 실패했습니다.')
  }

  if (row) await removeObjects(db, pathsOf(row as { body: PopupBlock[]; files: PopupFile[] }))

  refresh()
  return { ok: true }
}
