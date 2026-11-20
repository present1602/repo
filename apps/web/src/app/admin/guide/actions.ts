'use server'

import { revalidatePath } from 'next/cache'
import { getAdminUser } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import {
  GUIDE_IMAGES_BUCKET,
  GUIDE_IMAGE_EXT,
  MAX_GUIDE_BLOCKS,
  MAX_GUIDE_IMAGE_BYTES,
  MAX_GUIDE_SUMMARY,
  MAX_GUIDE_TEXT_BLOCK,
  MAX_GUIDE_TITLE,
  guideFileExt,
  type GuideBlock,
} from '@/lib/guide-shape'

/* 설정 가이드 챕터 관리(0024_setup_guide.sql).

   기능과 엮이지 않은 안내문이다 — 챕터마다 글·이미지 블록을 쌓아 둔다.
   이미지는 팝업과 같게 서명 주소로 브라우저가 바로 올린다. */

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
  revalidatePath('/admin/guide')
  /* 디자이너 화면은 뒤에 붙는다 — 그때도 따라오게 레이아웃째 되살린다 */
  revalidatePath('/studio', 'layout')
}

/* 표가 없으면 어떤 파일을 돌려야 하는지 알려 준다 */
function guideFail(message: string, what: string) {
  console.error(`[guide] ${what} 실패:`, message)
  return fail(
    /setup_guide_chapters/i.test(message)
      ? '설정 가이드 표가 아직 없습니다. 0024_setup_guide.sql 을 먼저 실행해 주세요.'
      : `${what}에 실패했습니다.`,
  )
}

/* ─────────── 업로드 ───────────

   이미지는 서버 액션을 거치지 않는다 — 요청 본문 크기 제한에 걸린다.
   팝업(preparePopupUpload)과 같게 서명 업로드 주소를 주고 브라우저가 바로 올린다.
   저장 경로는 원래 파일명을 쓰지 않는다(한글·공백이 경로를 깨뜨린다). */

export async function prepareGuideUpload(
  name: string,
  size: number,
): Promise<{ ok: true; path: string; token: string } | { ok: false; error: string }> {
  const db = await guard()

  const ext = guideFileExt(name)
  if (!GUIDE_IMAGE_EXT.includes(ext)) return fail(`이미지 파일만 넣을 수 있습니다 (${name})`)
  if (!size || size > MAX_GUIDE_IMAGE_BYTES) return fail('이미지는 10MB를 넘을 수 없습니다.')

  const path = `chapters/${crypto.randomUUID()}.${ext}`
  const { data, error } = await db.storage.from(GUIDE_IMAGES_BUCKET).createSignedUploadUrl(path)

  if (error || !data) {
    console.error('[guide] 업로드 주소 생성 실패:', error?.message)
    /* 버킷이 없으면 "The related resource does not exist" 로 답한다 — 0024 전 */
    if (error && /bucket|related resource does not exist/i.test(error.message)) {
      return fail('가이드 이미지 저장소가 없습니다. 0024_setup_guide.sql 을 실행해 주세요.')
    }
    return fail('업로드를 준비하지 못했습니다.')
  }
  return { ok: true, path: data.path, token: data.token }
}

/* ─────────── 저장 ─────────── */

export type GuideInput = {
  title: string
  summary: string
  body: GuideBlock[]
}

const PATH_RE = /^chapters\/[0-9a-f-]{36}\.[a-z0-9]+$/

/* 화면이 보낸 값을 하나도 믿지 않는다 — 경로는 이 액션이 만든 모양만,
   글은 길이를 재 받는다(readInput, popups/actions.ts 와 같은 방침) */
function readInput(
  input: GuideInput,
): { error: string } | { error?: undefined; title: string; summary: string; body: GuideBlock[] } {
  const title = String(input.title ?? '').trim()
  if (!title) return { error: '챕터 제목을 입력해 주세요.' }
  if (title.length > MAX_GUIDE_TITLE) {
    return { error: `제목은 ${MAX_GUIDE_TITLE}자 이내로 입력해 주세요.` }
  }

  const summary = String(input.summary ?? '').trim()
  if (summary.length > MAX_GUIDE_SUMMARY) {
    return { error: `한 줄 설명은 ${MAX_GUIDE_SUMMARY}자 이내로 입력해 주세요.` }
  }

  const raw = Array.isArray(input.body) ? input.body : []
  if (raw.length > MAX_GUIDE_BLOCKS) {
    return { error: `본문 블록은 ${MAX_GUIDE_BLOCKS}개까지 넣을 수 있습니다.` }
  }

  const body: GuideBlock[] = []
  for (const b of raw) {
    if (b?.type === 'image') {
      const path = String(b.path ?? '')
      if (!PATH_RE.test(path)) return { error: '본문 이미지가 올바르지 않습니다.' }
      body.push({ type: 'image', path })
    } else if (b?.type === 'text') {
      const text = String(b.text ?? '')
      if (text.length > MAX_GUIDE_TEXT_BLOCK) {
        return { error: `본문 글은 한 칸에 ${MAX_GUIDE_TEXT_BLOCK}자까지입니다.` }
      }
      /* 빈 글 칸은 버린다 — 화면에 빈 여백만 남는다. 줄바꿈은 그대로 살리고 뒤 공백만 덜어낸다 */
      if (text.trim()) body.push({ type: 'text', text: text.replace(/\s+$/, '') })
    }
  }

  return { title, summary, body }
}

