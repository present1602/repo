'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { getAdminUser } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { generateTempPassword, hashPassword } from '@/lib/password'
import { sendTempPassword } from '@/lib/designer-mail'
import { displayName } from '@/lib/display-name'
import { putImage, signImageUpload, claimImage, signPageUploads, claimPages } from '@/lib/upload'
import { SCOPES, SCOPE_LABELS, type Scope } from '@/lib/scopes'
import {
  MAX_DESCRIPTION,
  MAX_BIO,
  MAX_WORKS,
  checkPublicReady,
  type WorkRow,
} from '@/lib/portfolio-limits'
import {
  formatPrice,
  isDesignPrice,
  isPriceMax,
  isContractPrice,
  MIN_PRICE_MAX,
  MAX_PRICE_MAX,
  MIN_CONTRACT_PRICE,
  MAX_CONTRACT_PRICE,
  MAX_PLAN_DURATION,
  slotOf,
  type PlanTier,
  type RegisteredOption,
} from '@/lib/plans'
import {
  addCustomOption,
  removeCustomOption,
  replaceBucketOptions,
  replaceSlotOptions,
  slotOpenFor,
} from '@/lib/plan-options-db'

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
  /* 포트폴리오 모아보기에서도 같은 작업을 고친다 */
  revalidatePath('/admin/works')
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

/* 프로필 노출 — 계정(visible)은 그대로 두고 탐색·홈·상세에서만 빼거나 넣는다.
   로그인은 막지 않는다. 디자이너도 스튜디오에서 같은 값을 켜고 끌 수 있다.

   켤 때 공개 조건(작업 수 등)이 모자라도 어드민은 켤 수 있다 — 대신 무엇이
   모자란지 함께 돌려줘 알고 켜게 한다. */
export async function setDesignerProfilePublic(
  id: string,
  isPublic: boolean,
): Promise<Result<{ warning?: string }>> {
  const db = await guard()

  let warning: string | undefined
  if (isPublic) {
    const { data: works } = await db.from('designer_works').select('visible, ai_used').eq('designer_id', id)
    const ready = checkPublicReady((works ?? []) as Pick<WorkRow, 'visible' | 'ai_used'>[])
    if (!ready.ok) warning = `노출했지만 공개 조건이 모자랍니다: ${ready.reasons.join(', ')}`
  }

  const { error } = await db.from('designers').update({ profile_public: isPublic }).eq('id', id)
  if (error) {
    console.error('[designers] 프로필 노출 변경 실패:', error.message)
    return fail('변경에 실패했습니다.')
  }

  refresh(id)
  return { ok: true, ...(warning ? { warning } : {}) }
}

/* 디자이너의 금액들 — 시안 시작가·상한·본 계약 시작가.

   상한(016_price_range.sql)과 본 계약 시작가(030_contract_price.sql)는
   어드민만 정한다. 시작가는 디자이너도 고르지만 어드민이 대신 바꿀 수 있다.
   금액을 올려 줄 만한 디자이너를 가려내는 일은 사람이 판단하므로 상한·본 계약은
   자유 입력으로 둔다 — 대신 터무니없는 값은 막는다.

   시작가가 상한보다 높으면 범위가 뒤집힌다. DB check 제약(designers_price_order)이
   막아 주지만, 거부되면 뭉뚱그린 메시지만 남으므로 여기서 먼저 알려준다.

   바뀐 칸만 보낸다 — 030 을 적용하기 전에도 시작가·상한은 고칠 수 있게. */
