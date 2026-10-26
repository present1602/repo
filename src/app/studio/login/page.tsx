import type { Metadata } from 'next'
import Link from 'next/link'
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
          <div className="mx-auto grid size-9 place-items-center rounded-lg bg-violet-600 text-sm font-bold text-white">
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

        {/* 아직 디자이너가 아닌 사람이 여기까지 올 수 있다 —
            무엇을 하는 곳인지, 어떻게 합류하는지로 이어준다 */}
        <div className="mt-8 border-t border-neutral-200 pt-6 text-center">
          <p className="text-xs text-neutral-500">SOOM 디자이너로 활동하고 싶다면</p>
          <Link
            href="/designers/proposal/v1-4"
            className="mt-1.5 inline-block text-sm font-medium text-violet-600 transition hover:text-violet-700"
          >
            디자이너 제안서 보기 →
          </Link>
          {/* 제안서를 이미 봤거나 바로 합류하려는 사람을 위한 지름길 */}
          <Link
            href="/designers/apply"
            className="mt-1 block text-sm font-medium text-violet-600 transition hover:text-violet-700"
          >
            디자이너 신청하기 →
          </Link>
        </div>
      </div>
    </main>
  )
}