/* 본문 이미지의 경로 모음 — 고치거나 지울 때 버킷에서 함께 치운다 */
function pathsOf(body: GuideBlock[]) {
  return (body ?? []).flatMap((b) => (b.type === 'image' ? [b.path] : []))
}

/* 버킷 정리는 실패해도 저장을 되돌리지 않는다 — 남는 것은 안 쓰는 파일뿐이다 */
async function removeObjects(db: NonNullable<typeof supabaseAdmin>, paths: string[]) {
  if (paths.length === 0) return
  const { error } = await db.storage.from(GUIDE_IMAGES_BUCKET).remove(paths)
  if (error) console.error('[guide] 이미지 정리 실패:', error.message)
}

export async function addGuideChapter(input: GuideInput): Promise<Result> {
  const db = await guard()

  const v = readInput(input)
  if (v.error != null) return fail(v.error)

  /* 맨 뒤에 세운다 — 기존 차례를 흔들지 않는다(addFaq 와 같은 방침) */
  const { data: last } = await db
    .from('setup_guide_chapters')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { error } = await db.from('setup_guide_chapters').insert({
    title: v.title,
    summary: v.summary,
    body: v.body,
    sort_order: ((last?.sort_order as number) ?? -1) + 1,
  })
  if (error) return guideFail(error.message, '추가')

  refresh()
  return { ok: true }
}

export async function updateGuideChapter(id: string, input: GuideInput): Promise<Result> {
  const db = await guard()
  if (!id) return fail('챕터를 찾을 수 없습니다.')

  const v = readInput(input)
  if (v.error != null) return fail(v.error)

  const { data: before, error: readErr } = await db
    .from('setup_guide_chapters')
    .select('body')
    .eq('id', id)
    .maybeSingle()
  if (readErr) return guideFail(readErr.message, '수정')
  if (!before) return fail('챕터를 찾을 수 없습니다.')

  const { error } = await db
    .from('setup_guide_chapters')
    .update({
      title: v.title,
      summary: v.summary,
      body: v.body,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
  if (error) return guideFail(error.message, '수정')

  /* 빠진 이미지는 버킷에서도 치운다 */
  const keep = new Set(pathsOf(v.body))
  await removeObjects(
    db,
    pathsOf(before.body as GuideBlock[]).filter((p) => !keep.has(p)),
  )

  refresh()
  return { ok: true }
}

/* 끄면 디자이너 화면에서만 빠진다 — 어드민 목록에는 '숨김' 으로 남는다 */
export async function setGuideChapterVisible(id: string, visible: boolean): Promise<Result> {
  const db = await guard()

  const { error } = await db.from('setup_guide_chapters').update({ visible }).eq('id', id)
  if (error) return guideFail(error.message, '노출 변경')

  refresh()
  return { ok: true }
}

/* 순서 바꾸기 — 받은 차례대로 0번부터 다시 매긴다(reorderFaqs 와 같은 방침) */
export async function reorderGuideChapters(ids: string[]): Promise<Result> {
  const db = await guard()

  if (ids.length === 0) return { ok: true }

  const { data: all, error: readErr } = await db.from('setup_guide_chapters').select('id')
  if (readErr) return guideFail(readErr.message, '순서 변경')

  const known = new Set((all ?? []).map((c) => c.id as string))
  const clean = ids.filter((id) => known.has(id))

  /* 화면이 가진 목록과 DB 가 어긋나면 섣불리 쓰지 않는다 —
     빠진 줄이 0번으로 몰려 차례가 뒤엉킨다 */
  if (clean.length !== known.size) {
    return fail('목록이 바뀌었습니다. 새로고침 후 다시 시도해 주세요.')
  }

  const results = await Promise.all(
    clean.map((id, i) => db.from('setup_guide_chapters').update({ sort_order: i }).eq('id', id)),
  )

  const failedOne = results.find((r) => r.error)
  if (failedOne?.error) return guideFail(failedOne.error.message, '순서 변경')

  refresh()
  return { ok: true }
}

export async function deleteGuideChapter(id: string): Promise<Result> {
  const db = await guard()
  if (!id) return fail('챕터를 찾을 수 없습니다.')

  const { data: row } = await db
    .from('setup_guide_chapters')
    .select('body')
    .eq('id', id)
    .maybeSingle()

  const { error } = await db.from('setup_guide_chapters').delete().eq('id', id)
  if (error) return guideFail(error.message, '삭제')

  if (row) await removeObjects(db, pathsOf(row.body as GuideBlock[]))

  refresh()
  return { ok: true }
}
