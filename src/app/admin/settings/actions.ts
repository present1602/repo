'use server'

import { revalidatePath } from 'next/cache'
import { getAdminUser } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import {
  MAX_OPTION_TEMPLATE,
  isContractPrice,
  MAX_PLAN_DESC,
  MAX_PLAN_DURATION,
  MAX_PLAN_NAME,
  PLAN_TIERS,
  PLAN_SLOTS,
  type PlanCopies,
  type PlanSlot,
  type PlanTier,
} from '@/lib/plans'
import { SCOPES, type Scope } from '@/lib/scopes'
import {
  isSpecialtyScopeMode,
  PRICE_SCOPES,
  PRICE_TIERS,
  type PriceScope,
  type PriceTier,
  type SpecialtyScopeMode,
} from '@/lib/specialty-shape'

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

/* 플랜 이름·설명과 유형별 프리미엄 스위치 — 의뢰 유형 넷 × 기본·프리미엄(036_plan_copy_premium.sql).
   모든 디자이너에게 같은 문구로 나가므로 고치면 공개 상세를 통째로 되살린다.
   받은 것을 모두 한 번에 upsert 한다 — 여덟 줄이라 바뀐 것만 고를 이유가 없다.
   프리미엄을 꺼도 디자이너별 설정·금액은 지우지 않는다 — 다시 켜면 그대로 돌아온다. */
export async function updatePlanCopies(input: PlanCopies): Promise<Result> {
  const db = await guard()

  const rows: {
    plan: Scope
    tier: PlanTier
    name: string
    description: string
    enabled: boolean
    duration: string
    visible: boolean
  }[] = []
  for (const plan of SCOPES) {
    for (const tier of PLAN_TIERS) {
      const t = input[plan]?.[tier]
      const name = (t?.name ?? '').trim()
      const description = (t?.desc ?? '').trim()

      /* 이름이 비면 공개 화면의 플랜 제목이 사라진다 — 설명과 달리 비울 수 없다 */
      if (!name) return fail('플랜 이름을 모두 입력해 주세요.')
      if (name.length > MAX_PLAN_NAME) {
        return fail(`플랜 이름은 ${MAX_PLAN_NAME}자 이내로 입력해 주세요.`)
      }
      if (description.length > MAX_PLAN_DESC) {
        return fail(`설명은 ${MAX_PLAN_DESC}자 이내로 입력해 주세요.`)
      }
      const duration = (t?.duration ?? '').trim()
      if (duration.length > MAX_PLAN_DURATION) {
        return fail(`작업 기간은 ${MAX_PLAN_DURATION}자 이내로 입력해 주세요.`)
      }
      /* 기본 줄은 늘 쓴다 — 스위치는 프리미엄 줄에만 뜻이 있다 */
      const enabled = tier === 'premium' ? input[plan].premium.enabled === true : true
      /* 노출은 기본 줄에만 둔다 — 플랜을 숨기면 프리미엄도 함께 빠진다 */
      const visible = tier === 'basic' ? input[plan].visible !== false : true
      rows.push({ plan, tier, name, description, enabled, duration, visible })
    }
  }

  const { error } = await db.from('plan_copy').upsert(rows, { onConflict: 'plan,tier' })

  if (error) {
    console.error('[settings] 플랜 문구 수정 실패:', error.message)
    if (/plan_copy|enabled|duration|visible/.test(error.message)) {
      return fail(
        '플랜 문구 표가 아직 없거나 옛 판입니다. 036·037·038 마이그레이션을 먼저 적용해 주세요.',
      )
    }
    return fail('저장에 실패했습니다.')
  }

  revalidatePath('/admin/settings')
  revalidatePath('/studio')
  /* 모든 디자이너의 공개 상세에 같은 문구가 실려 있다 */
  revalidatePath('/designers', 'layout')
  /* 프리미엄을 켜고 끄면 디자이너 화면의 프리미엄 칸이 열리고 닫힌다 */
  revalidatePath('/admin/designers', 'layout')
  revalidatePath('/explore')
  /* 숨긴 플랜은 네비바의 의뢰 폼에서도 빠진다 */
  revalidatePath('/', 'layout')

  return { ok: true }
}

