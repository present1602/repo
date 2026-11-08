import 'server-only'
import { supabaseAdmin } from './supabase-admin'
import type { PriceScope, PriceTier, Specialty, SpecialtyOption, SpecialtyPrices, SpecialtyScopeMode } from './specialty-shape'
import type { CategoryMeta } from './inquiry-choices'

/* 전문 분야 목록 조회(011_specialties.sql).

   탐색 사이드바의 필터와 디자이너 프로필의 선택지가 모두 이 목록을 쓴다 —
   한곳에서 읽어야 둘이 어긋나지 않는다. */

const COLS = 'id, name, sort_order, visible'
/* 039·0002·0003 전에는 없다 — 실패 메시지에 이름이 나오면 빼고 다시 묻는다(site-settings.ts 와 같은 방식) */
const OPTIONAL_COLS = ['scope_mode', 'allow_sample', 'description', 'price_from']

type Row = Omit<Specialty, 'scope_mode' | 'allow_sample' | 'description' | 'prices'> & {
  scope_mode?: SpecialtyScopeMode
  allow_sample?: boolean
  description?: string
  /* 0011 전의 한 칸 — 범위가 정해진 분야의 기본 시작가. 0011 뒤에는 specialty_plan_prices 를 읽는다 */
  price_from?: number | null
}

type PriceRow = {
  specialty_id: string
  scope: PriceScope
  tier: PriceTier
  enabled: boolean
  price: number | null
  /* 0013 전에는 없다 */
  allow_sample?: boolean
}

/* 분야별 범위·단계 시작가(0011). 표가 없으면 null — 예전 price_from 으로 대신한다 */
async function readPrices(): Promise<Map<string, SpecialtyPrices> | null> {
  const ask = (cols: string) => supabaseAdmin!.from('specialty_plan_prices').select(cols)
  let { data, error } = await ask('specialty_id, scope, tier, enabled, price, allow_sample')
  /* 0013 전이면 allow_sample 칸이 없다 — 빼고 다시 묻는다(모두 켜짐으로 읽힌다) */
  if (error?.message.includes('allow_sample')) {
    ;({ data, error } = await ask('specialty_id, scope, tier, enabled, price'))
  }
  if (error) {
    if (!/specialty_plan_prices/i.test(error.message)) {
      console.error('[specialties] 시작가 조회 실패:', error.message)
    }
    return null
  }
  const map = new Map<string, SpecialtyPrices>()
  for (const r of (data ?? []) as unknown as PriceRow[]) {
    const p = map.get(r.specialty_id) ?? {}
    p[r.scope] = {
      ...p[r.scope],
      [r.tier]: { enabled: r.enabled, price: r.price, allowSample: r.allow_sample ?? true },
    }
    map.set(r.specialty_id, p)
  }
  return map
}

/* 화면에 내보낼 순서로 정렬한다 — sort_order 가 같으면 이름순(한글 기준).
   Postgres 의 정렬은 로케일 설정에 기대므로 코드에서 맞춘다. */
function byOrder(a: Specialty, b: Specialty) {
  if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order
  return a.name.localeCompare(b.name, 'ko')
}

/* 분야 줄을 읽는다. 039 전이면 scope_mode 는 choice(지금까지 그랬다),
   allow_sample 은 꺼진 것으로, 0002 전이면 description 은 빈 글자로 채운다. */
async function readSpecialties(visibleOnly: boolean) {
  const db = supabaseAdmin!
  const ask = (cols: string[]) => {
    const q = db.from('specialties').select([COLS, ...cols].join(', '))
    return visibleOnly ? q.eq('visible', true) : q
  }

  let cols = OPTIONAL_COLS
  const pricesP = readPrices()
  let r = await ask(cols)
  for (const c of OPTIONAL_COLS) {
    if (!r.error?.message.includes(c)) continue
    cols = cols.filter((x) => x !== c)
    r = await ask(cols)
  }

  if (r.error) {
    /* 마이그레이션 전이면 테이블이 없다 — 조용히 비워 돌려준다 */
    if (!/specialties/i.test(r.error.message)) {
      console.error('[specialties] 조회 실패:', r.error.message)
    }
    return null
  }

  const prices = await pricesP
  return ((r.data ?? []) as unknown as Row[])
    .map(({ price_from, ...s }): Specialty => {
      const mode = s.scope_mode ?? 'choice'
      return {
        ...s,
        scope_mode: mode,
        allow_sample: s.allow_sample ?? false,
        description: s.description ?? '',
        /* 0011 전이면 예전 한 칸(price_from)을 그 분야 범위의 기본 단계로 읽는다 */
        prices:
          prices?.get(s.id) ??
          (prices == null && price_from != null && mode !== 'choice'
            ? { [mode]: { basic: { enabled: true, price: price_from, allowSample: true } } }
            : {}),
      }
    })
    .sort(byOrder)
}

