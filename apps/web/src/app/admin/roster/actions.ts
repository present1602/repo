'use server'

import { revalidatePath } from 'next/cache'
import { getAdminUser } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { putImage } from '@/lib/upload'
import { AVATAR_MAX_BYTES } from '@/lib/shrink-image'
import { isMissingTable, randomToken, rosterUrl } from '@/lib/roster-db'
import {
  EXPIRE_DAYS,
  MAX_FILES_PER_DESIGNER,
  MAX_MEMO,
  MISSING_FILES_MSG,
  MISSING_PICK_MSG,
  MISSING_TABLE_MSG,
  ROSTER_FILES_BUCKET,
  checkFile,
  fileExt,
  checkDesignerInput,
  type DesignerInput,
} from '@/lib/roster-shape'

type Fail = { ok: false; error: string }
const fail = (error: string): Fail => ({ ok: false, error })

/* 서버 액션은 누구나 부를 수 있는 엔드포인트다 — 여기서 권한을 다시 확인한다 */
async function guard() {
  const user = await getAdminUser()
  if (!user) return { error: fail('권한이 없습니다. 다시 로그인해 주세요.') }
  if (!supabaseAdmin) return { error: fail('서버 설정(SUPABASE_SERVICE_ROLE_KEY)이 완료되지 않았습니다.') }
  return { db: supabaseAdmin, email: user.email ?? null }
}

function refresh() {
  revalidatePath('/admin/roster')
}

const dbFail = (err: { code?: string; message?: string } | null, what: string) => {
  if (err) console.error(`[admin/roster] ${what} 실패:`, err.message)
  if (isMissingTable(err)) return fail(MISSING_TABLE_MSG)
  if (err?.code === '23503') return fail('연결할 디자이너를 찾을 수 없습니다. 새로고침해 다시 골라 주세요.')
  return fail(`${what}에 실패했습니다.`)
}

/* ─────────── 링크 ─────────── */

/* designerIds — 다이얼로그에서 체크한 사람. 이 링크로는 이 사람들만 보인다 */
export async function createRosterLink(
  days: number,
  memo: string,
  designerIds: string[],
): Promise<{ ok: true; url: string; expiresAt: string } | Fail> {
  const g = await guard()
  if ('error' in g) return g.error!

  if (!(EXPIRE_DAYS as readonly number[]).includes(days)) return fail('유효기간은 1~7일 중에서 골라 주세요.')
  const m = memo.trim()
  if (m.length > MAX_MEMO) return fail(`메모는 ${MAX_MEMO}자 이내로 적어 주세요.`)

  if (!Array.isArray(designerIds) || designerIds.some((i) => typeof i !== 'string' || !/^[0-9a-f-]{36}$/i.test(i))) {
    return fail('디자이너 선택을 읽지 못했습니다. 새로고침해 다시 골라 주세요.')
  }
  const picked = Array.from(new Set(designerIds))
  if (picked.length === 0) return fail('링크로 보여 줄 디자이너를 한 명 이상 골라 주세요.')

  /* 그사이 삭제된 사람이 섞였는지, 전원을 골랐는지 확인한다 */
  const { data: all, error: allErr } = await g.db.from('roster_designers').select('id').limit(300)
  if (allErr) return dbFail(allErr, '링크 만들기')
  const allIds = new Set((all ?? []).map((d) => d.id as string))
  if (picked.some((id) => !allIds.has(id))) {
    return fail('그사이 삭제된 디자이너가 있습니다. 새로고침해 다시 골라 주세요.')
  }
  const everyone = picked.length === allIds.size

  const row = {
    token: randomToken(),
    memo: m || null,
    expires_at: new Date(Date.now() + days * 86_400_000).toISOString(),
    created_by: g.email,
    designer_ids: picked,
  }
  let { data, error } = await g.db.from('roster_links').insert(row).select('token, expires_at').single()

  /* 0034 전이라 designer_ids 칸이 없다 — 전원을 골랐으면 칸 없이 만들어도 같은 링크다(null = 전원).
     일부만 골랐으면 그대로 만들면 안 고른 사람까지 보이므로 막는다. */
  if (error && /designer_ids/.test(error.message)) {
    if (!everyone) return fail(MISSING_PICK_MSG)
    const { designer_ids: _skip, ...legacy } = row
    void _skip
    ;({ data, error } = await g.db.from('roster_links').insert(legacy).select('token, expires_at').single())
  }

  if (error || !data) return dbFail(error, '링크 만들기')
  refresh()
  return { ok: true, url: rosterUrl(data.token as string), expiresAt: data.expires_at as string }
}