export async function setDesignerPrices(
  id: string,
  next: {
    designPrice?: number
    priceMax?: number
    contractPrice?: number
    fullDesignPrice?: number
    projectPrice?: number
  },
): Promise<Result> {
  const db = await guard()

  if (next.designPrice != null && !isDesignPrice(next.designPrice)) {
    return fail('시작가는 보기 중에서 골라 주세요.')
  }
  if (next.priceMax != null && !isPriceMax(next.priceMax)) {
    return fail(
      `상한은 ${formatPrice(MIN_PRICE_MAX)} 이상 ${formatPrice(MAX_PRICE_MAX)} 이하로 적어 주세요.`,
    )
  }
  if (next.contractPrice != null && !isContractPrice(next.contractPrice)) {
    return fail(
      `본 계약 시작가는 ${formatPrice(MIN_CONTRACT_PRICE)} 이상 ${formatPrice(MAX_CONTRACT_PRICE)} 이하로 적어 주세요.`,
    )
  }
  /* 디자인 전체·프로젝트 최소가 — 본 계약 시작가와 같은 범위(035 의 check 제약과 같은 값) */
  for (const [label, v] of [
    ['디자인 전체 최소가', next.fullDesignPrice],
    ['프로젝트 최소가', next.projectPrice],
  ] as const) {
    if (v != null && !isContractPrice(v)) {
      return fail(
        `${label}는 ${formatPrice(MIN_CONTRACT_PRICE)} 이상 ${formatPrice(MAX_CONTRACT_PRICE)} 이하로 적어 주세요.`,
      )
    }
  }

  const { data: d, error: readErr } = await db
    .from('designers')
    .select('design_price, price_max')
    .eq('id', id)
    .maybeSingle()

  if (readErr || !d) return fail('디자이너를 찾을 수 없습니다.')

  const designPrice = next.designPrice ?? (d.design_price as number)
  const priceMax = next.priceMax ?? (d.price_max as number)
  if (designPrice > priceMax) {
    return fail(
      `시작가(${formatPrice(designPrice)})는 상한(${formatPrice(priceMax)})보다 높을 수 없습니다.`,
    )
  }

  const patch: Record<string, number> = {}
  if (next.designPrice != null) patch.design_price = next.designPrice
  if (next.priceMax != null) patch.price_max = next.priceMax
  if (next.contractPrice != null) patch.contract_price = next.contractPrice
  if (next.fullDesignPrice != null) patch.full_design_price = next.fullDesignPrice
  if (next.projectPrice != null) patch.project_price = next.projectPrice
  if (Object.keys(patch).length === 0) return { ok: true }

  const { error } = await db.from('designers').update(patch).eq('id', id)
  if (error) {
    console.error('[designers] 금액 변경 실패:', error.message)
    if (error.message.includes('contract_price')) {
      return fail('본 계약 시작가 칸이 아직 없습니다. 030_contract_price.sql 을 먼저 적용해 주세요.')
    }
    if (error.message.includes('full_design_price') || error.message.includes('project_price')) {
      return fail(
        '디자인 전체·프로젝트 최소가 칸이 아직 없습니다. 035_full_design_project_price.sql 을 먼저 적용해 주세요.',
      )
    }
    return fail('변경에 실패했습니다.')
  }

  refresh(id)
  /* 디자이너의 시작가 선택지가 바뀐다 */
  revalidatePath('/studio')
  /* 탐색 카드의 의뢰 폼 금액이 바뀐다 */
  revalidatePath('/explore')
  return { ok: true }
}

/* 유형별 프리미엄 — 디자이너마다 켜고 끄고 금액을 정한다. 어드민만(036_plan_copy_premium.sql).

   그 유형의 프리미엄이 설정에서 켜져 있어야 켤 수 있다. 끌 때는 금액을
   남겨 둔다 — 다시 켤 때 다시 적지 않게. 꺼져 있고 금액도 비었으면 줄을 지운다.
   받은 유형만 건드린다. */