/* 메인 시안 우선 의뢰를 허용한 분야 이름(039). 디자이너가 이 중 하나를 골라야
   scope_sample 을 켤 수 있고 공개 화면에도 나간다.

   숨긴 분야도 넣는다 — 필터에서 뺐다고 그 분야 디자이너의 메인 시안까지 끊기면 과하다.
   039 전이면 null — 거르지 않는다(지금까지처럼 디자이너 스위치만 본다). */
export async function listSampleSpecialties(): Promise<string[] | null> {
  if (!supabaseAdmin) return null

  const { data, error } = await supabaseAdmin
    .from('specialties')
    .select('name')
    .eq('allow_sample', true)

  if (error) {
    if (!/specialties|allow_sample/i.test(error.message)) {
      console.error('[specialties] 메인 시안 허용 분야 조회 실패:', error.message)
    }
    return null
  }

  return (data ?? []).map((s) => s.name as string)
}

/* 공개 화면용 — 켜 둔 분야의 이름만.

   011 을 아직 돌리지 않았으면 빈 배열을 돌려준다. 호출부가 그때는
   지금까지처럼 디자이너 태그를 모아 쓰므로 화면이 비지 않는다. */
export async function listVisibleSpecialties(): Promise<string[]> {
  if (!supabaseAdmin) return []
  return (await readSpecialties(true))?.map((s) => s.name) ?? []
}

/* 디자이너가 고르는 선택지 — 숨긴 분야까지 전부, 차례대로.
   숨김은 탐색 사이드바에서만 빼는 것이라 디자이너는 계속 고를 수 있고 프로필에도 나간다. */
export async function listSpecialtyNames(): Promise<string[]> {
  if (!supabaseAdmin) return []
  return (await readSpecialties(false))?.map((s) => s.name) ?? []
}

/* 선택 화면용 — 숨긴 분야까지 전부. 메뉴에 나오는(visible) 분야를 앞에 세운다 —
   디자이너가 탐색에서 찾히는 분야를 먼저 보고 고르게. 각각 안에서는 설정 차례대로. */
export async function listSpecialtyOptions(): Promise<SpecialtyOption[]> {
  if (!supabaseAdmin) return []
  const list = (await readSpecialties(false)) ?? []
  return [...list.filter((s) => s.visible), ...list.filter((s) => !s.visible)].map((s) => ({
    name: s.name,
    visible: s.visible,
  }))
}

/* 의뢰 폼용 — 숨긴 분야까지 전부, 설정 차례대로(inquiry-choices.ts).
   일반 폼은 이 중 노출 분야만, 디자이너 폼은 그 디자이너가 고른 분야만 쓴다. */
export async function listCategoryMetas(): Promise<CategoryMeta[]> {
  if (!supabaseAdmin) return []
  return (
    (await readSpecialties(false))?.map((s) => ({
      id: s.id,
      name: s.name,
      visible: s.visible,
      scope_mode: s.scope_mode,
      allow_sample: s.allow_sample,
      prices: s.prices,
    })) ?? []
  )
}

/* 탐색용 — 켜 둔 분야의 이름·의뢰 범위(039)·제목 아래 문구(0002), 차례대로 */
export async function listExploreSpecialties(): Promise<
  { name: string; scope_mode: SpecialtyScopeMode; description: string }[]
> {
  if (!supabaseAdmin) return []
  return (
    (await readSpecialties(true))?.map((s) => ({
      name: s.name,
      scope_mode: s.scope_mode,
      description: s.description,
    })) ?? []
  )
}

/* 어드민용 — 꺼 둔 것까지 전부. 각 분야를 쓰는 디자이너 수를 함께 센다.

   끄거나 이름을 바꾸기 전에 "몇 명이 쓰고 있는지" 보여줘야 한다 —
   모르고 끄면 그 분야로 걸러지던 디자이너들이 탐색에서 사라진다. */
export async function listAllSpecialties(): Promise<Specialty[]> {
  if (!supabaseAdmin) return []

  const [list, designers] = await Promise.all([
    readSpecialties(false),
    supabaseAdmin.from('designers').select('tags'),
  ])

  if (!list) return []

  /* 디자이너 쪽을 못 읽어도 목록은 보여준다 — 쓰임 수만 비운다 */
  const used = new Map<string, number>()
  if (!designers.error) {
    for (const d of (designers.data ?? []) as { tags: string[] }[]) {
      for (const t of d.tags ?? []) used.set(t, (used.get(t) ?? 0) + 1)
    }
  }

  return list.map((s) => ({ ...s, used: used.get(s.name) ?? 0 }))
}