/* 작업 기간 노출 — 끄면 넣어 둔 기간이 공개 화면에 모두 나가지 않는다 */
export async function setShowDuration(on: boolean): Promise<Result> {
  const db = await guard()

  const { error } = await db.from('site_settings').update({ show_duration: on }).eq('id', true)
  if (error) {
    console.error('[settings] 작업 기간 노출 변경 실패:', error.message)
    if (error.message.includes('show_duration')) {
      return fail('작업 기간 칸이 아직 없습니다. 037_plan_details.sql 을 먼저 적용해 주세요.')
    }
    return fail('변경에 실패했습니다.')
  }

  revalidatePath('/admin/settings')
  revalidatePath('/designers', 'layout')
  return { ok: true }
}

/* 탐색에서 의뢰유형을 묻는지 — 끄면 묻는 창과 제목 옆 표시가 모두 빠진다 */
export async function setScopePrompt(enabled: boolean): Promise<Result> {
  const db = await guard()

  const { error } = await db
    .from('site_settings')
    .update({ scope_prompt: enabled })
    .eq('id', true)

  if (error) {
    console.error('[settings] 의뢰유형 묻기 변경 실패:', error.message)
    return fail('변경에 실패했습니다.')
  }

  revalidatePath('/admin/settings')
  revalidatePath('/explore')
  return { ok: true }
}

/* 탐색 제목 아래 문구 — 분야별(specialties.description)·전체(site_settings.explore_desc).
   0002_specialty_description.sql 의 check 제약과 같은 길이다. */
const MAX_EXPLORE_DESC = 200

function cleanDesc(text: string): string | null {
  const clean = text.trim()
  return clean.length > MAX_EXPLORE_DESC ? null : clean
}

function descFail(message: string, what: string) {
  console.error(`[settings] ${what} 변경 실패:`, message)
  return fail(
    /description|explore_desc/.test(message)
      ? '0002_specialty_description.sql 을 먼저 실행해 주세요.'
      : '저장에 실패했습니다.',
  )
}

/* '전체'일 때 문구 */
export async function setExploreDesc(text: string): Promise<Result> {
  const db = await guard()

  const clean = cleanDesc(text)
  if (clean == null) return fail(`문구는 ${MAX_EXPLORE_DESC}자 이내로 입력해 주세요.`)

  const { error } = await db.from('site_settings').update({ explore_desc: clean }).eq('id', true)
  if (error) return descFail(error.message, '탐색 문구')

  revalidatePath('/admin/settings')
  revalidatePath('/explore')
  return { ok: true }
}

/* ─────────── 전문 분야 ───────────

   탐색 사이드바의 필터이자 디자이너가 고르는 선택지다(011_specialties.sql).
   designers.tags 가 이 이름을 그대로 담으므로, 이름을 바꾸면 쓰던
   디자이너의 tags 도 함께 고쳐야 한다. */

function refreshSpecialties() {
  revalidatePath('/admin/settings')
  revalidatePath('/explore')
  revalidatePath('/studio')
}

export async function addSpecialty(name: string): Promise<Result> {
  const db = await guard()

  const clean = name.trim()
  if (!clean) return fail('분야 이름을 입력해 주세요.')
  if (clean.length > 40) return fail('분야 이름은 40자 이내로 입력해 주세요.')

  /* 맨 뒤에 세운다 — 기존 순서를 흔들지 않는다 */
  const { data: last } = await db
    .from('specialties')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  const next = ((last?.sort_order as number) ?? -1) + 1

  const { error } = await db.from('specialties').insert({ name: clean, sort_order: next })

  if (error) {
    /* unique 제약에 걸린 경우가 가장 흔하다 */
    if (/duplicate|unique/i.test(error.message)) return fail('이미 있는 분야입니다.')
    console.error('[specialties] 추가 실패:', error.message)
    return fail('추가에 실패했습니다.')
  }

  refreshSpecialties()
  return { ok: true }
}

