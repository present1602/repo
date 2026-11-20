import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getAdminUser } from '@/lib/admin-auth'
import { supabaseConfigured } from '@/lib/supabase-admin'
import { getChatPublic } from '@/lib/site-settings'
import { listAllKnowledge, listChatLogs } from '@/lib/chat-knowledge'
import { getAllIntentTree } from '@/lib/chat-intents'
import { chatKnowledgeStats } from '@/lib/chat-prompt'
import { KnowledgeManager } from '@/components/admin/knowledge-manager'
import { IntentManager } from '@/components/admin/intent-manager'
import { ChatLogList } from '@/components/admin/chat-log-list'
import { ChatPublicToggle } from '@/components/admin/chat-public-toggle'

export const metadata: Metadata = {
  title: '챗봇',
  robots: { index: false, follow: false },
}

export const instant = false

/* 탭 — 주소의 ?tab= 으로 고른다(설정 화면과 같은 방식) */
const TABS = [
  { key: 'todo', label: '답변 필요' },
  { key: 'knowledge', label: '지식' },
  { key: 'intents', label: '시작 메뉴' },
  { key: 'logs', label: '전체 대화' },
] as const
type Tab = (typeof TABS)[number]['key']

function isTab(v: unknown): v is Tab {
  return TABS.some((t) => t.key === v)
}

/* 문의 챗봇 관리(0023_chat.sql).

   '답변 필요' 를 첫 탭에 둔다 — 챗봇을 정확하게 만드는 일은 모른다고 답한
   질문을 지식으로 바꾸는 일이고, 그 목록이 할 일 목록이다. */
export default async function AdminChatPage(props: PageProps<'/admin/chat'>) {
  const user = await getAdminUser()
  if (!user) redirect('/admin/login')

  const { tab: rawTab } = await props.searchParams
  const tab: Tab = isTab(rawTab) ? rawTab : 'todo'

  /* 탭마다 필요한 것만 읽는다 — 머리글의 스위치와 지식 수는 어느 탭에서나 쓴다 */
  const [isPublic, stats, knowledge, intents, logs] = await Promise.all([
    getChatPublic(),
    chatKnowledgeStats(),
    tab === 'knowledge' ? listAllKnowledge() : null,
    tab === 'intents' ? getAllIntentTree() : null,
    tab === 'todo'
      ? listChatLogs({ todoOnly: true })
      : tab === 'logs'
        ? listChatLogs()
        : null,
  ])

  return (
    <main className="min-w-0 flex-1 px-5 py-6 md:px-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">문의 챗봇</h1>
        <p className="mt-1 text-sm text-neutral-500">
          지식 카드 {stats.cards}개 · FAQ {stats.faqs}개 · 분야 {stats.categories}개를 읽고
          답합니다
        </p>
      </header>

      {!supabaseConfigured && (
        <p className="mb-6 rounded-lg bg-amber-50 px-3.5 py-3 text-sm text-amber-800">
          SUPABASE_SERVICE_ROLE_KEY 가 설정되지 않아 저장이 동작하지 않습니다.
        </p>
      )}

      {!process.env.ANTHROPIC_API_KEY && (
        <p className="mb-6 rounded-lg bg-amber-50 px-3.5 py-3 text-sm text-amber-800">
          ANTHROPIC_API_KEY 가 설정되지 않아 챗봇이 답하지 못합니다. 환경변수에 넣어 주세요.
        </p>
      )}

      <div className="mb-6 max-w-2xl">
        <ChatPublicToggle enabled={isPublic} cards={stats.cards} />
      </div>

      <nav aria-label="챗봇" className="mb-6 flex max-w-2xl gap-1 border-b border-neutral-200">
        {TABS.map((t) => {
          const on = t.key === tab
          return (
            <Link
              key={t.key}
              href={t.key === 'todo' ? '/admin/chat' : `?tab=${t.key}`}
              aria-current={on ? 'page' : undefined}
              scroll={false}
              className={`-mb-px border-b-2 px-3.5 py-2.5 text-sm font-medium transition ${
                on
                  ? 'border-violet-600 text-violet-700'
                  : 'border-transparent text-neutral-500 hover:text-neutral-900'
              }`}
            >
              {t.label}
            </Link>
          )
        })}
      </nav>

      <div className="max-w-2xl space-y-6">
        {/* 답변 필요 — 모른다고 답한 질문. 줄 안에서 지식을 적으면 내려간다 */}
        {tab === 'todo' && <ChatLogList logs={logs!} todoOnly />}

        {/* 지식 — 어드민이 늘려 가는 카드 */}
        {tab === 'knowledge' && <KnowledgeManager knowledge={knowledge!} />}

        {/* 시작 메뉴 — 챗봇을 열면 깔리는 단추와 그 소개 멘트 */}
        {tab === 'intents' && <IntentManager tree={intents!} />}

        {/* 전체 대화 — 무엇을 묻는지 읽는 자리 */}
        {tab === 'logs' && <ChatLogList logs={logs!} todoOnly={false} />}
      </div>
    </main>
  )
}