/* 비활성 — 링크를 열면 '사용할 수 없는 링크' 안내가 뜬다. 다시 켜면 기한 안에서 다시 열린다.
   기한이 지난 링크는 다시 켜도 열리지 않으므로 막는다(기한 연장은 새 링크로). */
export async function setRosterLinkActive(id: string, active: boolean): Promise<{ ok: true } | Fail> {
  const g = await guard()
  if ('error' in g) return g.error!

  const what = active ? '링크 활성화' : '링크 비활성화'
  const base = g.db
    .from('roster_links')
    .update({ revoked_at: active ? null : new Date().toISOString() })
    .eq('id', id)
  const q = active
    ? base.not('revoked_at', 'is', null).gt('expires_at', new Date().toISOString())
    : base.is('revoked_at', null)
  const { data, error } = await q.select('id').maybeSingle()

  if (error) return dbFail(error, what)
  refresh()
  if (!data) {
    return fail(
      active
        ? '다시 켤 수 없는 링크입니다. 기한이 지났거나 이미 사용 중이니 새로고침해 확인해 주세요.'
        : '이미 비활성인 링크입니다. 새로고침해 확인해 주세요.',
    )
  }
  return { ok: true }
}

/* 삭제 — 목록에서 사라지고 열람 기록도 함께 지워진다(0033 의 on delete cascade).
   이 주소로 들어오면 '없는 링크' 안내가 뜬다. */
export async function deleteRosterLink(id: string): Promise<{ ok: true } | Fail> {
  const g = await guard()
  if ('error' in g) return g.error!

  const { data, error } = await g.db.from('roster_links').delete().eq('id', id).select('id').maybeSingle()
  if (error) return dbFail(error, '링크 삭제')
  refresh()
  if (!data) return fail('이미 삭제된 링크입니다. 새로고침해 확인해 주세요.')
  return { ok: true }
}

/* ─────────── 디자이너 ─────────── */

function readForm(form: FormData): { input: DesignerInput; image: File | null; dropImage: boolean } {
  const s = (k: string) => {
    const v = form.get(k)
    return typeof v === 'string' ? v : ''
  }
  const file = form.get('image')
  return {
    input: { name: s('name'), career: s('career'), designerId: s('designerId') },
    image: file instanceof File && file.size > 0 ? file : null,
    dropImage: s('dropImage') === '1',
  }
}

async function upload(image: File | null) {
  if (!image) return { ok: true as const, url: null }
  /* 화면이 줄여서 보낸다(shrinkAvatar) — 그래도 크면 서버 액션 본문 한도에 닿기 전에 거른다 */
  if (image.size > AVATAR_MAX_BYTES) return fail('이미지가 너무 큽니다. 다른 이미지를 골라 주세요.')
  const up = await putImage(image, 'roster')
  return up.ok ? { ok: true as const, url: up.url } : fail(up.error)
}

