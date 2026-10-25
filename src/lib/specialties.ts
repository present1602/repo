import 'server-only'
import { supabaseAdmin } from './supabase-admin'
import type { Specialty } from './specialty-shape'

/* 전문 분야 목록 조회(011_specialties.sql).

   탐색 사이드바의 필터와 디자이너 프로필의 선택지가 모두 이 목록을 쓴다 —
   한곳에서 읽어야 둘이 어긋나지 않는다. */

const COLS = 'id, name, sort_order, visible'

/* 화면에 내보낼 순서로 정렬한다 — sort_order 가 같으면 이름순(한글 기준).
   Postgres 의 정렬은 로케일 설정에 기대므로 코드에서 맞춘다. */
function byOrder(a: Specialty, b: Specialty) {
  if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order
  return a.name.localeCompare(b.name, 'ko')
}

/* 공개 화면용 — 켜 둔 분야의 이름만.

   011 을 아직 돌리지 않았으면 빈 배열을 돌려준다. 호출부가 그때는
   지금까지처럼 디자이너 태그를 모아 쓰므로 화면이 비지 않는다. */
export async function listVisibleSpecialties(): Promise<string[]> {
  if (!supabaseAdmin) return []

  const { data, error } = await supabaseAdmin
    .from('specialties')
    .select(COLS)
    .eq('visible', true)

  if (error) {
    /* 마이그레이션 전이면 테이블이 없다 — 조용히 비워 돌려준다 */
    if (!/specialties/i.test(error.message)) {
      console.error('[specialties] 조회 실패:', error.message)
    }
    return []
  }

  return ((data ?? []) as Specialty[]).sort(byOrder).map((s) => s.name)
}

/* 어드민용 — 꺼 둔 것까지 전부. 각 분야를 쓰는 디자이너 수를 함께 센다.

   끄거나 이름을 바꾸기 전에 "몇 명이 쓰고 있는지" 보여줘야 한다 —
   모르고 끄면 그 분야로 걸러지던 디자이너들이 탐색에서 사라진다. */
export async function listAllSpecialties(): Promise<Specialty[]> {
  if (!supabaseAdmin) return []

  const [list, designers] = await Promise.all([
    supabaseAdmin.from('specialties').select(COLS),
    supabaseAdmin.from('designers').select('tags'),
  ])

  if (list.error) {
    if (!/specialties/i.test(list.error.message)) {
      console.error('[specialties] 조회 실패:', list.error.message)
    }
    return []
  }

  /* 디자이너 쪽을 못 읽어도 목록은 보여준다 — 쓰임 수만 비운다 */
  const used = new Map<string, number>()
  if (!designers.error) {
    for (const d of (designers.data ?? []) as { tags: string[] }[]) {
      for (const t of d.tags ?? []) used.set(t, (used.get(t) ?? 0) + 1)
    }
  }

  return ((list.data ?? []) as Specialty[])
    .map((s) => ({ ...s, used: used.get(s.name) ?? 0 }))
    .sort(byOrder)
}