export async function setDesignerPremiums(
  id: string,
  next: Partial<Record<Scope, { enabled: boolean; price: number | null }>>,
): Promise<Result> {
  const db = await guard()

  const { data: copyRows } = await db
    .from('plan_copy')
    .select('plan, enabled')
    .eq('tier', 'premium')
  const planOn = new Set(
    ((copyRows ?? []) as { plan: string; enabled: boolean }[]).filter((r) => r.enabled).map((r) => r.plan),
  )

  const upserts: { designer_id: string; plan: Scope; price: number; enabled: boolean }[] = []
  const removes: Scope[] = []
  for (const s of SCOPES) {
    const v = next[s]
    if (!v) continue

    if (v.enabled && !planOn.has(s)) {
      return fail(`${SCOPE_LABELS[s]}의 프리미엄이 설정에서 꺼져 있습니다. 먼저 켜 주세요.`)
    }
    if (v.enabled && v.price == null) {
      return fail(`${SCOPE_LABELS[s]}의 프리미엄 금액을 적어 주세요.`)
    }
    if (v.price == null) {
      removes.push(s)
      continue
    }
    if (!isContractPrice(v.price)) {
      return fail(
        `프리미엄 금액은 ${formatPrice(MIN_CONTRACT_PRICE)} 이상 ${formatPrice(MAX_CONTRACT_PRICE)} 이하로 적어 주세요.`,
      )
    }
    upserts.push({ designer_id: id, plan: s, price: v.price, enabled: v.enabled })
  }

  if (upserts.length > 0) {
    const { error } = await db
      .from('designer_premium_prices')
      .upsert(upserts, { onConflict: 'designer_id,plan' })
    if (error) {
      console.error('[designers] 프리미엄 저장 실패:', error.message)
      if (error.message.includes('designer_premium_prices') || error.message.includes('enabled')) {
        return fail('프리미엄 표가 아직 없거나 옛 판입니다. 036_plan_copy_premium.sql 을 먼저 적용해 주세요.')
      }
      return fail('프리미엄을 저장하지 못했습니다.')
    }
  }

  if (removes.length > 0) {
    const { error } = await db
      .from('designer_premium_prices')
      .delete()
      .eq('designer_id', id)
      .in('plan', removes)
    if (error) {
      console.error('[designers] 프리미엄 삭제 실패:', error.message)
      return fail('프리미엄을 지우지 못했습니다.')
    }
  }

  refresh(id)
  return { ok: true }
}

/* 디자이너별 작업 기간과 포함 항목 — 플랜(유형·단계) 하나씩 저장한다(037_plan_details.sql).

   duration 이 null 이면 전체 공통값을 따른다(줄을 지운다).
   포함 항목은 받은 목록이 그 플랜의 전부다 — 검사는 plan-options-db.ts 가 한다.
   받지 않는 유형도 미리 채워 둘 수 있다. 프리미엄은 설정에서 켠 유형만. */
export async function setDesignerPlanSetup(
  id: string,
  plan: Scope,
  tier: PlanTier,
  /* options 가 null 이면 포함 항목은 건드리지 않는다 — 기본 단계 항목은 0004 부터
     공통·분야별 목록(setDesignerBucketOptions)이 맡는다 */
  next: { duration: string | null; options: RegisteredOption[] | null },
): Promise<Result> {
  const db = await guard()

  if (!SCOPES.includes(plan) || (tier !== 'basic' && tier !== 'premium')) {
    return fail('알 수 없는 플랜입니다.')
  }

  const closed = await slotOpenFor(id, plan, tier, { requireAccepted: false })
  if (closed) return fail(closed)

  const duration = next.duration?.trim() || null
  if (duration && duration.length > MAX_PLAN_DURATION) {
    return fail(`작업 기간은 ${MAX_PLAN_DURATION}자 이내로 입력해 주세요.`)
  }

  const { error } =
    duration == null
      ? await db
          .from('designer_plan_details')
          .delete()
          .eq('designer_id', id)
          .eq('plan', plan)
          .eq('tier', tier)
      : await db
          .from('designer_plan_details')
          .upsert({ designer_id: id, plan, tier, duration }, { onConflict: 'designer_id,plan,tier' })
  if (error) {
    console.error('[designers] 작업 기간 저장 실패:', error.message)
    if (error.message.includes('designer_plan_details')) {
      return fail('플랜 상세 표가 아직 없습니다. 037_plan_details.sql 을 먼저 적용해 주세요.')
    }
    return fail('저장에 실패했습니다.')
  }

  if (next.options) {
    const optErr = await replaceSlotOptions(id, slotOf(plan, tier), next.options)
    if (optErr) return fail(optErr)
  }

  refresh(id)
  return { ok: true }
}

