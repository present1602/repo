import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getDesignerUser } from '@/lib/designer-auth'
import { DesignerSignupForm } from '@/components/designers/signup-form'
import { isInviteLocked } from './actions'

export const metadata: Metadata = {
  title: '초대 디자이너 회원가입 · SOOM',
  robots: { index: false, follow: false },
}

export const instant = false

export default async function DesignerSignupPage() {
  const user = await getDesignerUser()
  if (user) redirect('/studio')

  /* 초대코드를 여러 번 틀린 브라우저는 처음부터 잠긴 화면으로 */
  const locked = await isInviteLocked()

  return (
    <main className="grid flex-1 place-items-center bg-white px-5 py-16">
      <div className="w-full max-w-sm">
        <div className="text-center">
          <h1 className="text-xl font-bold tracking-tight">초대 디자이너 회원가입</h1>
          <p className="mt-1.5 text-sm text-neutral-500">관리자에게 받은 초대코드로 가입해 주세요.</p>
        </div>

        <div className="mt-7">
          <DesignerSignupForm locked={locked} />
        </div>

        <p className="mt-6 text-center text-sm text-neutral-500">
          이미 계정이 있다면{' '}
          <Link href="/studio/login" className="font-medium text-violet-600 hover:text-violet-700">
            로그인
          </Link>
        </p>
      </div>
    </main>
  )
}
