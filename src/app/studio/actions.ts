'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { signIn, destroySession, changePassword, readSession } from '@/lib/designer-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { putImage } from '@/lib/upload'
import {
  type WorkRow,
  MAX_WORKS,
  MAX_DESCRIPTION,
  MIN_ROW_SPAN,
  MAX_ROW_SPAN,
  MAX_BIO,
  checkPublicReady,
} from '@/lib/portfolio-limits'
import { isDesignPrice, isPremiumPrice, formatPrice } from '@/lib/plans'
import { listVisibleSpecialties } from '@/lib/specialties'
import { MAX_TAGS } from '@/lib/specialty-shape'

export type Result<T = unknown> = ({ ok: true } & T) | { ok: false; error: string }

function fail(error: string) {
  return { ok: false as const, error }
}

/* 서버 액션은 누구나 호출할 수 있는 엔드포인트다.
   페이지에서 막았더라도 여기서 로그인 여부를 다시 확인해야 한다.
   id 는 세션에서만 꺼낸다 — 클라이언트가 보낸 id 를 믿으면 남의 데이터를 고칠 수 있다. */
async function guard() {
  const session = await readSession()
  if (!session) throw new Error('로그인이 필요합니다.')
  if (!supabaseAdmin) throw new Error('서버 설정이 완료되지 않았습니다.')
  return { db: supabaseAdmin, id: session.id }
}

/* 프로필·작업을 고치면 관리 화면과 공개 화면 양쪽이 바뀐다.
   id 를 넘기면 그 디자이너의 공개 상세까지 함께 되살린다. */
function refresh(id?: string) {
  revalidatePath('/studio')
  revalidatePath('/explore')
  if (id) revalidatePath(`/designers/${id}`)
}

/* ─────────── 로그인 ─────────── */

export async function login(email: string, password: string): Promise<Result> {
  if (!email.trim() || !password) {
    return fail('이메일과 비밀번호를 입력해 주세요.')
  }

  const r = await signIn(email, password)
  if (!r.ok) return fail(r.error)
  return { ok: true }
}

export async function logout() {
  await destroySession()
  redirect('/studio/login')
}

/* 비밀번호 변경 — 세션에서 id를 꺼내므로 다른 계정을 건드릴 수 없다 */
export async function updatePassword(current: string, next: string): Promise<Result> {
  const session = await readSession()
  if (!session) return fail('로그인이 필요합니다.')

  const r = await changePassword(session.id, current, next)
  if (!r.ok) return fail(r.error)

  refresh()
  return { ok: true }
}

/* ─────────── 프로필 ─────────── */

