import { getAdminUser } from '@/lib/admin-auth'
import { AdminSidebar } from '@/components/admin/sidebar'
import { SignOutButton } from '@/components/admin/sign-out-button'

/* 로그인 여부에 따라 껍데기가 통째로 달라진다 — 정적 셸을 먼저 보낼 수 없으므로
   요청을 기다리는 블로킹 라우트로 둔다. */
export const instant = false

export default async function AdminLayout({ children }: LayoutProps<'/admin'>) {
  const user = await getAdminUser()

  /* 로그인 전(로그인 화면)에는 사이드바 없이 본문만 — 메뉴를 눌러봐야 되돌려보내진다.
     루트 레이아웃이 깐 회색 배경을 흰색으로 덮는다. */
  if (!user) return <div className="flex flex-1 flex-col bg-white">{children}</div>

  return (
    <div className="flex flex-1 bg-white">
      <AdminSidebar email={user.email ?? ''} />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-12 shrink-0 items-center justify-end border-b border-neutral-200 px-5">
          <SignOutButton />
        </div>
        {children}
      </div>
    </div>
  )
}