/* 기본 단계 포함 항목 한 목록 — 공통 또는 분야·범위 하나(0004_plan_options_by_category.sql).
   디자이너가 아직 고르지 않은 분야도 미리 채워 둘 수 있다. */
export async function setDesignerBucketOptions(
  id: string,
  bucket: string,
  options: RegisteredOption[],
): Promise<Result> {
  await guard()

  const err = await replaceBucketOptions(id, bucket, options)
  if (err) return fail(err)

  refresh(id)
  revalidatePath('/studio')
  return { ok: true }
}

/* 직접 적은 포함 항목 — 어드민이 대신 더하거나 지운다(0005) */
export async function addDesignerCustomOption(id: string, bucket: string, text: string): Promise<Result> {
  await guard()

  const err = await addCustomOption(id, bucket, text)
  if (err) return fail(err)

  refresh(id)
  revalidatePath('/studio')
  return { ok: true }
}

export async function removeDesignerCustomOption(id: string, optionId: string): Promise<Result> {
  await guard()

  const err = await removeCustomOption(id, optionId)
  if (err) return fail(err)

  refresh(id)
  revalidatePath('/studio')
  return { ok: true }
}

/* 받을 의뢰 유형 — 어드민이 디자이너마다 켜고 끌 수 있다.

   메인화면 시안 의뢰는 어드민만 정한다(0004_plan_options_by_category.sql) — 디자이너 화면에서는
   켜진 채 잠겨 있다. 디자인·프로젝트 의뢰는 디자이너 본인도 켜고 끄고, 어드민이 대신 바꿀 수 있다. */
const SCOPE_COLUMNS: Record<Scope, string> = {
  sample: 'scope_sample',
  logo: 'scope_logo',
  full_design: 'scope_full_design',
  with_dev: 'scope_with_dev',
}

export async function setDesignerScope(id: string, scope: Scope, on: boolean): Promise<Result> {
  const db = await guard()

  const column = SCOPE_COLUMNS[scope]
  if (!column) return fail('알 수 없는 의뢰 유형입니다.')

  const patch: Record<string, boolean> = { [column]: on }

  /* 디자인·프로젝트는 둘 다 끌 수 없다(0004) — 남는 쪽이 켜져 있을 때만 끈다 */
  if (!on && (scope === 'full_design' || scope === 'with_dev')) {
    const { data: cur } = await db
      .from('designers')
      .select('scope_full_design, scope_with_dev')
      .eq('id', id)
      .maybeSingle()
    if (!cur) return fail('디자이너를 찾을 수 없습니다.')
    const other = scope === 'full_design' ? cur.scope_with_dev : cur.scope_full_design
    if (!other) return fail('디자인 의뢰와 프로젝트 의뢰 중 하나는 켜져 있어야 합니다.')
  }

  const { error } = await db.from('designers').update(patch).eq('id', id)
  if (error) {
    console.error(`[designers] ${column} 설정 실패:`, error.message)
    return fail('변경에 실패했습니다.')
  }

  refresh(id)
  /* 디자이너 본인 화면의 표시도 바뀐다 */
  revalidatePath('/studio')
  /* 탐색의 유형 필터 결과가 달라진다 */
  revalidatePath('/explore')
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

/* 썸네일 영역을 폼에서 읽는다(009_work_thumb_crop.sql).

   넷을 따로 넣지 않고 한 덩어리로 다룬다 — 일부만 채워진 상태는
   DB check 제약이 거부하므로, 하나라도 비거나 범위를 벗어나면
   통째로 미지정으로 돌린다. */
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

  /* 화면에서도 막지만 서버 액션은 누구나 부를 수 있다 —
     범위를 벗어난 값은 제약에 걸려 등록 전체가 실패하므로 여기서 거른다. */
  const sane =
    x >= 0 && y >= 0 && w > 0 && h > 0 && x + w <= 1.0001 && y + h <= 1.0001
  if (!sane) return none

  return { crop_x: x, crop_y: y, crop_w: w, crop_h: h }
}

