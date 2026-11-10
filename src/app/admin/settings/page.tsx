import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getAdminUser } from '@/lib/admin-auth'
import { supabaseConfigured } from '@/lib/supabase-admin'
import {
  getPlanCopies,
  getExploreDesc,
  getScopePrompt,
  getShowDuration,
  listOptionTemplates,
} from '@/lib/site-settings'
import { listAllSpecialties } from '@/lib/specialties'
import { readBudgetRows } from '@/lib/specialty-budgets'
import { listAllFaqs } from '@/lib/faqs'
import { PlanCopyForm } from '@/components/admin/plan-copy-form'
import { OptionTemplateManager } from '@/components/admin/option-template-manager'
import { SpecialtyManager } from '@/components/admin/specialty-manager'
import { FaqManager } from '@/components/admin/faq-manager'
import { ScopePromptToggle, ShowDurationToggle } from '@/components/admin/scope-prompt-toggle'

export const metadata: Metadata = {
  title: '설정',
  robots: { index: false, follow: false },
}

export const instant = false

/* 탭 — 주소의 ?tab= 으로 고른다. 저장 뒤 새로 그려도, 새로고침해도 같은 탭에 머문다 */
const TABS = [
  { key: 'general', label: '기본 설정' },
  { key: 'plans', label: '가격 템플릿' },
  { key: 'options', label: '포함 항목 템플릿' },
  { key: 'faq', label: 'FAQ' },
] as const
type Tab = (typeof TABS)[number]['key']

function isTab(v: unknown): v is Tab {
  return TABS.some((t) => t.key === v)
}

export default async function AdminSettingsPage(props: PageProps<'/admin/settings'>) {
  const user = await getAdminUser()
  if (!user) redirect('/admin/login')

  const { tab: rawTab } = await props.searchParams
  const tab: Tab = isTab(rawTab) ? rawTab : 'general'

  /* 서로 기다릴 이유가 없다. 탭마다 필요한 것만 읽는다 —
     포함 항목 템플릿 탭도 프리미엄을 켠 플랜을 알아야 해서 플랜 문구를 함께 읽는다 */
  const [copies, specialties, scopePrompt, showDuration, templates, exploreDesc, faqs, budgetRows] =
    await Promise.all([
      tab === 'general' || tab === 'faq' ? null : getPlanCopies(),
      tab === 'general' ? listAllSpecialties() : null,
      tab === 'general' ? getScopePrompt() : null,
      tab === 'general' ? getShowDuration() : null,
      tab === 'options' ? listOptionTemplates() : null,
      tab === 'general' ? getExploreDesc() : null,
      tab === 'faq' ? listAllFaqs() : null,
      /* 분야별 예산 구간(0022) — 분야 목록과 같은 탭에서만 쓴다 */
      tab === 'general' ? readBudgetRows() : null,
    ])

  /* Map 은 클라이언트 컴포넌트로 넘어가지 않는다 — 평범한 객체로 바꾼다 */
  const budgets = budgetRows ? Object.fromEntries(budgetRows) : null

  return (
    <main className="min-w-0 flex-1 px-5 py-6 md:px-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">설정</h1>
        <p className="mt-1 text-sm text-neutral-500">
          모든 디자이너에게 공통으로 적용되는 값입니다
        </p>
      </header>

      {!supabaseConfigured && (
        <p className="mb-6 rounded-lg bg-amber-50 px-3.5 py-3 text-sm text-amber-800">
          SUPABASE_SERVICE_ROLE_KEY 가 설정되지 않아 저장이 동작하지 않습니다.
        </p>
      )}

      <nav aria-label="설정" className="mb-6 flex max-w-2xl gap-1 border-b border-neutral-200">
        {TABS.map((t) => {
          const on = t.key === tab
          return (
            <Link
              key={t.key}
              href={t.key === 'general' ? '/admin/settings' : `?tab=${t.key}`}
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
        {/* 기본 설정 — 화면 스위치와 전문 분야 */}
        {tab === 'general' && (
          <>
            <ScopePromptToggle enabled={scopePrompt!} />
            <ShowDurationToggle enabled={showDuration!} />
            <SpecialtyManager
              specialties={specialties!}
              exploreDesc={exploreDesc!}
              budgets={budgets ?? {}}
            />
          </>
        )}

        {/* 가격 템플릿 — 플랜 이름·설명·작업 기간, 유형별 프리미엄 켜기 */}
        {tab === 'plans' && <PlanCopyForm copies={copies!} />}

        {/* 포함 항목 템플릿 — 디자이너가 플랜마다 골라 등록하는 문장 */}
        {tab === 'options' && <OptionTemplateManager templates={templates!} copies={copies!} />}

        {/* FAQ — 공개 화면에서 제목을 누르면 내용이 펼쳐진다 */}
        {tab === 'faq' && <FaqManager faqs={faqs!} />}
      </div>
    </main>
  )
}
