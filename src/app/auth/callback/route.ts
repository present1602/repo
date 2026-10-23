import { NextResponse } from 'next/server'
import { createClient, isAllowed } from '@/lib/admin-auth'

/* 구글 로그인 후 돌아오는 지점.
   코드를 세션으로 바꾸고, 허용된 계정인지 한 번 더 확인한다. */
export async function GET(req: Request) {
  const { searchParams, origin } = new URL(req.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/admin'

  if (!code) {
    return NextResponse.redirect(`${origin}/admin/login?error=no_code`)
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error || !data.user) {
    return NextResponse.redirect(`${origin}/admin/login?error=auth_failed`)
  }

  /* 구글 로그인은 됐지만 허용 목록에 없는 계정이면 바로 내보낸다 */
  if (!isAllowed(data.user.email)) {
    await supabase.auth.signOut()
    return NextResponse.redirect(`${origin}/admin/login?error=not_allowed`)
  }

  return NextResponse.redirect(`${origin}${next}`)
}
