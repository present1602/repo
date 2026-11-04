'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  MAX_OPTION_TEMPLATE,
  N_TOKEN,
  needsN,
  slotOf,
  type OptionTemplate,
  type PlanCopies,
  type PlanSlot,
} from '@/lib/plans'
import { SCOPES } from '@/lib/scopes'
import {
  createOptionTemplate,
  deleteOptionTemplate,
  updateOptionTemplate,
} from '@/app/admin/settings/actions'
import { Flash } from '@/components/flash'

type Draft = { template: string; targets: PlanSlot[] | null }

/* 포함 항목 템플릿 — 어드민은 문장만 만든다('수정 {n}회').

   숫자는 디자이너가 플랜마다 등록할 때 넣는다. 템플릿마다 고를 수 있는 플랜을
   정한다 — 기본은 모든 플랜, 해제하면 플랜을 골라 좁힌다. 프리미엄 칸은 그 플랜의
   프리미엄을 켰을 때만 보인다(프리미엄이 없는 플랜도 있다). */
export function OptionTemplateManager({
  templates,
  copies,
  designerId,
}: {
  templates: OptionTemplate[]
  copies: PlanCopies
  /* 있으면 그 디자이너 전용 항목을 다룬다(어드민 디자이너 상세의 설정 탭) */
  designerId?: string
}) {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [adding, setAdding] = useState<Draft>({ template: '', targets: null })
  const [pending, start] = useTransition()
  const router = useRouter()

  const run = (job: () => Promise<{ ok: true } | { ok: false; error: string }>, done: string, after?: () => void) => {
    setMsg(null)
    start(async () => {
      const r = await job()
      if (!r.ok) {
        setMsg({ ok: false, text: r.error })
        return
      }
      after?.()
      setMsg({ ok: true, text: done })
      router.refresh()
    })
  }

  return (
    <section className="rounded-xl bg-white p-5 ring-1 ring-neutral-200">
      <h2 className="text-sm font-semibold">
        {designerId ? '이 디자이너 전용 항목' : '포함 항목 템플릿'}
      </h2>
      <p className="mt-1 text-xs leading-relaxed text-neutral-500">
        {designerId
          ? '공통 템플릿에 없는 문장을 이 디자이너만 쓰도록 만듭니다. 아래 포함 항목 등록에서 공통 템플릿과 함께 고를 수 있습니다. 디자이너는 고를 수만 있고 문장은 고칠 수 없습니다.'
          : '의뢰 패널의 ‘✓ 수정 1회’ 같은 줄의 문장입니다. 디자이너가 플랜마다 골라 숫자까지 넣어 등록해야 나갑니다 — 처음에는 아무것도 나가지 않습니다.'}
        <br />
        숫자가 들어갈 자리에 <code className="rounded bg-neutral-100 px-1">{N_TOKEN}</code> 을
        넣으세요.
      </p>

      <Flash msg={msg} onDone={() => setMsg(null)} className="mt-4" />

      <ul className="mt-4 space-y-3">
        {templates.map((t) => (
          <TemplateRow
            key={`${t.id}:${t.template}:${(t.targets ?? []).join(',')}`}
            template={t}
            copies={copies}
            pending={pending}
            onSave={(d) => run(() => updateOptionTemplate(t.id, d), '템플릿을 고쳤습니다.')}
            onDelete={() => {
              if (
                !window.confirm(
                  `'${t.template}' 템플릿을 지울까요? 디자이너들이 등록한 것도 함께 지워집니다.`,
                )
              )
                return
              run(() => deleteOptionTemplate(t.id), '템플릿을 지웠습니다.')
            }}
          />
        ))}
        {templates.length === 0 && (
          <li className="rounded-lg border border-dashed border-neutral-300 py-6 text-center text-xs text-neutral-400">
            {designerId ? '전용 항목이 없습니다.' : '아직 템플릿이 없습니다.'}
          </li>
        )}
      </ul>

      {/* 새 템플릿 */}
      <div className="mt-5 rounded-lg border border-neutral-200 bg-neutral-50 p-3.5">
        <p className="text-xs font-semibold text-neutral-700">
          {designerId ? '새 전용 항목' : '새 템플릿'}
        </p>
        <input
          value={adding.template}
          onChange={(e) => setAdding((a) => ({ ...a, template: e.target.value }))}
          maxLength={MAX_OPTION_TEMPLATE}
          placeholder={`예: 수정 ${N_TOKEN}회`}
          className="mt-2 h-9 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm outline-none ring-violet-500 focus:ring-2"
        />
        <TargetPicker
          copies={copies}
          value={adding.targets}
          onChange={(targets) => setAdding((a) => ({ ...a, targets }))}
        />
        <button
          type="button"
          disabled={pending || !adding.template.trim()}
          onClick={() =>
            run(() => createOptionTemplate({ ...adding, designerId }), '템플릿을 추가했습니다.', () =>
              setAdding({ template: '', targets: null }),
            )
          }
          className="mt-3 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-600 disabled:opacity-40"
        >
          추가
        </button>
      </div>
    </section>
  )
}