/* 이름 바꾸기 — 이 분야를 고른 디자이너의 tags 도 함께 고친다.

   한쪽만 바꾸면 디자이너의 tags 에 목록에 없는 이름이 남아, 탐색에서
   그 디자이너가 어느 필터에도 걸리지 않는다. 트랜잭션으로 묶을 수단이
   없으므로 분야를 먼저 바꾸고 tags 를 따라 고친다 — 중간에 실패하면
   목록에는 새 이름, 디자이너에게는 옛 이름이 남아 화면에서 드러난다. */
export async function renameSpecialty(id: string, name: string): Promise<Result> {
  const db = await guard()

  const clean = name.trim()
  if (!clean) return fail('분야 이름을 입력해 주세요.')
  if (clean.length > 40) return fail('분야 이름은 40자 이내로 입력해 주세요.')

  const { data: before, error: readErr } = await db
    .from('specialties')
    .select('name')
    .eq('id', id)
    .maybeSingle()

  if (readErr || !before) return fail('분야를 찾을 수 없습니다.')

  const old = before.name as string
  if (old === clean) return { ok: true }

  const { error } = await db.from('specialties').update({ name: clean }).eq('id', id)

  if (error) {
    if (/duplicate|unique/i.test(error.message)) return fail('이미 있는 분야입니다.')
    console.error('[specialties] 이름 변경 실패:', error.message)
    return fail('변경에 실패했습니다.')
  }

  /* 옛 이름을 쓰던 디자이너를 모두 찾아 새 이름으로 갈아끼운다.
     Postgres 배열 치환 함수가 있지만 supabase-js 로는 부르기 번거로워
     읽고 고쳐 쓴다 — 분야 하나를 쓰는 디자이너는 많아야 수백이다. */
  const { data: users, error: usersErr } = await db
    .from('designers')
    .select('id, tags')
    .contains('tags', [old])

  if (usersErr) {
    console.error('[specialties] 사용 디자이너 조회 실패:', usersErr.message)
    return fail('이름은 바꿨지만 디자이너 쪽 반영에 실패했습니다. 다시 시도해 주세요.')
  }

  const rows = (users ?? []) as { id: string; tags: string[] }[]
  const results = await Promise.all(
    rows.map((d) =>
      db
        .from('designers')
        .update({ tags: (d.tags ?? []).map((t) => (t === old ? clean : t)) })
        .eq('id', d.id),
    ),
  )

  const failedOne = results.find((r) => r.error)
  if (failedOne?.error) {
    console.error('[specialties] 디자이너 태그 반영 실패:', failedOne.error.message)
    return fail('이름은 바꿨지만 일부 디자이너에 반영되지 않았습니다. 다시 시도해 주세요.')
  }

  refreshSpecialties()
  return { ok: true }
}

/* 켜고 끄기 — 끄면 탐색 사이드바에서만 빠진다. 디자이너는 계속 고를 수 있고
   프로필에도 나간다. 이미 고른 디자이너의 tags 는 건드리지 않는다. */
export async function setSpecialtyVisible(id: string, visible: boolean): Promise<Result> {
  const db = await guard()

  const { error } = await db.from('specialties').update({ visible }).eq('id', id)
  if (error) {
    console.error('[specialties] 노출 변경 실패:', error.message)
    return fail('변경에 실패했습니다.')
  }

  refreshSpecialties()
  return { ok: true }
}

/* 분야를 고르면 탐색 제목 아래에 나가는 문구 — 비우면 나가지 않는다 */
export async function setSpecialtyDescription(id: string, text: string): Promise<Result> {
  const db = await guard()

  const clean = cleanDesc(text)
  if (clean == null) return fail(`문구는 ${MAX_EXPLORE_DESC}자 이내로 입력해 주세요.`)

  const { error } = await db.from('specialties').update({ description: clean }).eq('id', id)
  if (error) return descFail(error.message, '분야 문구')

  refreshSpecialties()
  return { ok: true }
}

