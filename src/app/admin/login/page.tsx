import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getAdminUser, authConfigured } from '@/lib/admin-auth'
import { GoogleLoginButton } from '@/components/admin/google-login-button'

export const metadata: Metadata = {
  title: '관리자 로그인 · folio',
  robots: { index: false, follow: false },
}

const MESSAGES: Record<string, string> = {
  no_code: '로그인이 완료되지 않았습니다. 다시 시도해 주세요.',
  auth_failed: '인증에 실패했습니다. 다시 시도해 주세요.',
  not_allowed: '이 계정은 접근 권한이 없습니다.',
}

export const instant = false

export default async function AdminLoginPage(props: PageProps<'/admin/login'>) {
  const user = await getAdminUser()
  if (user) redirect('/admin')

  const { error } = await props.searchParams
  const key = typeof error === 'string' ? error : null
  const message = key ? (MESSAGES[key] ?? '로그인에 실패했습니다.') : null

  return (
    <main className="grid flex-1 place-items-center px-5 py-16">
      <div className="w-full max-w-sm text-center">
        <div className="mx-auto grid size-9 place-items-center rounded-lg bg-violet-600 text-sm font-bold text-white">
          F
        </div>
        <h1 className="mt-5 text-xl font-bold tracking-tight">관리자</h1>
        <p className="mt-1.5 text-sm text-neutral-500">허용된 계정만 접근할 수 있습니다.</p>

        {message && (
          <p className="mt-5 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700">{message}</p>
        )}

        <div className="mt-7">
          {authConfigured ? (
            <GoogleLoginButton />
          ) : (
            <p className="rounded-lg bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
              로그인 설정이 완료되지 않았습니다.
              <br />
              NEXT_PUBLIC_SUPABASE_ANON_KEY 를 확인해 주세요.
            </p>
          )}
        </div>
      </div>
    </main>
  )
}