/* 어드민이 디자이너를 대신해 작업을 올린다.

   본인용(app/studio/actions.ts)은 세션에서 id 를 꺼내 범위를 묶지만,
   어드민은 어떤 디자이너든 다룰 수 있어야 하므로 designerId 를 받는다 —
   대신 guard() 로 관리자 권한을 확인한다. */
/* 원본은 브라우저가 서명 주소로 바로 올린다(upload.ts) — 본인용(prepareWorkUpload)과 같다 */
export async function adminPrepareWorkUpload(
  designerId: string,
  name: string,
  size: number,
): Promise<{ ok: true; path: string; token: string } | { ok: false; error: string }> {
  const db = await guard()
  if (!designerId) return fail('디자이너를 찾을 수 없습니다.')

  const { count } = await db
    .from('designer_works')
    .select('id', { count: 'exact', head: true })
    .eq('designer_id', designerId)
  if ((count ?? 0) >= MAX_WORKS) return fail(`포트폴리오는 최대 ${MAX_WORKS}개까지 올릴 수 있습니다.`)

  return signImageUpload(`works/${designerId}`, name, size)
}

/* PDF 의 둘째 장부터 — 본인용(prepareWorkPages)과 같다 */
export async function adminPrepareWorkPages(
  designerId: string,
  files: { name: string; size: number }[],
): Promise<{ ok: true; uploads: { path: string; token: string }[] } | { ok: false; error: string }> {
  const db = await guard()
  if (!designerId) return fail('디자이너를 찾을 수 없습니다.')
  if (files.length === 0) return { ok: true, uploads: [] }

  const { count } = await db
    .from('designer_works')
    .select('id', { count: 'exact', head: true })
    .eq('designer_id', designerId)
  if ((count ?? 0) >= MAX_WORKS) return fail(`포트폴리오는 최대 ${MAX_WORKS}개까지 올릴 수 있습니다.`)

  return signPageUploads(`works/${designerId}`, files)
}

