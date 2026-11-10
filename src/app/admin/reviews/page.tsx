import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getAdminUser } from '@/lib/admin-auth'
import { supabaseConfigured } from '@/lib/supabase-admin'
import { listReviews, listReviewTokens } from '@/lib/reviews-db'
import { listAllDesigners } from '@/lib/designers-db'
import { ReviewAdmin } from '@/components/admin/review-admin'

export const metadata: Metadata = {
  title: '후기',
  robots: { index: false, follow: false },
}

export const instant = false

/* 후기 관리 — 링크를 만들어 보내고, 들어온 후기를 승인한다.

   링크는 두 길로 만든다:
     문의에서   /admin/inquiries 의 '후기 요청 보내기'
     직접       여기서. 전화·메신저로 받은 의뢰는 플랫폼에 문의가 없다. */
export default async function AdminReviewsPage() {
  const user = await getAdminUser()
  if (!user) redirect('/admin/login')

  const [reviews, tokens, designers] = await Promise.all([
    listReviews(),
    listReviewTokens(),
    listAllDesigners(),
  ])

  const pending = reviews.filter((r) => r.status === 'pending').length

  const options = designers.map((d) => ({
    id: d.id,
    name: d.name,
    label: d.name?.trim() || d.email.split('@')[0],
  }))

  return (
    <main className="min-w-0 flex-1 px-5 py-6 md:px-8">
      <header className="mb-5">
        <h1 className="text-2xl font-bold tracking-tight">후기</h1>
        <p className="mt-1 text-sm text-neutral-500">
          들어온 후기 {reviews.length}건
          {pending > 0 && <span className="ml-1.5 text-violet-600">· 승인 대기 {pending}건</span>}
        </p>
      </header>

      {!supabaseConfigured && (
        <p className="mb-6 rounded-lg bg-amber-50 px-3.5 py-3 text-sm text-amber-800">
          SUPABASE_SERVICE_ROLE_KEY 가 설정되지 않아 조회가 동작하지 않습니다.
        </p>
      )}

      <ReviewAdmin reviews={reviews} tokens={tokens} designers={options} />
    </main>
  )
}
