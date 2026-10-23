import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { connection } from 'next/server'

/* 관리 페이지에 들어올 수 있는 구글 계정.
   쉼표로 구분해 환경변수에 둔다. 비어 있으면 아무도 못 들어온다. */
export function allowedEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
}

export function isAllowed(email: string | undefined | null) {
  if (!email) return false
  const list = allowedEmails()
  return list.length > 0 && list.includes(email.toLowerCase())
}

export const authConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
)

/* 서버 컴포넌트·라우트에서 쓰는 클라이언트.
   anon 키를 쓰므로 RLS가 적용된다 — 데이터 조회는 service_role 쪽에서 따로 한다. */
export async function createClient() {
  if (!authConfigured) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL 과 NEXT_PUBLIC_SUPABASE_ANON_KEY 가 설정되지 않았습니다.',
    )
  }
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (list) => {
          try {
            list.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
          } catch {
            /* 서버 컴포넌트에서는 쿠키를 쓸 수 없다. proxy 가 갱신을 맡는다. */
          }
        },
      },
    },
  )
}

/* 로그인 + 허용 목록을 모두 통과한 사용자만 돌려준다.
   설정이 없거나 조회에 실패하면 null — 즉 접근 거부로 처리된다. */
export async function getAdminUser() {
  if (!authConfigured) return null

  /* Supabase auth-js 는 토큰 만료를 재려고 Date.now() 를 쓴다.
     프리렌더 중에는 그 값이 불안정해 Cache Components 가 막으므로,
     요청이 들어온 뒤부터 실행하도록 여기서 끊는다. */
  await connection()

  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user || !isAllowed(user.email)) return null
    return user
  } catch {
    return null
  }
}