/* 분야의 범위 × 단계 한 칸(0011) — 시작가와 노출을 바꾼다. 주지 않은 값은 그대로 둔다.
   시작가 null 이면 디자이너 가격을 쓴다. 기본 단계는 끌 수 없다 — 범위를 닫으려면 의뢰 범위를 바꾼다.
   본 계약 시작가와 같은 범위로 막는다(isContractPrice) */
export async function setSpecialtyPrice(
  id: string,
  scope: PriceScope,
  tier: PriceTier,
  patch: { price?: number | null; enabled?: boolean },
): Promise<Result> {
  const db = await guard()

  if (!(PRICE_SCOPES as readonly string[]).includes(scope)) return fail('알 수 없는 의뢰 범위입니다.')
  if (!(PRICE_TIERS as readonly string[]).includes(tier)) return fail('알 수 없는 단계입니다.')
  if (patch.price != null && !isContractPrice(patch.price)) {
    return fail('시작가는 10,000원 이상 1억 원 이하로 입력해 주세요.')
  }
  if (tier === 'basic' && patch.enabled === false) return fail('기본 단계는 끌 수 없습니다.')

  const missing = (msg: string) =>
    /specialty_plan_prices/i.test(msg)
      ? fail('0011_specialty_scope_prices.sql 을 먼저 실행해 주세요.')
      : fail('변경에 실패했습니다.')

  /* 한 칸만 바꿔도 줄 전체를 쓰므로 지금 값을 먼저 읽는다 */
  const cur = await db
    .from('specialty_plan_prices')
    .select('enabled, price')
    .eq('specialty_id', id)
    .eq('scope', scope)
    .eq('tier', tier)
    .maybeSingle()
  if (cur.error) {
    console.error('[specialties] 시작가 조회 실패:', cur.error.message)
    return missing(cur.error.message)
  }

  const { error } = await db.from('specialty_plan_prices').upsert({
    specialty_id: id,
    scope,
    tier,
    enabled: patch.enabled ?? cur.data?.enabled ?? true,
    price: patch.price !== undefined ? patch.price : (cur.data?.price ?? null),
  })
  if (error) {
    console.error('[specialties] 시작가 변경 실패:', error.message)
    return missing(error.message)
  }

  refreshSpecialties()
  revalidatePath('/designers/[id]', 'page')
  return { ok: true }
}

/* 의뢰 범위 — choice 일 때만 탐색 제목 옆에 디자인/디자인+개발 필터가 나온다
   (039_specialty_scope_mode.sql). 디자이너 tags 는 건드리지 않는다. */
export async function setSpecialtyScopeMode(id: string, mode: SpecialtyScopeMode): Promise<Result> {
  const db = await guard()

  if (!isSpecialtyScopeMode(mode)) return fail('알 수 없는 의뢰 범위입니다.')

  const { error } = await db.from('specialties').update({ scope_mode: mode }).eq('id', id)
  if (error) {
    console.error('[specialties] 의뢰 범위 변경 실패:', error.message)
    return fail(
      error.message.includes('scope_mode')
        ? '039_specialty_scope_mode.sql 을 먼저 실행해 주세요.'
        : '변경에 실패했습니다.',
    )
  }

  refreshSpecialties()
  return { ok: true }
}

/* 메인 시안 우선 의뢰 허용(039) — 켜면 이 분야를 고른 디자이너가 스튜디오에서
   메인 시안 의뢰를 받을지 고를 수 있다. 끄면 그 디자이너들의 메인 시안 의뢰가
   공개 화면에서 빠진다. 디자이너가 켜 둔 값(scope_sample)은 지우지 않는다. */
export async function setSpecialtyAllowSample(id: string, allow: boolean): Promise<Result> {
  const db = await guard()

  const { error } = await db.from('specialties').update({ allow_sample: allow }).eq('id', id)
  if (error) {
    console.error('[specialties] 메인 시안 허용 변경 실패:', error.message)
    return fail(
      error.message.includes('allow_sample')
        ? '039_specialty_scope_mode.sql 을 먼저 실행해 주세요.'
        : '변경에 실패했습니다.',
    )
  }

  refreshSpecialties()
  revalidatePath('/designers/[id]', 'page')
  return { ok: true }
}

