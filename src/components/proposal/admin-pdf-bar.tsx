import { getAdminUser } from '@/lib/admin-auth'
import { PdfExportButtons } from './pdf-export'

/* 관리자로 로그인했을 때만 제안서 맨 위에 뜨는 줄.

   제안서 바(ProposalNav)에 넣지 않는다 — 그 바는 읽는 사람을 위한 것이고
   v1 과도 함께 쓴다. 로그인 확인은 요청을 기다려야 하므로 page.tsx 에서
   Suspense 로 감싸 나머지 본문은 먼저 나가게 한다. */
export async function AdminPdfBar() {
  const user = await getAdminUser()
  if (!user) return null

  return (
    <div className="border-b border-neutral-200 bg-white print:hidden">
      <div className="mx-auto flex max-w-[110rem] py-2.5 items-center justify-end px-4 text-xs md:px-10 lg:px-16 xl:pl-16 xl:pr-28 2xl:pl-24 2xl:pr-32">
        <PdfExportButtons />
      </div>
    </div>
  )
}
