import type { Metadata } from 'next'
import Link from 'next/link'
import { DesignerApplyForm } from '@/components/designers/apply-form'

export const metadata: Metadata = {
  title: '디자이너 신청 · SOOM',
  description: 'SOOM 디자이너 그룹 신청',
  /* 제안서와 같이 링크를 받은 사람만 온다 */
  robots: { index: false, follow: false },
}

/* 디자이너 신청.

   디자이너 로그인 화면과 제안서(v1-4) 마지막 쪽에서 들어온다.
   접수된 신청은 어드민 '지원서' 화면에서 본다. */
export default function DesignerApplyPage() {
  return (
    <main className="flex-1 bg-white px-5 py-14 md:py-20">
      <div className="mx-auto w-full max-w-lg">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.35em] text-violet-600">
            Join SOOM
          </p>
          <h1 className="mt-3 text-2xl font-bold tracking-tight md:text-3xl">디자이너 신청</h1>
          <p className="mt-2 text-sm leading-relaxed text-neutral-500">
            이력서와 포트폴리오만 보내 주시면 검토 후 연락드립니다.
          </p>
          <Link
            href="/"
            className="mt-2 inline-block text-xs font-medium text-violet-600 transition hover:text-violet-700"
          >
            SOOM →
          </Link>
        </div>

        <div className="mt-9">
          <DesignerApplyForm />
        </div>
      </div>
    </main>
  )
}
