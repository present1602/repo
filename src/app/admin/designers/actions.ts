'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { getAdminUser } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { generateTempPassword, hashPassword } from '@/lib/password'
import { sendTempPassword } from '@/lib/designer-mail'
import { displayName } from '@/lib/display-name'
import { putImage } from '@/lib/upload'
import { MAX_DESCRIPTION, MAX_BIO, MAX_WORKS } from '@/lib/portfolio-limits'

/* 서버 액션은 누구나 호출할 수 있는 엔드포인트다.
   페이지에서 막았더라도 여기서 권한을 다시 확인해야 한다. */
async function guard() {
  const user = await getAdminUser()
  if (!user) throw new Error('권한이 없습니다.')
  if (!supabaseAdmin) throw new Error('서버 설정이 완료되지 않았습니다.')
  return supabaseAdmin
}

export type Result<T = unknown> = ({ ok: true } & T) | { ok: false; error: string }

function fail(error: string) {
  return { ok: false as const, error }
}

function refresh(id?: string) {
  revalidatePath('/admin/designers')
  revalidatePath('/explore')
  if (id) {
    revalidatePath(`/admin/designers/${id}`)
    /* 어드민이 고친 내용도 공개 상세에 그대로 실린다 */
    revalidatePath(`/designers/${id}`)
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/* 메일에 넣을 로그인 주소 — 설정이 없으면 현재 요청 호스트를 쓴다 */
async function loginUrl() {
  const env = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '')
  if (env) return `${env}/studio/login`

  const h = await headers()
  const host = h.get('host') ?? 'localhost:3000'
  const proto = host.startsWith('localhost') ? 'http' : 'https'
  return `${proto}://${host}/studio/login`
}

/* 쉼표로 받은 분야를 배열로 — 빈 값과 중복을 걸러낸다 */
function parseTags(raw: string): string[] {
  return Array.from(
    new Set(
      raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  )
}

export type CreateInput = {
  email: string
  name: string
  oneLiner: string
  tags: string
}

/* 등록하면 임시 비밀번호를 만들어 메일로 보낸다.
   메일이 실패해도 계정은 남고, 어드민 화면에서 임시 비밀번호를 확인할 수 있다. */
export async function createDesigner(
  input: CreateInput,
): Promise<Result<{ id: string; tempPassword: string; mailed: boolean; mailError?: string }>> {
  const db = await guard()

  const email = input.email.trim().toLowerCase()
  const name = input.name.trim()

  if (!email) return fail('이메일을 입력해 주세요.')
  if (!EMAIL_RE.test(email)) return fail('이메일 주소를 확인해 주세요.')

  const tempPassword = generateTempPassword()

  const { data, error } = await db
    .from('designers')
    .insert({
      email,
      name: name || null,
      one_liner: input.oneLiner.trim() || null,
      tags: parseTags(input.tags),
      password_hash: hashPassword(tempPassword),
      temp_password: tempPassword,
      /* 관리자가 이름을 정해준 경우에만 잠근다.
         비워서 등록했으면 디자이너가 직접 한 번 정할 수 있어야 한다. */
      name_locked: Boolean(name),
    })
    .select('id')
    .maybeSingle()

  if (error) {
    if (error.code === '23505') return fail('이미 등록된 이메일입니다.')
    console.error('[designers] 등록 실패:', error.message)
    return fail('등록에 실패했습니다.')
  }
  if (!data) return fail('등록에 실패했습니다.')

  const mail = await sendTempPassword(
    email,
    displayName({ name: name || null, email }),
    tempPassword,
    await loginUrl(),
  )

  refresh()
  return {
    ok: true,
    id: data.id as string,
    tempPassword,
    mailed: mail.ok,
    ...(mail.ok ? {} : { mailError: mail.error }),
  }
}

export type UpdateInput = {
  id: string
  email: string
  name: string
  oneLiner: string
  bio: string
  tags: string
}

/* 관리자는 모든 항목을 고칠 수 있다 — 이름 잠금과 무관하다 */
export async function updateDesigner(input: UpdateInput): Promise<Result> {
  const db = await guard()

  const email = input.email.trim().toLowerCase()
  const name = input.name.trim()

  if (!email) return fail('이메일을 입력해 주세요.')
  if (!EMAIL_RE.test(email)) return fail('이메일 주소를 확인해 주세요.')

  const bio = input.bio.trim()
  if (bio.length > MAX_BIO) {
    return fail(`소개글은 ${MAX_BIO}자 이내로 입력해 주세요.`)
  }

  const { error } = await db
    .from('designers')
    .update({
      email,
      name: name || null,
      one_liner: input.oneLiner.trim() || null,
      bio: bio || null,
      tags: parseTags(input.tags),
    })
    .eq('id', input.id)

  if (error) {
    if (error.code === '23505') return fail('이미 등록된 이메일입니다.')
    console.error('[designers] 수정 실패:', error.message)
    return fail('수정에 실패했습니다.')
  }

  refresh(input.id)
  return { ok: true }
}

export async function setDesignerVisible(id: string, visible: boolean): Promise<Result> {
  const db = await guard()

  const { error } = await db.from('designers').update({ visible }).eq('id', id)
  if (error) {
    console.error('[designers] 노출 변경 실패:', error.message)
    return fail('변경에 실패했습니다.')
  }

  refresh(id)
  return { ok: true }
}

/* 임시 비밀번호 재발급 — 기존 비밀번호는 즉시 무효가 된다 */
export async function resetPassword(
  id: string,
): Promise<Result<{ tempPassword: string; mailed: boolean; mailError?: string }>> {
  const db = await guard()

  const { data: d } = await db
    .from('designers')
    .select('email, name')
    .eq('id', id)
    .maybeSingle()

  if (!d) return fail('디자이너를 찾을 수 없습니다.')

  const tempPassword = generateTempPassword()

  const { error } = await db
    .from('designers')
    .update({
      password_hash: hashPassword(tempPassword),
      temp_password: tempPassword,
      /* 다시 임시 상태로 돌아갔으므로 변경 시각을 지운다 */
      password_changed_at: null,
    })
    .eq('id', id)

  if (error) {
    console.error('[designers] 비밀번호 재발급 실패:', error.message)
    return fail('재발급에 실패했습니다.')
  }

  const mail = await sendTempPassword(
    d.email as string,
    displayName({ name: (d.name as string | null) ?? null, email: d.email as string }),
    tempPassword,
    await loginUrl(),
  )

  refresh(id)
  return {
    ok: true,
    tempPassword,
    mailed: mail.ok,
    ...(mail.ok ? {} : { mailError: mail.error }),
  }
}

export async function deleteDesigner(id: string): Promise<Result> {
  const db = await guard()

  const { error } = await db.from('designers').delete().eq('id', id)
  if (error) {
    console.error('[designers] 삭제 실패:', error.message)
    return fail('삭제에 실패했습니다.')
  }

  refresh()
  return { ok: true }
}

/* ─────────── 포트폴리오 ─────────── */
/* 디자이너 본인용 액션(app/studio/actions.ts)은 세션 id 로 범위를 묶는다.
   어드민은 누구의 작업이든 다룰 수 있어야 하므로 여기에 따로 둔다 —
   대신 getAdminUser() 로 권한을 확인한다. */

/* 체크박스 값을 셋 중 하나로 읽는다(008_work_ai_used.sql).
   studio/actions.ts 의 같은 이름 함수와 규칙이 같다 — 양쪽 화면이
   같은 체크박스를 쓰므로 읽는 방식도 어긋나지 않아야 한다. */
function readAiUsed(form: FormData): boolean | null {
  if (form.get('aiAnswered') == null) return null
  return form.get('aiUsed') != null
}

/* 어드민이 디자이너를 대신해 작업을 올린다.

   본인용(app/studio/actions.ts)은 세션에서 id 를 꺼내 범위를 묶지만,
   어드민은 어떤 디자이너든 다룰 수 있어야 하므로 designerId 를 받는다 —
   대신 guard() 로 관리자 권한을 확인한다. */
export async function adminAddWork(form: FormData): Promise<Result<{ id: string }>> {
  const db = await guard()

  const designerId = String(form.get('designerId') ?? '')
  if (!designerId) return fail('디자이너를 찾을 수 없습니다.')

  const file = form.get('image')
  const title = String(form.get('title') ?? '').trim()
  const width = Number(form.get('width')) || null
  const height = Number(form.get('height')) || null
  const aiUsed = readAiUsed(form)

  if (!(file instanceof File) || file.size === 0) return fail('이미지를 선택해 주세요.')

  /* 상한은 DB 트리거가 최종 방어하지만, 업로드를 먼저 하면
     거부될 이미지가 버킷에 남는다 — 여기서 먼저 센다. */
  const { count } = await db
    .from('designer_works')
    .select('id', { count: 'exact', head: true })
    .eq('designer_id', designerId)

  if ((count ?? 0) >= MAX_WORKS) {
    return fail(`포트폴리오는 최대 ${MAX_WORKS}개까지 올릴 수 있습니다.`)
  }

  /* 경로는 본인이 올릴 때와 같게 둔다 — 누가 올렸든 같은 디자이너의 폴더에 모인다 */
  const up = await putImage(file, `works/${designerId}`)
  if (!up.ok) return fail(up.error)

  /* 세로로 긴 이미지는 기본 2칸 — 올린 뒤 조절할 수 있다 */
  const rowSpan = width && height && height > width * 1.4 ? 2 : 1

  const { data, error } = await db
    .from('designer_works')
    .insert({
      designer_id: designerId,
      image_url: up.url,
      width,
      height,
      title: title || null,
      ai_used: aiUsed,
      row_span: rowSpan,
      sort_order: count ?? 0,
    })
    .select('id')
    .maybeSingle()

  if (error || !data) {
    console.error('[works] 어드민 등록 실패:', error?.message)
    /* 트리거가 막은 경우 메시지를 그대로 보여준다 */
    return fail(error?.message.includes('최대') ? error.message : '등록에 실패했습니다.')
  }

  refresh(designerId)
  return { ok: true, id: data.id as string }
}

export type AdminWorkInput = {
  id: string
  designerId: string
  title: string
  description: string
  /* 선택 입력 — 빈 문자열이면 지운다 */
  client: string
  /* 상세 화면은 체크박스로 받으므로 true/false 만 온다 —
     한 번 저장하면 null(미응답)로 되돌릴 수 없다. 의도된 동작이다. */
  aiUsed: boolean
}

export async function adminUpdateWork(input: AdminWorkInput): Promise<Result> {
  const db = await guard()

  const description = input.description.trim()
  if (description.length > MAX_DESCRIPTION) {
    return fail(`설명은 ${MAX_DESCRIPTION}자 이내로 입력해 주세요.`)
  }

  /* designer_works.year 컬럼은 남아 있지만 화면에서 쓰지 않으므로 건드리지 않는다 */
  const { error } = await db
    .from('designer_works')
    .update({
      title: input.title.trim() || null,
      description: description || null,
      client: input.client.trim() || null,
      ai_used: input.aiUsed,
    })
    .eq('id', input.id)

  if (error) {
    console.error('[works] 어드민 수정 실패:', error.message)
    return fail('수정에 실패했습니다.')
  }

  refresh(input.designerId)
  return { ok: true }
}

export async function adminSetWorkVisible(
  id: string,
  designerId: string,
  visible: boolean,
): Promise<Result> {
  const db = await guard()

  const { error } = await db.from('designer_works').update({ visible }).eq('id', id)
  if (error) {
    console.error('[works] 어드민 노출 변경 실패:', error.message)
    return fail('변경에 실패했습니다.')
  }

  refresh(designerId)
  return { ok: true }
}

/* ─────────── 메인 노출 ─────────── */

/* 어드민이 메인 화면에 걸 작업을 고르고 내린다.

   디자이너의 visible 은 건드리지 않는다 — 주인이 다르다. 여기서 켜도
   디자이너가 숨긴 작업은 메인에 뜨지 않고, 화면에 그 이유를 표시한다. */
export async function setWorkFeatured(id: string, featured: boolean): Promise<Result> {
  const db = await guard()

  const { error } = await db
    .from('designer_works')
    .update({
      featured,
      /* 고른 순서를 기억한다 — 메인은 최근에 고른 것부터 깐다.
         내릴 때 비워 두면 다시 골랐을 때 예전 자리로 돌아가지 않는다. */
      featured_at: featured ? new Date().toISOString() : null,
    })
    .eq('id', id)

  if (error) {
    console.error('[works] 메인 노출 변경 실패:', error.message)
    return fail('변경에 실패했습니다.')
  }

  revalidatePath('/admin/featured')
  /* 메인이 바로 바뀌어야 한다 — 어드민이 고른 뒤 홈을 열어 확인한다 */
  revalidatePath('/')
  return { ok: true }
}

/* 요청대로 DB에서 바로 지운다. Storage 파일은 되돌릴 수 있도록 남겨둔다. */
export async function adminDeleteWork(id: string, designerId: string): Promise<Result> {
  const db = await guard()

  const { error } = await db.from('designer_works').delete().eq('id', id)
  if (error) {
    console.error('[works] 어드민 삭제 실패:', error.message)
    return fail('삭제에 실패했습니다.')
  }

  refresh(designerId)
  return { ok: true }
}