export async function createRosterDesigner(form: FormData): Promise<{ ok: true } | Fail> {
  const g = await guard()
  if ('error' in g) return g.error!

  const { input, image } = readForm(form)
  const bad = Object.values(checkDesignerInput(input))
  if (bad.length > 0) return fail(bad[0]!)

  /* 맨 아래에 붙인다 */
  const { data: last, error: lastErr } = await g.db
    .from('roster_designers')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (lastErr) return dbFail(lastErr, '저장')

  const up = await upload(image)
  if (!up.ok) return up

  const { error } = await g.db.from('roster_designers').insert({
    name: input.name.trim(),
    career: input.career.trim(),
    designer_id: input.designerId || null,
    avatar_url: up.url,
    sort_order: ((last?.sort_order as number | undefined) ?? -1) + 1,
  })
  if (error) return dbFail(error, '저장')

  refresh()
  return { ok: true }
}

export async function updateRosterDesigner(form: FormData): Promise<{ ok: true } | Fail> {
  const g = await guard()
  if ('error' in g) return g.error!

  const id = form.get('id')
  if (typeof id !== 'string' || !id) return fail('디자이너를 찾을 수 없습니다. 새로고침해 주세요.')

  const { input, image, dropImage } = readForm(form)
  const bad = Object.values(checkDesignerInput(input))
  if (bad.length > 0) return fail(bad[0]!)

  const up = await upload(image)
  if (!up.ok) return up

  const patch: Record<string, unknown> = {
    name: input.name.trim(),
    career: input.career.trim(),
    designer_id: input.designerId || null,
  }
  if (up.url) patch.avatar_url = up.url
  else if (dropImage) patch.avatar_url = null

  const { data, error } = await g.db.from('roster_designers').update(patch).eq('id', id).select('id').maybeSingle()
  if (error) return dbFail(error, '저장')
  if (!data) return fail('디자이너를 찾을 수 없습니다. 그사이 삭제됐을 수 있으니 새로고침해 주세요.')

  refresh()
  return { ok: true }
}

export async function deleteRosterDesigner(id: string): Promise<{ ok: true } | Fail> {
  const g = await guard()
  if ('error' in g) return g.error!

  /* 줄은 cascade 로 지워지지만 저장소의 실제 파일은 남는다 — 경로를 먼저 받아 둔다.
     0035 전이면 표가 없으니 건너뛴다 */
  const { data: files } = await g.db.from('roster_designer_files').select('path').eq('designer_id', id)

  const { error } = await g.db.from('roster_designers').delete().eq('id', id)
  if (error) return dbFail(error, '삭제')

  const paths = (files ?? []).map((f) => f.path as string)
  if (paths.length > 0) {
    const { error: rmErr } = await g.db.storage.from(ROSTER_FILES_BUCKET).remove(paths)
    if (rmErr) console.error('[admin/roster] 디자이너 파일 정리 실패:', rmErr.message)
  }
  refresh()
  return { ok: true }
}

/* ─────────── 포트폴리오 파일 ───────────

   파일은 서버 액션을 거치지 않는다 — 본문 크기 제한에 걸린다. 서명 업로드 주소를 주고
   브라우저가 저장소에 바로 올린 뒤(prepare → 업로드 → add), 경로를 받아 목록에 적는다.
   50MB 를 넘는 이미지·PDF 는 브라우저가 미리 줄여서 올린다(roster-manager 의 FilePanel). */

const filesFail = (err: { code?: string; message?: string } | null, what: string) =>
  isMissingTable(err) || /roster_designer_files/.test(err?.message ?? '') ? fail(MISSING_FILES_MSG) : dbFail(err, what)

