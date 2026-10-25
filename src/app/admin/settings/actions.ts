'use server'

import { revalidatePath } from 'next/cache'
import { getAdminUser } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { MAX_PLAN_DESC } from '@/lib/plans'

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

export type PlanCopyInput = {
  designName: string
  designDesc: string
  premiumName: string
  premiumDesc: string
}

/* 플랜 이름·설명은 모든 디자이너에게 같은 문구로 나간다.
   고치면 공개 상세가 전부 바뀌므로 해당 경로를 통째로 되살린다. */
export async function updatePlanCopy(input: PlanCopyInput): Promise<Result> {
  const db = await guard()

  const designName = input.designName.trim()
  const premiumName = input.premiumName.trim()
  const designDesc = input.designDesc.trim()
  const premiumDesc = input.premiumDesc.trim()

  /* 이름이 비면 공개 화면의 플랜 제목이 사라진다 — 설명과 달리 비울 수 없다 */
  if (!designName || !premiumName) {
    return fail('플랜 이름을 입력해 주세요.')
  }
  if (designDesc.length > MAX_PLAN_DESC || premiumDesc.length > MAX_PLAN_DESC) {
    return fail(`설명은 ${MAX_PLAN_DESC}자 이내로 입력해 주세요.`)
  }

  const { error } = await db
    .from('site_settings')
    .update({
      design_plan_name: designName,
      design_plan_desc: designDesc,
      premium_plan_name: premiumName,
      premium_plan_desc: premiumDesc,
    })
    .eq('id', true)

  if (error) {
    console.error('[settings] 플랜 문구 수정 실패:', error.message)
    return fail('저장에 실패했습니다.')
  }

  revalidatePath('/admin/settings')
  revalidatePath('/studio')
  /* 모든 디자이너의 공개 상세에 같은 문구가 실려 있다 */
  revalidatePath('/designers', 'layout')

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
