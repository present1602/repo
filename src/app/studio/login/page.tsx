import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getDesignerUser } from '@/lib/designer-auth'
import { DesignerLoginForm } from '@/components/designers/login-form'

export const metadata: Metadata = {
  title: '디자이너 로그인 · folio',
  robots: { index: false, follow: false },
}

export const instant = false

export default async function DesignerLoginPage() {
  const user = await getDesignerUser()
  if (user) redirect('/studio')

  return (
    <main className="grid flex-1 place-items-center bg-white px-5 py-16">
      <div className="w-full max-w-sm">
        <div className="text-center">
          <div className="mx-auto grid size-9 place-items-center rounded-lg bg-indigo-600 text-sm font-bold text-white">
            F
          </div>
          <h1 className="mt-5 text-xl font-bold tracking-tight">디자이너 로그인</h1>
          <p className="mt-1.5 text-sm text-neutral-500">
            등록 메일로 받은 임시 비밀번호로 로그인해 주세요.
          </p>
        </div>

        <div className="mt-7">
          <DesignerLoginForm />
        </div>

        <p className="mt-6 text-center text-xs text-neutral-400">
          계정이 없거나 메일을 받지 못했다면 관리자에게 문의해 주세요.
        </p>
      </div>
    </main>
  )
}