export async function adminAddWork(form: FormData): Promise<Result<{ id: string }>> {
  const db = await guard()

  const designerId = String(form.get('designerId') ?? '')
  if (!designerId) return fail('디자이너를 찾을 수 없습니다.')

  const imageUrl = claimImage(`works/${designerId}`, String(form.get('imagePath') ?? ''))
  /* PDF 작업이면 imagePath 는 첫 장이고, 둘째 장부터는 pages 로 따로 온다 */
  const pages = claimPages(`works/${designerId}`, form.get('pages'))
  if (pages === false) return fail('PDF 페이지를 찾을 수 없습니다. 다시 올려 주세요.')
  const title = String(form.get('title') ?? '').trim()
  const description = String(form.get('description') ?? '').trim()
  const client = String(form.get('client') ?? '').trim()
  if (description.length > MAX_DESCRIPTION) {
    return fail(`설명은 ${MAX_DESCRIPTION}자 이내로 입력해 주세요.`)
  }
  const width = Number(form.get('width')) || null
  const height = Number(form.get('height')) || null
  const aiUsed = readAiUsed(form)
  /* 해당할 때만 켜는 표시라 '묻지 않음'이 없다 — 키가 있으면 켠 것 */
  const soomWork = form.get('soomWork') != null

  if (!imageUrl) return fail('이미지를 선택해 주세요.')

  /* 상한은 DB 트리거가 최종 방어하지만, 업로드를 먼저 하면
     거부될 이미지가 버킷에 남는다 — 여기서 먼저 센다. */
  const { count } = await db
    .from('designer_works')
    .select('id', { count: 'exact', head: true })
    .eq('designer_id', designerId)

  if ((count ?? 0) >= MAX_WORKS) {
    return fail(`포트폴리오는 최대 ${MAX_WORKS}개까지 올릴 수 있습니다.`)
  }

  /* 썸네일 — 화면에서 만들어 함께 보낸다(make-thumb.ts).
     못 만들었으면 원본을 가리킨다: 목록이 느려질 뿐이고, 여기서 막으면
     올리는 일 자체가 멈춘다. 화면 코드가 분기를 갖지 않도록
     thumb_url 은 항상 채워 둔다. */
  const thumb = form.get('thumb')
  let thumbUrl = imageUrl
  if (thumb instanceof File && thumb.size > 0) {
    const t = await putImage(thumb, `works/${designerId}/thumbs`)
    if (t.ok) thumbUrl = t.url
    else console.error('[works] 썸네일 저장 실패, 원본으로 대체:', t.error)
  }

  /* 세로로 긴 이미지는 기본 2칸 — 올린 뒤 조절할 수 있다 */
  /* 영역을 잡았으면 그 비율로 본다 — PDF 는 width·height 가 장을 이어 붙인
     전체 크기라 그대로 재면 늘 길쭉하다(영역은 늘 함께 온다, work-stack.ts) */
  const cropped = readCrop(form)
  const tw = width && cropped.crop_w != null ? width * cropped.crop_w : width
  const th = height && cropped.crop_h != null ? height * cropped.crop_h : height
  const rowSpan = tw && th && th > tw * 1.4 ? 2 : 1

  /* 새 작업은 맨 앞에 선다 — 지금 맨 앞보다 하나 작은 번호를 준다.
     뒤 작업들의 번호를 하나씩 미는 것보다 한 줄로 끝난다. 음수가 되어도
     순서만 맞으면 된다 — 끌어서 순서를 바꾸면 0부터 다시 매긴다. */
  const { data: head } = await db
    .from('designer_works')
    .select('sort_order')
    .eq('designer_id', designerId)
    .order('sort_order', { ascending: true })
    .limit(1)
    .maybeSingle()
  const sortOrder = head ? (head.sort_order as number) - 1 : 0

  const { data, error } = await db
    .from('designer_works')
    .insert({
      designer_id: designerId,
      image_url: imageUrl,
      thumb_url: thumbUrl,
      width,
      height,
      title: title || null,
      description: description || null,
      client: client || null,
      ai_used: aiUsed,
      /* 올리기 창에서 고른다(work-uploader.tsx). 값이 오지 않으면 예전처럼 DB 기본값(노출) */
      ...(form.get('visible') != null ? { visible: form.get('visible') === '1' } : {}),
      /* 020 전 DB 에서는 컬럼이 없어 insert 가 통째로 실패한다 —
         켠 경우에만 싣는다. 끈 값은 DB 기본값(false)과 같다. */
      ...(soomWork ? { soom_work: true } : {}),
      /* 0008 전 DB 에서는 컬럼이 없다 — PDF 일 때만 싣는다 */
      ...(pages && pages.length > 0 ? { pages } : {}),
      ...readCrop(form),
      row_span: rowSpan,
      sort_order: sortOrder,
    })
    .select('id')
    .maybeSingle()

  if (error || !data) {
    console.error('[works] 어드민 등록 실패:', error?.message)
    if (error?.message.includes('pages')) {
      return fail('PDF 저장 칸이 없습니다. 0008_work_pdf_pages.sql 마이그레이션을 실행해 주세요.')
    }
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
  /* SOOM 에서 수행한 의뢰인지(020_work_soom_project.sql) */
  soomWork: boolean
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
      soom_work: input.soomWork,
    })
    .eq('id', input.id)

  if (error) {
    console.error('[works] 어드민 수정 실패:', error.message)
    return fail('수정에 실패했습니다.')
  }

  refresh(input.designerId)
  return { ok: true }
}