export type ProfileInput = {
  name: string
  oneLiner: string
  bio: string
  tags: string
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

export async function updateProfile(input: ProfileInput): Promise<Result> {
  const { db, id } = await guard()

  const name = input.name.trim()

  /* 이름은 관리자가 정해줬으면 잠겨 있다 — 본인은 바꿀 수 없다.
     잠금 여부를 클라이언트에 맡기면 우회되므로 서버에서 다시 읽는다. */
  const { data: me } = await db
    .from('designers')
    .select('name_locked')
    .eq('id', id)
    .maybeSingle()

  if (!me) return fail('계정을 찾을 수 없습니다.')

  const locked = Boolean((me as { name_locked: boolean }).name_locked)

  /* 길이는 DB check 제약이 최종 방어하지만, 거부되면 '수정에 실패했습니다'
     라는 뭉뚱그린 메시지만 남는다 — 여기서 먼저 알려준다. */
  const bio = input.bio.trim()
  if (bio.length > MAX_BIO) {
    return fail(`소개글은 ${MAX_BIO}자 이내로 입력해 주세요.`)
  }

  const allowed = await listVisibleSpecialties()
  if (allowed.length > 0 && parseTags(input.tags).length > MAX_TAGS) {
    return fail(`전문 분야는 ${MAX_TAGS}개까지 고를 수 있습니다.`)
  }

  const patch: Record<string, unknown> = {
    one_liner: input.oneLiner.trim() || null,
    bio: bio || null,
    /* 어드민이 켜 둔 분야만 남긴다(011_specialties.sql). 서버 액션은
       누구나 부를 수 있으므로 화면이 보낸 값을 그대로 믿지 않는다 —
       아무 글자나 들어오면 탐색 필터가 다시 지저분해진다.
       목록이 비어 있으면(마이그레이션 전) 거르지 않고 지금까지처럼 둔다. */
    tags: allowed.length > 0 ? parseTags(input.tags).filter((t) => allowed.includes(t)) : parseTags(input.tags),
  }

  if (!locked) {
    if (!name) return fail('이름을 입력해 주세요.')
    patch.name = name
    /* 본인이 한 번 정했으면 이후 변경은 관리자에게 요청한다 */
    patch.name_locked = true
  }

  const { error } = await db.from('designers').update(patch).eq('id', id)

  if (error) {
    console.error('[designers] 프로필 수정 실패:', error.message)
    return fail('수정에 실패했습니다.')
  }

  refresh(id)
  return { ok: true }
}

/* 프로필 공개 여부 — 디자이너 본인이 정한다.

   계정 스위치(visible)와는 다른 컬럼이다. visible 을 본인에게 맡기면
   끄는 순간 세션이 무효가 되어 다시 켜러 들어올 수 없다. */
export async function setProfilePublic(isPublic: boolean): Promise<Result> {
  const { db, id } = await guard()

  /* 켤 때만 조건을 본다 — 끄는 것은 언제든 할 수 있어야 한다.
     화면에서도 막지만 서버 액션은 누구나 부를 수 있다. */
  if (isPublic) {
    const { data: works, error: readErr } = await db
      .from('designer_works')
      .select('visible, ai_used')
      .eq('designer_id', id)

    if (readErr) {
      console.error('[designers] 공개 조건 확인 실패:', readErr.message)
      return fail('확인에 실패했습니다. 잠시 후 다시 시도해 주세요.')
    }

    const ready = checkPublicReady((works ?? []) as Pick<WorkRow, 'visible' | 'ai_used'>[])
    if (!ready.ok) {
      return fail(`공개하려면 ${ready.reasons.join(', ')}가 필요합니다.`)
    }
  }

  const { error } = await db
    .from('designers')
    .update({ profile_public: isPublic })
    .eq('id', id)

  if (error) {
    console.error('[designers] 프로필 공개 설정 실패:', error.message)
    return fail('변경에 실패했습니다.')
  }

  refresh(id)
  return { ok: true }
}

/* ─────────── 가격 ─────────── */

export type PlanInput = {
  designPrice: number
  premiumPrice: number
  premiumEnabled: boolean
  /* 받을 의뢰 유형(017_designer_scopes.sql, 019_scope_sample_optional.sql).

     본인이 정할 수 있는 것은 '메인 시안'과 '디자인 전체' 둘이다 —
     '디자인 + 개발'은 어드민이 열어 준다.
     받지 않는 값을 여기 두면 화면이 보내는 대로 덮어쓰게 된다. */
  scopeSample: boolean
  scopeFullDesign: boolean
}

/* 금액은 정해진 보기 중에서만 고를 수 있다.
   서버 액션은 누구나 부를 수 있으므로 클라이언트가 보낸 숫자를 믿지 않는다 —
   보기에 없으면 DB check 제약이 막기 전에 여기서 돌려보낸다. */
export async function updatePlans(input: PlanInput): Promise<Result> {
  const { db, id } = await guard()

  if (!isDesignPrice(input.designPrice)) {
    return fail('선택할 수 없는 금액입니다.')
  }
  if (!isPremiumPrice(input.premiumPrice)) {
    return fail('선택할 수 없는 금액입니다.')
  }

  /* 시작가는 상한을 넘을 수 없다 — 넘으면 공개 화면에
     "99,000 ~ 49,000원" 같은 뒤집힌 범위가 나간다.
     상한은 어드민만 정하므로 여기서 다시 읽어 확인한다. */
  const { data: me } = await db
    .from('designers')
    .select('price_max')
    .eq('id', id)
    .maybeSingle()

  if (!me) return fail('계정을 찾을 수 없습니다.')

  /* 받을 유형을 모두 꺼도 된다 — 탐색 목록에서는 빠지지만(designer-list.tsx)
     상세 링크는 그대로 열린다. 링크를 직접 건네 의뢰받는 디자이너가 쓴다. */

  const priceMax = me.price_max as number
  if (input.designPrice > priceMax) {
    return fail(
      `시작가는 상한(${formatPrice(priceMax)})보다 높을 수 없습니다. 상한을 올리려면 관리자에게 문의해 주세요.`,
    )
  }

  const { error } = await db
    .from('designers')
    .update({
      design_price: input.designPrice,
      premium_price: input.premiumPrice,
      premium_enabled: input.premiumEnabled,
      /* scope_with_dev 는 건드리지 않는다 — 어드민이 정하는 값이다 */
      scope_sample: input.scopeSample,
      scope_full_design: input.scopeFullDesign,
    })
    .eq('id', id)

  if (error) {
    console.error('[designers] 가격 설정 실패:', error.message)
    return fail('저장에 실패했습니다.')
  }

  refresh(id)
  return { ok: true }
}

export async function updateAvatar(form: FormData): Promise<Result<{ url: string }>> {
  const { db, id } = await guard()

  const file = form.get('image')
  if (!(file instanceof File) || file.size === 0) return fail('이미지를 선택해 주세요.')

  const up = await putImage(file, `avatar/${id}`)
  if (!up.ok) return fail(up.error)

  const { error } = await db.from('designers').update({ avatar_url: up.url }).eq('id', id)
  if (error) {
    console.error('[designers] 프로필 이미지 저장 실패:', error.message)
    return fail('저장에 실패했습니다.')
  }

  refresh(id)
  return { ok: true, url: up.url }
}

/* ─────────── 포트폴리오 ─────────── */

/* designer_works.year 컬럼은 남아 있지만 화면에서 쓰지 않는다 —
   입력도 표시도 없으므로 여기서 다루지 않고 null 로 둔다. */

/* 체크박스 값을 셋 중 하나로 읽는다(008_work_ai_used.sql).

   FormData 에 아예 키가 없으면 null — 구버전 클라이언트나 다른 호출부가
   묻지 않고 올린 경우다. 키가 있으면 본인이 답한 것이므로 true/false 로 굳힌다.
   체크하지 않은 체크박스는 브라우저가 전송하지 않으므로, 화면에서는
   hidden 으로 '답했다'는 사실을 함께 보낸다. */
function readAiUsed(form: FormData): boolean | null {
  if (form.get('aiAnswered') == null) return null
  return form.get('aiUsed') != null
}

/* 썸네일 영역을 폼에서 읽는다(009_work_thumb_crop.sql).
   어드민 쪽(admin/designers/actions.ts)과 같은 규칙이다 — 넷을 한 덩어리로
   다루고, 하나라도 비거나 범위를 벗어나면 통째로 미지정으로 돌린다. */
function readCrop(form: FormData) {
  const n = (k: string) => {
    const raw = form.get(k)
    if (raw == null) return null
    const v = Number(raw)
    return Number.isFinite(v) ? v : null
  }

  const x = n('cropX')
  const y = n('cropY')
  const w = n('cropW')
  const h = n('cropH')

  const none = { crop_x: null, crop_y: null, crop_w: null, crop_h: null }
  if (x == null || y == null || w == null || h == null) return none

  const sane = x >= 0 && y >= 0 && w > 0 && h > 0 && x + w <= 1.0001 && y + h <= 1.0001
  if (!sane) return none

  return { crop_x: x, crop_y: y, crop_w: w, crop_h: h }
}

export async function addWork(form: FormData): Promise<Result<{ id: string }>> {
  const { db, id } = await guard()

  const file = form.get('image')
  const title = String(form.get('title') ?? '').trim()
  const description = String(form.get('description') ?? '').trim()
  const client = String(form.get('client') ?? '').trim()
  const width = Number(form.get('width')) || null
  const height = Number(form.get('height')) || null
  const aiUsed = readAiUsed(form)
  /* 해당할 때만 켜는 표시라 '묻지 않음'이 없다 — 키가 있으면 켠 것 */
  const soomWork = form.get('soomWork') != null

  if (!(file instanceof File) || file.size === 0) return fail('이미지를 선택해 주세요.')
  if (description.length > MAX_DESCRIPTION) {
    return fail(`설명은 ${MAX_DESCRIPTION}자 이내로 입력해 주세요.`)
  }

  /* 상한은 DB 트리거가 최종 방어하지만, 업로드를 먼저 하면
     거부될 이미지가 버킷에 남는다 — 여기서 먼저 센다. */
  const { count } = await db
    .from('designer_works')
    .select('id', { count: 'exact', head: true })
    .eq('designer_id', id)

  if ((count ?? 0) >= MAX_WORKS) {
    return fail(`포트폴리오는 최대 ${MAX_WORKS}개까지 올릴 수 있습니다.`)
  }

  const up = await putImage(file, `works/${id}`)
  if (!up.ok) return fail(up.error)

  /* 썸네일 — 화면에서 만들어 함께 보낸다(make-thumb.ts).
     못 만들었으면 원본을 가리킨다 — 어드민 등록(adminAddWork)과 같은 방침이다. */
  const thumb = form.get('thumb')
  let thumbUrl = up.url
  if (thumb instanceof File && thumb.size > 0) {
    const t = await putImage(thumb, `works/${id}/thumbs`)
    if (t.ok) thumbUrl = t.url
    else console.error('[works] 썸네일 저장 실패, 원본으로 대체:', t.error)
  }

  /* 세로로 긴 이미지는 기본 2칸 — 비율대로 쌓이는 모양이 자연스럽다.
     올린 뒤 본인이 조절할 수 있다. */
  const rowSpan = width && height && height > width * 1.4 ? 2 : 1

  const { data, error } = await db
    .from('designer_works')
    .insert({
      designer_id: id,
      image_url: up.url,
      thumb_url: thumbUrl,
      width,
      height,
      title: title || null,
      description: description || null,
      client: client || null,
      ai_used: aiUsed,
      /* 020 전 DB 에서는 컬럼이 없어 insert 가 통째로 실패한다 —
         켠 경우에만 싣는다. 끈 값은 DB 기본값(false)과 같다. */
      ...(soomWork ? { soom_work: true } : {}),
      row_span: rowSpan,
      sort_order: count ?? 0,
    })
    .select('id')
    .maybeSingle()

  if (error || !data) {
    console.error('[works] 등록 실패:', error?.message)
    /* 트리거가 막은 경우 메시지를 그대로 보여준다 */
    return fail(error?.message.includes('최대') ? error.message : '등록에 실패했습니다.')
  }

  refresh(id)
  return { ok: true, id: data.id as string }
}

export type WorkInput = {
  id: string
  title: string
  description: string
  /* 선택 입력 — 빈 문자열이면 지운다 */
  client: string
  /* masonry 세로 칸 수. 화면에서 더는 조절하지 않으므로 보통 넘어오지
     않는다 — 그때는 지금 값을 그대로 둔다. 컬럼은 공개 화면이 계속 쓴다. */
  rowSpan?: number
  /* 편집 화면은 체크박스로 받으므로 true/false 만 온다 —
     한 번 편집하면 null(미응답)로 되돌릴 수 없다. 의도된 동작이다. */
  aiUsed: boolean
  /* SOOM 에서 수행한 의뢰인지(020_work_soom_project.sql) */
  soomWork: boolean
}

export async function updateWork(input: WorkInput): Promise<Result> {
  const { db, id } = await guard()

  const description = input.description.trim()
  if (description.length > MAX_DESCRIPTION) {
    return fail(`설명은 ${MAX_DESCRIPTION}자 이내로 입력해 주세요.`)
  }

  const patch: Record<string, unknown> = {
    title: input.title.trim() || null,
    description: description || null,
    client: input.client.trim() || null,
    ai_used: input.aiUsed,
    soom_work: input.soomWork,
  }

  /* 보내 왔을 때만 손댄다 — 넘어오지 않은 값을 기본값으로 덮으면
     화면에 없는 설정이 조용히 초기화된다. */
  if (input.rowSpan != null) {
    patch.row_span = Math.min(MAX_ROW_SPAN, Math.max(MIN_ROW_SPAN, Math.round(input.rowSpan)))
  }

  /* designer_id 조건을 함께 걸어 남의 작업을 고치지 못하게 한다 */
  const { error } = await db
    .from('designer_works')
    .update(patch)
    .eq('id', input.id)
    .eq('designer_id', id)

  if (error) {
    console.error('[works] 수정 실패:', error.message)
    return fail('수정에 실패했습니다.')
  }

  refresh(id)
  return { ok: true }
}

/* 썸네일 영역을 다시 잡는다.

   어드민용(adminUpdateWorkCrop)과 하는 일은 같고 범위만 세션 id 로 묶는다.
   좌표(crop_*)만 고치는 게 아니라 썸네일 파일도 다시 만들어 올린다 —
   목록은 thumb_url 을 그대로 쓰므로, 좌표만 바꾸면 예전 그림이 남는다.
   자르는 일은 화면에서 하고(make-thumb.ts) 여기서는 저장만 한다. */
export async function updateWorkCrop(form: FormData): Promise<Result> {
  const { db, id } = await guard()

  const workId = String(form.get('id') ?? '')
  if (!workId) return fail('작업을 찾을 수 없습니다.')

  const patch: Record<string, unknown> = { ...readCrop(form) }

  const thumb = form.get('thumb')
  if (thumb instanceof File && thumb.size > 0) {
    const up = await putImage(thumb, `works/${id}/thumbs`)
    if (!up.ok) return fail(up.error)
    patch.thumb_url = up.url
  }

  const { error } = await db
    .from('designer_works')
    .update(patch)
    .eq('id', workId)
    .eq('designer_id', id)

  if (error) {
    console.error('[works] 썸네일 영역 수정 실패:', error.message)
    return fail('썸네일을 바꾸지 못했습니다.')
  }

  refresh(id)
  return { ok: true }
}

/* 포트폴리오 순서를 통째로 다시 매긴다.

   어드민용(adminReorderWorks)과 하는 일은 같지만 범위를 묶는 방법이 다르다 —
   여기서는 세션에서 꺼낸 id 로만 고친다. 본인 작업만 건드릴 수 있다.

   화면에서 끌어 놓은 결과를 받아 0번부터 다시 번호를 붙인다. 끼워 넣은
   자리에 소수를 주는 방법도 있지만, 몇 번 옮기다 보면 자릿수가 늘어
   결국 다시 매겨야 한다. 30개 상한이라 전부 다시 쓰는 편이 단순하다. */
export async function reorderWorks(ids: string[]): Promise<Result> {
  const { db, id } = await guard()

  if (ids.length === 0) return { ok: true }

  /* 서버 액션은 누구나 부를 수 있다 — 화면이 보낸 id 를 믿지 않고
     내 것인지 다시 확인한다. */
  const { data: owned, error: readErr } = await db
    .from('designer_works')
    .select('id')
    .eq('designer_id', id)

  if (readErr) {
    console.error('[works] 순서 변경용 조회 실패:', readErr.message)
    return fail('순서를 바꾸지 못했습니다.')
  }

  const mine = new Set((owned ?? []).map((w) => w.id as string))
  const clean = ids.filter((workId) => mine.has(workId))

  /* 화면이 가진 목록과 DB 가 어긋나면(다른 탭에서 지웠다든지) 섣불리
     쓰지 않는다 — 빠진 작업이 0번으로 몰려 순서가 뒤엉킨다. */
  if (clean.length !== mine.size) {
    return fail('목록이 바뀌었습니다. 새로고침 후 다시 시도해 주세요.')
  }

  const results = await Promise.all(
    clean.map((workId, i) =>
      db
        .from('designer_works')
        .update({ sort_order: i })
        .eq('id', workId)
        .eq('designer_id', id),
    ),
  )

  const failedOne = results.find((r) => r.error)
  if (failedOne?.error) {
    console.error('[works] 순서 변경 실패:', failedOne.error.message)
    return fail('순서를 바꾸지 못했습니다.')
  }

  refresh(id)
  return { ok: true }
}

export async function setWorkVisible(workId: string, visible: boolean): Promise<Result> {
  const { db, id } = await guard()

  const { error } = await db
    .from('designer_works')
    .update({ visible })
    .eq('id', workId)
    .eq('designer_id', id)

  if (error) {
    console.error('[works] 노출 변경 실패:', error.message)
    return fail('변경에 실패했습니다.')
  }

  refresh(id)
  return { ok: true }
}

/* 요청대로 DB에서 바로 지운다. Storage 파일은 되돌릴 수 있도록 남겨둔다. */
export async function deleteWork(workId: string): Promise<Result> {
  const { db, id } = await guard()

  const { error } = await db
    .from('designer_works')
    .delete()
    .eq('id', workId)
    .eq('designer_id', id)

  if (error) {
    console.error('[works] 삭제 실패:', error.message)
    return fail('삭제에 실패했습니다.')
  }

  refresh(id)
  return { ok: true }
}
