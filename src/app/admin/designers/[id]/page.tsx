import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getAdminUser } from '@/lib/admin-auth'
import { getDesignerById, listWorks } from '@/lib/designers-db'
import { getDesignerCardPreview } from '@/lib/public-designers'
import { listVisibleSpecialties } from '@/lib/specialties'
import { getDesignerPremiums, getPlanCopies } from '@/lib/site-settings'
import { SCOPES } from '@/lib/scopes'
import { displayName } from '@/lib/display-name'
import { DesignerDetail } from '@/components/admin/designer-detail'
import { isDesignerTab } from '@/components/admin/designer-tabs'
import { AdminPortfolio } from '@/components/admin/admin-portfolio'

export const instant = false

export async function generateMetadata(
  props: PageProps<'/admin/designers/[id]'>,
): Promise<Metadata> {
  const { id } = await props.params
  const d = await getDesignerById(id)
  return {
    title: d ? `${displayName(d)} · 디자이너 관리` : '디자이너를 찾을 수 없습니다',
    robots: { index: false, follow: false },
  }
}

export default async function DesignerDetailPage(props: PageProps<'/admin/designers/[id]'>) {
  const user = await getAdminUser()
  if (!user) redirect('/admin/login')

  const { id } = await props.params
  const designer = await getDesignerById(id)
  if (!designer) notFound()

  /* 탭은 주소로 — 저장 뒤 새로 그려도, 새로고침해도 같은 탭에 머문다 */
  const { tab: rawTab } = await props.searchParams
  const tab = isDesignerTab(rawTab) ? rawTab : 'profile'

  /* 포트폴리오·목록 미리보기·분야 목록은 서로 기다릴 이유가 없다 */
  const [works, cardPreview, specialties, premiums, copies] = await Promise.all([
    listWorks(id),
    getDesignerCardPreview(id),
    listVisibleSpecialties(),
    getDesignerPremiums(id),
    getPlanCopies(),
  ])

  /* 설정에서 프리미엄을 켠 유형 — 켜진 유형만 디자이너별로 켤 수 있다 */
  const premiumOn = Object.fromEntries(SCOPES.map((s) => [s, copies[s].premium.enabled])) as Record<
    (typeof SCOPES)[number],
    boolean
  >

  /* 비밀번호 해시는 화면으로 내려보내지 않는다 */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password_hash, ...safe } = designer

  return (
    <main className="min-w-0 flex-1 px-5 py-6 md:px-8">
      <nav className="mb-5 text-sm">
        <Link href="/admin/designers" className="text-neutral-500 transition hover:text-neutral-900">
          ← 디자이너 목록
        </Link>
      </nav>

      {/* 프로필 · 포트폴리오 · 설정 탭. 포트폴리오는 서버에서 그린 것을 끼워 넣는다.
          key 로 탭마다 새로 그린다 — 앞 탭의 알림 문구가 다음 탭에 남지 않게 */}
      <DesignerDetail
        key={tab}
        tab={tab}
        designer={safe}
        cardPreview={cardPreview}
        specialties={specialties}
        premiums={premiums}
        premiumOn={premiumOn}
        portfolio={<AdminPortfolio designerId={id} works={works} />}
      />
    </main>
  )
}