/* 썸네일 영역을 다시 잡는다.

   좌표(crop_*)만 고치는 게 아니라 썸네일 파일도 다시 만들어 올린다 —
   목록은 thumb_url 을 그대로 쓰므로, 좌표만 바꾸면 화면에는 예전 그림이
   그대로 남는다. 자르는 일은 화면에서 하고(make-thumb.ts) 여기서는
   받은 파일을 저장만 한다.

   예전 썸네일 파일은 지우지 않는다 — 되돌릴 일이 있을 수 있고,
   Storage 비용보다 잘못 지웠을 때가 더 비싸다. */
export async function adminUpdateWorkCrop(form: FormData): Promise<Result> {
  const db = await guard()

  const id = String(form.get('id') ?? '')
  const designerId = String(form.get('designerId') ?? '')
  if (!id || !designerId) return fail('작업을 찾을 수 없습니다.')

  const patch: Record<string, unknown> = { ...readCrop(form) }

  const thumb = form.get('thumb')
  if (thumb instanceof File && thumb.size > 0) {
    const up = await putImage(thumb, `works/${designerId}/thumbs`)
    if (!up.ok) return fail(up.error)
    patch.thumb_url = up.url
  }

  /* designer_id 조건을 함께 걸어 남의 작업을 고치지 못하게 한다 */
  const { error } = await db
    .from('designer_works')
    .update(patch)
    .eq('id', id)
    .eq('designer_id', designerId)

  if (error) {
    console.error('[works] 썸네일 영역 수정 실패:', error.message)
    return fail('썸네일을 바꾸지 못했습니다.')
  }

  refresh(designerId)
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

/* 포트폴리오 순서를 통째로 다시 매긴다.

   화면에서 끌어 놓은 결과를 받아 0번부터 다시 번호를 붙인다 —
   끼워 넣은 자리에 소수를 주는 방법도 있지만, 몇 번 옮기다 보면
   자릿수가 늘어 결국 다시 매겨야 한다. 장수가 30개 상한이라
   전부 다시 쓰는 편이 단순하고 빠르다.

   받은 id 는 반드시 그 디자이너의 것이어야 한다 — 남의 작업 id 가
   섞여 들어오면 그 작업의 순서가 엉뚱하게 바뀐다. */
export async function adminReorderWorks(
  designerId: string,
  ids: string[],
): Promise<Result> {
  const db = await guard()

  if (!designerId) return fail('디자이너를 찾을 수 없습니다.')
  if (ids.length === 0) return { ok: true }

  /* 지금 이 디자이너가 가진 작업을 먼저 읽어 받은 목록과 맞춰 본다.
     서버 액션은 누구나 부를 수 있으므로 화면이 보낸 id 를 믿지 않는다. */
  const { data: owned, error: readErr } = await db
    .from('designer_works')
    .select('id')
    .eq('designer_id', designerId)

  if (readErr) {
    console.error('[works] 순서 변경용 조회 실패:', readErr.message)
    return fail('순서를 바꾸지 못했습니다.')
  }

  const mine = new Set((owned ?? []).map((w) => w.id as string))
  const clean = ids.filter((id) => mine.has(id))

  /* 화면이 가진 목록과 DB 가 어긋나면(다른 탭에서 지웠다든지) 섣불리
     쓰지 않는다 — 빠진 작업이 0번으로 몰려 순서가 뒤엉킨다. */
  if (clean.length !== mine.size) {
    return fail('목록이 바뀌었습니다. 새로고침 후 다시 시도해 주세요.')
  }

  /* 한 건씩 보낸다. upsert 로 묶으면 not-null 인 다른 컬럼까지
     함께 넘겨야 하고, 빠뜨리면 그 값이 지워진다. */
  const results = await Promise.all(
    clean.map((id, i) =>
      db.from('designer_works').update({ sort_order: i }).eq('id', id).eq('designer_id', designerId),
    ),
  )

  const failedOne = results.find((r) => r.error)
  if (failedOne?.error) {
    console.error('[works] 순서 변경 실패:', failedOne.error.message)
    return fail('순서를 바꾸지 못했습니다.')
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
  /* 고르는 화면도 함께 — 고른 뒤 표시가 그대로면 반영됐는지 알 수 없다 */
  revalidatePath('/admin/featured/add')
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