export async function prepareRosterFileUpload(
  designerId: string,
  name: string,
  size: number,
): Promise<{ ok: true; path: string; token: string } | Fail> {
  const g = await guard()
  if ('error' in g) return g.error!
  if (!/^[0-9a-f-]{36}$/i.test(designerId)) return fail('디자이너를 찾을 수 없습니다. 새로고침해 주세요.')

  const bad = checkFile(String(name ?? ''), Number(size))
  if (bad) return fail(bad)

  const { count, error } = await g.db
    .from('roster_designer_files')
    .select('id', { count: 'exact', head: true })
    .eq('designer_id', designerId)
  if (error) return filesFail(error, '업로드 준비')
  if ((count ?? 0) >= MAX_FILES_PER_DESIGNER) {
    return fail(`파일은 디자이너당 ${MAX_FILES_PER_DESIGNER}개까지 올릴 수 있습니다. 필요 없는 파일을 먼저 지워 주세요.`)
  }

  const path = `${designerId}/${crypto.randomUUID()}.${fileExt(name)}`
  const { data, error: signErr } = await g.db.storage.from(ROSTER_FILES_BUCKET).createSignedUploadUrl(path)
  if (signErr || !data) {
    console.error('[admin/roster] 업로드 주소 생성 실패:', signErr?.message)
    if (signErr && /bucket|related resource does not exist/i.test(signErr.message)) return fail(MISSING_FILES_MSG)
    return fail('업로드를 준비하지 못했습니다.')
  }
  return { ok: true, path: data.path, token: data.token }
}

export async function addRosterFile(
  designerId: string,
  path: string,
  name: string,
  size: number,
): Promise<{ ok: true } | Fail> {
  const g = await guard()
  if ('error' in g) return g.error!

  /* 이 액션이 만든 모양의 경로만 받는다 — 남의 디자이너 폴더나 다른 버킷 경로를 끼울 수 없게 */
  const re = new RegExp(`^${designerId.replace(/[^0-9a-f-]/gi, '')}/[0-9a-f-]{36}\\.[a-z0-9]{1,8}$`)
  if (!/^[0-9a-f-]{36}$/i.test(designerId) || !re.test(path)) return fail('올린 파일을 확인하지 못했습니다. 다시 올려 주세요.')
  const bad = checkFile(String(name ?? ''), Number(size))
  if (bad) return fail(bad)

  const { data: last, error: lastErr } = await g.db
    .from('roster_designer_files')
    .select('sort_order')
    .eq('designer_id', designerId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (lastErr) return filesFail(lastErr, '파일 저장')

  const { error } = await g.db.from('roster_designer_files').insert({
    designer_id: designerId,
    path,
    name: name.trim(),
    size,
    sort_order: ((last?.sort_order as number | undefined) ?? -1) + 1,
  })
  if (error) {
    /* 목록에 못 적었으면 올린 파일은 고아가 된다 — 지운다 */
    await g.db.storage.from(ROSTER_FILES_BUCKET).remove([path])
    return filesFail(error, '파일 저장')
  }
  refresh()
  return { ok: true }
}

export async function deleteRosterFile(id: string): Promise<{ ok: true } | Fail> {
  const g = await guard()
  if ('error' in g) return g.error!

  const { data, error } = await g.db.from('roster_designer_files').delete().eq('id', id).select('path').maybeSingle()
  if (error) return filesFail(error, '파일 삭제')
  if (!data) return fail('이미 삭제된 파일입니다. 새로고침해 확인해 주세요.')

  const { error: rmErr } = await g.db.storage.from(ROSTER_FILES_BUCKET).remove([data.path as string])
  if (rmErr) console.error('[admin/roster] 저장소 파일 삭제 실패:', rmErr.message)
  refresh()
  return { ok: true }
}

/* 화면의 새 순서를 그대로 받아 0, 1, 2… 로 다시 매긴다 */
export async function reorderRosterDesigners(ids: string[]): Promise<{ ok: true } | Fail> {
  const g = await guard()
  if ('error' in g) return g.error!
  if (!Array.isArray(ids) || ids.length > 300 || ids.some((i) => typeof i !== 'string')) {
    return fail('순서를 저장하지 못했습니다. 새로고침해 주세요.')
  }

  const results = await Promise.all(
    ids.map((id, i) => g.db.from('roster_designers').update({ sort_order: i }).eq('id', id)),
  )
  const err = results.find((r) => r.error)?.error ?? null
  if (err) return dbFail(err, '순서 저장')

  refresh()
  return { ok: true }
}
