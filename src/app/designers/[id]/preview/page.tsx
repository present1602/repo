import { Suspense } from 'react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getAdminUser } from '@/lib/admin-auth'
import { getDesignerForPreview } from '@/lib/public-designers'
import { DesignerView, DetailSkeleton } from '@/components/designer-view'

/* 어드민 전용 상세 미리보기 — 공개 페이지와 같은 화면을 공개 여부와 상관없이 본다.
   어드민 사이드바 없이 실제 사이트 껍데기 안에서 그려야 "실제로 이렇게 보인다"가
   맞는 말이 되므로 /admin 아래가 아니라 여기 둔다. 어드민이 아니면 없는 페이지다. */
export const metadata: Metadata = {
  title: '상세 페이지 미리보기 · SOOM',
  robots: { index: false, follow: false },
}

export default function DesignerPreviewPage(props: PageProps<'/designers/[id]/preview'>) {
  return (
    <Suspense fallback={<DetailSkeleton />}>
      <PreviewContent params={props.params} />
    </Suspense>
  )
}

async function PreviewContent({ params }: { params: PageProps<'/designers/[id]/preview'>['params'] }) {
  if (!(await getAdminUser())) notFound()
  const { id } = await params
  const d = await getDesignerForPreview(id)
  if (!d) notFound()
  return (
    <>
      <p className="bg-amber-50 px-5 py-2.5 text-center text-xs font-medium text-amber-800">
        어드민 미리보기입니다 — 공개 여부와 상관없이 보입니다. 숨긴 작업은 실제처럼 빠져 있습니다.
      </p>
      <DesignerView d={d} preview />
    </>
  )
}