/* 순서 바꾸기 — 받은 차례대로 0번부터 다시 매긴다.
   포트폴리오 순서(adminReorderWorks)와 같은 방침이다. */
export async function reorderSpecialties(ids: string[]): Promise<Result> {
  const db = await guard()

  if (ids.length === 0) return { ok: true }

  const { data: all, error: readErr } = await db.from('specialties').select('id')
  if (readErr) {
    console.error('[specialties] 순서 변경용 조회 실패:', readErr.message)
    return fail('순서를 바꾸지 못했습니다.')
  }

  const known = new Set((all ?? []).map((s) => s.id as string))
  const clean = ids.filter((id) => known.has(id))

  /* 화면이 가진 목록과 DB 가 어긋나면 섣불리 쓰지 않는다 —
     빠진 분야가 0번으로 몰려 순서가 뒤엉킨다 */
  if (clean.length !== known.size) {
    return fail('목록이 바뀌었습니다. 새로고침 후 다시 시도해 주세요.')
  }

  const results = await Promise.all(
    clean.map((id, i) => db.from('specialties').update({ sort_order: i }).eq('id', id)),
  )

  const failedOne = results.find((r) => r.error)
  if (failedOne?.error) {
    console.error('[specialties] 순서 변경 실패:', failedOne.error.message)
    return fail('순서를 바꾸지 못했습니다.')
  }

  refreshSpecialties()
  return { ok: true }
}

/* 지우기 — 이 분야를 고른 디자이너의 tags 에서 먼저 빼고 지운다.

   쓰는 디자이너가 있으면 숨긴 분야만 지울 수 있다 — 노출 중인 분야를 한 번에
   지워 디자이너 프로필에서 빠지는 실수를 막는다. 아무도 안 쓰면 바로 지운다.

   분야만 지우면 디자이너의 tags 에 목록에 없는 이름이 남아, 어느 필터에도
   걸리지 않으면서 프로필에는 보이는 상태가 된다. 그래서 tags 를 먼저 고친다 —
   중간에 실패하면 분야가 남아 있으니 다시 누르면 이어서 지워진다. */
export async function deleteSpecialty(id: string): Promise<Result> {
  const db = await guard()

  const { data: s, error: readErr } = await db
    .from('specialties')
    .select('name, visible')
    .eq('id', id)
    .maybeSingle()

  if (readErr || !s) return fail('분야를 찾을 수 없습니다.')

  const name = s.name as string

  /* renameSpecialty 와 같은 방식 — 읽고 고쳐 쓴다 */
  const { data: users, error: usersErr } = await db
    .from('designers')
    .select('id, tags')
    .contains('tags', [name])

  if (usersErr) {
    console.error('[specialties] 사용 디자이너 조회 실패:', usersErr.message)
    return fail('삭제에 실패했습니다.')
  }

  const rows = (users ?? []) as { id: string; tags: string[] }[]
  if (rows.length > 0 && s.visible) {
    return fail(`${rows.length}명이 쓰고 있습니다. 먼저 숨김으로 바꾼 뒤 지워 주세요.`)
  }

  const results = await Promise.all(
    rows.map((d) =>
      db
        .from('designers')
        .update({ tags: (d.tags ?? []).filter((t) => t !== name) })
        .eq('id', d.id),
    ),
  )

  const failedOne = results.find((r) => r.error)
  if (failedOne?.error) {
    console.error('[specialties] 디자이너 태그 해제 실패:', failedOne.error.message)
    return fail('일부 디자이너에서 분야를 빼지 못했습니다. 다시 시도해 주세요.')
  }

  const { error } = await db.from('specialties').delete().eq('id', id)
  if (error) {
    console.error('[specialties] 삭제 실패:', error.message)
    return fail('삭제에 실패했습니다.')
  }

  refreshSpecialties()
  return { ok: true }
}

