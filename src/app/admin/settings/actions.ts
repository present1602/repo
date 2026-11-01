'use server'

import { revalidatePath } from 'next/cache'
import { getAdminUser } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import {
  MAX_PLAN_DESC,
  MAX_PLAN_NAME,
  PLAN_TIERS,
  type PlanCopies,
  type PlanTier,
} from '@/lib/plans'
import { SCOPES, type Scope } from '@/lib/scopes'

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

  const rows: { plan: Scope; tier: PlanTier; name: string; description: string; enabled: boolean }[] =
    []
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
      /* 기본 줄은 늘 쓴다 — 스위치는 프리미엄 줄에만 뜻이 있다 */
      const enabled = tier === 'premium' ? input[plan].premium.enabled === true : true
      rows.push({ plan, tier, name, description, enabled })
    }
  }

  const { error } = await db.from('plan_copy').upsert(rows, { onConflict: 'plan,tier' })

  if (error) {
    console.error('[settings] 플랜 문구 수정 실패:', error.message)
    if (error.message.includes('plan_copy') || error.message.includes('enabled')) {
      return fail('플랜 문구 표가 아직 없거나 옛 판입니다. 036_plan_copy_premium.sql 을 먼저 적용해 주세요.')
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

/* 켜고 끄기 — 끄면 탐색 필터와 디자이너 선택지에서 빠진다.
   이미 고른 디자이너의 tags 는 건드리지 않는다. 다시 켜면 그대로 돌아온다. */
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

/* 지우기 — 아무도 쓰지 않는 분야만. 쓰는 디자이너가 있으면 끄기를 권한다.

   지워 버리면 그 디자이너의 tags 에 목록에 없는 이름이 남는다.
   어느 필터에도 걸리지 않으면서 프로필에는 보이는 상태가 된다. */
export async function deleteSpecialty(id: string): Promise<Result> {
  const db = await guard()

  const { data: s, error: readErr } = await db
    .from('specialties')
    .select('name')
    .eq('id', id)
    .maybeSingle()

  if (readErr || !s) return fail('분야를 찾을 수 없습니다.')

  const { count } = await db
    .from('designers')
    .select('id', { count: 'exact', head: true })
    .contains('tags', [s.name as string])

  if ((count ?? 0) > 0) {
    return fail(`${count}명이 쓰고 있어 지울 수 없습니다. 노출을 꺼 주세요.`)
  }

  const { error } = await db.from('specialties').delete().eq('id', id)
  if (error) {
    console.error('[specialties] 삭제 실패:', error.message)
    return fail('삭제에 실패했습니다.')
  }

  refreshSpecialties()
  return { ok: true }
}