function TemplateRow({
  template: t,
  copies,
  pending,
  onSave,
  onDelete,
}: {
  template: OptionTemplate
  copies: PlanCopies
  pending: boolean
  onSave: (d: Draft) => void
  onDelete: () => void
}) {
  const [draft, setDraft] = useState<Draft>({ template: t.template, targets: t.targets })
  const dirty =
    draft.template !== t.template ||
    JSON.stringify(draft.targets ?? null) !== JSON.stringify(t.targets ?? null)

  return (
    <li className="rounded-lg border border-neutral-200 p-3.5">
      <div className="flex items-center gap-2">
        <input
          value={draft.template}
          onChange={(e) => setDraft((d) => ({ ...d, template: e.target.value }))}
          maxLength={MAX_OPTION_TEMPLATE}
          aria-label="템플릿 문장"
          className="h-9 min-w-0 flex-1 rounded-lg border border-neutral-300 px-3 text-sm outline-none ring-violet-500 focus:ring-2"
        />
        <span
          className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] ${
            needsN(draft.template) ? 'bg-violet-100 text-violet-700' : 'bg-neutral-100 text-neutral-500'
          }`}
        >
          {needsN(draft.template) ? '숫자 입력' : '문장만'}
        </span>
      </div>

      <TargetPicker
        copies={copies}
        value={draft.targets}
        onChange={(targets) => setDraft((d) => ({ ...d, targets }))}
      />

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          disabled={pending || !dirty || !draft.template.trim()}
          onClick={() => {
            if (!window.confirm('템플릿을 고칠까요? 이미 등록한 디자이너에게도 바뀐 문장이 나갑니다.')) return
            onSave(draft)
          }}
          className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-violet-600 disabled:opacity-40"
        >
          저장
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={onDelete}
          className="rounded-lg px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-40"
        >
          삭제
        </button>
      </div>
    </li>
  )
}

/* 고를 수 있는 플랜 — '모든 플랜'(null) 이 기본. 해제하면 플랜별로 고른다.
   플랜이 1차, 프리미엄은 그 플랜의 프리미엄을 켰을 때만 아래에 붙는다. */
function TargetPicker({
  copies,
  value,
  onChange,
}: {
  copies: PlanCopies
  value: PlanSlot[] | null
  onChange: (v: PlanSlot[] | null) => void
}) {
  const all = value == null
  const has = (slot: PlanSlot) => all || (value ?? []).includes(slot)
  const toggle = (slot: PlanSlot, on: boolean) => {
    const cur = value ?? []
    onChange(on ? [...cur, slot] : cur.filter((x) => x !== slot))
  }

  return (
    <div className="mt-2.5">
      <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-neutral-700">
        <input
          type="checkbox"
          checked={all}
          /* 해제하면 지금 보이는 플랜(프리미엄은 켠 곳만)을 모두 골라 둔 채로 시작한다 */
          onChange={(e) =>
            onChange(
              e.target.checked
                ? null
                : SCOPES.flatMap((s) => [
                    slotOf(s, 'basic'),
                    ...(copies[s].premium.enabled ? [slotOf(s, 'premium')] : []),
                  ]),
            )
          }
          className="accent-violet-600"
        />
        모든 플랜
      </label>

      {!all && (
        <div className="mt-2 grid gap-x-4 gap-y-1.5 sm:grid-cols-2">
          {SCOPES.map((s) => (
            <div key={s}>
              <label className="flex cursor-pointer items-center gap-2 text-xs text-neutral-700">
                <input
                  type="checkbox"
                  checked={has(slotOf(s, 'basic'))}
                  onChange={(e) => toggle(slotOf(s, 'basic'), e.target.checked)}
                  className="accent-violet-600"
                />
                {copies[s].basic.name}
              </label>
              {copies[s].premium.enabled && (
                <label className="ml-6 mt-1 flex cursor-pointer items-center gap-2 text-[11px] text-neutral-600">
                  <input
                    type="checkbox"
                    checked={has(slotOf(s, 'premium'))}
                    onChange={(e) => toggle(slotOf(s, 'premium'), e.target.checked)}
                    className="accent-violet-600"
                  />
                  프리미엄
                </label>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