/* ─────────── 포함 항목 템플릿 ───────────

   어드민은 문장만 만든다('수정 {n}회'). 숫자는 디자이너가 플랜마다 등록할 때 넣는다
   (037_plan_details.sql). targets 가 null 이면 모든 플랜에서 고를 수 있다. */

function cleanTemplate(input: { template: string; targets: PlanSlot[] | null }) {
  const template = input.template.trim()
  if (!template) return { error: '문장을 입력해 주세요.' } as const
  if (template.length > MAX_OPTION_TEMPLATE) {
    return { error: `문장은 ${MAX_OPTION_TEMPLATE}자 이내로 입력해 주세요.` } as const
  }
  /* 정해진 칸만 받는다. 하나도 고르지 않았으면 어디에도 안 나가므로 막는다 */
  const targets = input.targets == null ? null : input.targets.filter((t) => PLAN_SLOTS.includes(t))
  if (targets && targets.length === 0) return { error: '노출할 플랜을 하나 이상 골라 주세요.' } as const
  return { template, targets } as const
}

function refreshTemplates() {
  revalidatePath('/admin/settings')
  revalidatePath('/admin/designers', 'layout')
  revalidatePath('/studio')
  revalidatePath('/designers', 'layout')
}

/* designerId 를 주면 그 디자이너 전용 — 어드민만 만들고, 그 디자이너만 고른다 */
export async function createOptionTemplate(input: {
  template: string
  targets: PlanSlot[] | null
  designerId?: string | null
}): Promise<Result> {
  const db = await guard()
  const c = cleanTemplate(input)
  if ('error' in c) return fail(c.error!)

  const designerId = input.designerId || null

  /* 맨 뒤에 세운다 — 공통과 전용은 차례를 따로 센다 */
  const base = db.from('option_templates').select('sort_order')
  const { data: last } = await (designerId ? base.eq('designer_id', designerId) : base.is('designer_id', null))
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { error } = await db.from('option_templates').insert({
    template: c.template,
    targets: c.targets,
    designer_id: designerId,
    sort_order: ((last?.sort_order as number) ?? -1) + 1,
  })
  if (error) {
    if (/duplicate|unique/i.test(error.message)) return fail('같은 문장이 이미 있습니다.')
    console.error('[settings] 템플릿 추가 실패:', error.message)
    if (error.message.includes('option_templates')) {
      return fail('템플릿 표가 아직 없습니다. 037_plan_details.sql 을 먼저 적용해 주세요.')
    }
    return fail('추가에 실패했습니다.')
  }

  refreshTemplates()
  return { ok: true }
}

/* 문장을 고치면 이미 등록한 디자이너에게도 바뀐 문장이 나간다.
   노출 플랜에서 빠진 곳은 등록돼 있어도 나가지 않는다(지우지는 않는다 — 다시 넣으면 돌아온다). */
export async function updateOptionTemplate(
  id: string,
  input: { template: string; targets: PlanSlot[] | null },
): Promise<Result> {
  const db = await guard()
  const c = cleanTemplate(input)
  if ('error' in c) return fail(c.error!)

  const { error } = await db
    .from('option_templates')
    .update({ template: c.template, targets: c.targets })
    .eq('id', id)
  if (error) {
    if (/duplicate|unique/i.test(error.message)) return fail('같은 문장이 이미 있습니다.')
    console.error('[settings] 템플릿 수정 실패:', error.message)
    return fail('수정에 실패했습니다.')
  }

  refreshTemplates()
  return { ok: true }
}

/* 지우면 디자이너들이 등록한 것도 함께 지워진다(on delete cascade) */
export async function deleteOptionTemplate(id: string): Promise<Result> {
  const db = await guard()

  const { error } = await db.from('option_templates').delete().eq('id', id)
  if (error) {
    console.error('[settings] 템플릿 삭제 실패:', error.message)
    return fail('삭제에 실패했습니다.')
  }

  refreshTemplates()
  return { ok: true }
}
