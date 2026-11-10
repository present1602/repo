import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getAdminUser } from '@/lib/admin-auth'
import { supabaseConfigured } from '@/lib/supabase-admin'
import { listAllFaqs } from '@/lib/faqs'
import { FaqManager } from '@/components/admin/faq-manager'

export const metadata: Metadata = {
  title: 'FAQ',
  robots: { index: false, follow: false },
}

export const instant = false

/* 자주 묻는 질문(0015_faqs.sql).

   설정 화면의 탭이었는데 따로 뺐다 — 손대는 빈도가 다른 설정값과 다르고,
   문의 챗봇도 이 글을 그대로 읽어 답하므로(chat-prompt.ts) 챗봇 옆자리가 맞다. */
export default async function AdminFaqPage() {
  const user = await getAdminUser()
  if (!user) redirect('/admin/login')

  const faqs = await listAllFaqs()
  const live = faqs.filter((f) => f.visible).length

  return (
    <main className="min-w-0 flex-1 px-5 py-6 md:px-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">FAQ</h1>
        <p className="mt-1 text-sm text-neutral-500">
          자주 묻는 질문 {faqs.length}개
          {live > 0 && <span className="ml-1.5 text-violet-600">· 노출 {live}개</span>}
          <span className="mt-1 block text-neutral-400">
            공개 화면에 보이고, 문의 챗봇도 이 글을 읽어 답합니다
          </span>
        </p>
      </header>

      {!supabaseConfigured && (
        <p className="mb-6 rounded-lg bg-amber-50 px-3.5 py-3 text-sm text-amber-800">
          SUPABASE_SERVICE_ROLE_KEY 가 설정되지 않아 저장이 동작하지 않습니다.
        </p>
      )}

      <div className="max-w-2xl">
        <FaqManager faqs={faqs} />
      </div>
    </main>
  )
}
