import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/* 관리 페이지 요청마다 Supabase 세션 토큰을 갱신한다.
   이게 없으면 토큰이 만료될 때 로그아웃된 것처럼 보인다.

   Next 16 에서 middleware 규약은 proxy 로 바뀌었다 — 파일명·export 이름만 다르고
   동작은 같다. */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  /* 키가 없으면 세션 갱신을 건너뛴다.
     페이지 쪽에서 로그인 안 된 것으로 보고 로그인 화면으로 보낸다. */
  if (!url || !anonKey) return response

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
      },
    },
  })

  await supabase.auth.getUser()
  return response
}

/* 디자이너 화면(/designers)은 Supabase 세션이 아니라 자체 쿠키를 쓰므로
   여기서 갱신할 것이 없다 — 각 페이지의 getDesignerUser() 가 막는다. */
export const config = {
  matcher: ['/admin/:path*', '/auth/:path*'],
}
