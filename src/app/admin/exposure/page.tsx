import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getAdminUser } from '@/lib/admin-auth'
import { supabaseConfigured } from '@/lib/supabase-admin'
import { listAllDesignersWithActivity } from '@/lib/designers-db'
import { listFeatureIds } from '@/lib/explore-features'
import {
  DesignerOrder,
  ExposureManager,
  type ExposureDesigner,
} from '@/components/admin/exposure-manager'

export const metadata: Metadata = {
  title: '디자이너 노출 관리',
  robots: { index: false, follow: false },
}

export const instant = false

/* 탐색 화면 위쪽에 어떤 디자이너를 어떤 모양으로 올릴지 정한다.
   여기 올리지 않은 디자이너는 기본 카드(대표 작업 한 장)로 아래에 선다. */
export default async function ExposureAdminPage() {
  const user = await getAdminUser()
  if (!user) redirect('/admin/login')

  const [designers, featureIds] = await Promise.all([
    listAllDesignersWithActivity(),
    listFeatureIds('feature1'),
  ])

  /* 고르는 다이얼로그와 목록 줄에 필요한 것만 넘긴다 */
  const all: ExposureDesigner[] = designers.map((d) => ({
    id: d.id,
    name: d.name,
    email: d.email,
    avatar_url: d.avatar_url,
    works_visible: d.activity.works_visible,
    works_total: d.activity.works_total,
    /* 계정이 닫혔거나 본인이 비공개로 두면 올려 둬도 탐색에 안 뜬다 */
    shown: d.visible && d.profile_public,
  }))

  /* 탐색 차례를 정할 대상 — 실제로 탐색에 서는 사람만.
     탐색 질의(listPublicDesigners)와 같은 차례로 세운다: 어드민이 정한
     sort_order 가 먼저, 같으면 등록 역순. 그래야 여기서 보는 차례와
     공개 화면의 차례가 어긋나지 않는다. 0026 전에는 sort_order 가
     undefined 로 와 모두 0 으로 읽히고, 등록 역순만 남는다. */
  const ordered: ExposureDesigner[] = designers
    .filter((d) => d.visible && d.profile_public)
    .sort(
      (a, b) =>
        (a.sort_order ?? 0) - (b.sort_order ?? 0) ||
        Date.parse(b.created_at) - Date.parse(a.created_at),
    )
    .map((d) => all.find((x) => x.id === d.id)!)

  return (
    <main className="min-w-0 flex-1 px-5 py-6 md:px-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">디자이너 노출 관리</h1>
        <p className="mt-1 text-sm text-neutral-500">
          탐색 화면 위쪽에 크게 올릴 디자이너를 고릅니다. 고르지 않은 디자이너는 기본 카드로
          아래에 섭니다.
        </p>
      </header>

      {!supabaseConfigured && (
        <p className="mb-6 rounded-lg bg-amber-50 px-3.5 py-3 text-sm text-amber-800">
          SUPABASE_SERVICE_ROLE_KEY 가 설정되지 않아 저장이 동작하지 않습니다.
        </p>
      )}

      <ExposureManager designers={all} featureIds={featureIds} />
      <DesignerOrder designers={ordered} />
    </main>
  )
}
