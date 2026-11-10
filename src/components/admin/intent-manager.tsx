'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useActionTransition } from '@/lib/use-action-transition'
import {
  MAX_INTENT_INTRO,
  MAX_INTENT_LABEL,
  type ChatIntentNode,
} from '@/lib/chat-shape'
import {
  addIntent,
  updateIntent,
  setIntentEnabled,
  reorderIntents,
  deleteIntent,
} from '@/app/admin/chat/actions'
import { Flash } from '@/components/flash'

type Notice = { kind: 'ok' | 'error'; text: string } | null

/* 챗봇 시작 메뉴 관리(0027_chat_intents.sql).

   KnowledgeManager 와 같은 짜임이다 — 한 줄로 두고, 누르면 펼쳐지고,
   화살표로 차례를 바꾼다. 다른 것은 단추가 단추를 품는다는 점이다.

   끌어서 옮기지 않고 화살표를 둔다 — 단계가 있는 목록에서 끌기는 '어느 부모
   아래로 떨어뜨렸는지' 가 모호하다. 화살표는 같은 부모 안에서만 움직여
   그 모호함이 없다. */
export function IntentManager({ tree }: { tree: ChatIntentNode[] }) {
  const [notice, setNotice] = useState<Notice>(null)
  const [pending, start] = useActionTransition()
  const router = useRouter()

  /* 지금 펼쳐 둔 줄과, 새 단추를 더하는 자리(부모 id, 첫 단계는 null) */
  const [editing, setEditing] = useState<string | null>(null)
  const [addingTo, setAddingTo] = useState<string | null | undefined>(undefined)

  const act = (fn: () => Promise<{ ok: boolean; error?: string }>, okText?: string) => {
    setNotice(null)
    start(async () => {
      const r = await fn()
      if (!r.ok) {
        setNotice({ kind: 'error', text: r.error ?? '처리에 실패했습니다.' })
        return
      }
      router.refresh()
      setEditing(null)
      setAddingTo(undefined)
      if (okText) setNotice({ kind: 'ok', text: okText })
    })
  }

  /* 같은 부모 안에서 한 칸 옮긴다 — 끝에서는 아무 일도 하지 않는다 */
  const move = (parentId: string | null, siblings: ChatIntentNode[], id: string, by: -1 | 1) => {
    const from = siblings.findIndex((s) => s.id === id)
    const to = from + by
    if (from < 0 || to < 0 || to >= siblings.length) return

    const ids = siblings.map((s) => s.id)
    ;[ids[from], ids[to]] = [ids[to], ids[from]]
    act(() => reorderIntents(parentId, ids))
  }

  const rows = (nodes: ChatIntentNode[], parentId: string | null, depth: number) =>
    nodes.map((n, i) => (
      <div key={n.id}>
        <div
          className="flex items-center gap-2 border-t border-neutral-100 py-2.5 first:border-t-0"
          style={{ paddingLeft: depth * 20 }}
        >
          {/* 차례 바꾸기 — 같은 부모 안에서만 */}
          <div className="flex shrink-0 flex-col">
            <button
              type="button"
              onClick={() => move(parentId, nodes, n.id, -1)}
              disabled={pending || i === 0}
              aria-label="위로"
              className="grid size-5 place-items-center rounded text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700 disabled:opacity-25"
            >
              <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" aria-hidden>
                <path d="M6 15l6-6 6 6" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => move(parentId, nodes, n.id, 1)}
              disabled={pending || i === nodes.length - 1}
              aria-label="아래로"
              className="grid size-5 place-items-center rounded text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700 disabled:opacity-25"
            >
              <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" aria-hidden>
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setEditing(editing === n.id ? null : n.id)}
            className="min-w-0 flex-1 text-left"
          >
            <span className={`text-sm font-medium ${n.enabled ? '' : 'text-neutral-400 line-through'}`}>
              {n.label}
            </span>
            {/* 소개 멘트가 비어 있으면 눌렀을 때 바로 다음 단계로 넘어간다 —
                아래 단계가 없으면 아무 말도 없이 끝나므로 눈에 띄게 알린다 */}
            {!n.intro.trim() && (
              <span
                className={`ml-2 rounded px-1.5 py-0.5 text-[11px] font-medium ${
                  n.children.length > 0
                    ? 'bg-neutral-100 text-neutral-500'
                    : 'bg-amber-50 text-amber-700'
                }`}
              >
                {n.children.length > 0 ? '바로 다음 단계로' : '소개 멘트 없음'}
              </span>
            )}
          </button>

          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => setAddingTo(addingTo === n.id ? undefined : n.id)}
              disabled={pending}
              className="rounded-md px-2 py-1 text-xs font-medium text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-800 disabled:opacity-40"
            >
              아래 단계 추가
            </button>
            <button
              type="button"
              onClick={() => act(() => setIntentEnabled(n.id, !n.enabled))}
              disabled={pending}
              className="rounded-md px-2 py-1 text-xs font-medium text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-800 disabled:opacity-40"
            >
              {n.enabled ? '끄기' : '켜기'}
            </button>
          </div>
        </div>

        {editing === n.id && (
          <div style={{ paddingLeft: depth * 20 + 28 }} className="pb-3">
            <IntentForm
              label={n.label}
              intro={n.intro}
              pending={pending}
              submitText="저장"
              onSubmit={(label, intro) => act(() => updateIntent(n.id, label, intro), '저장했습니다.')}
              onCancel={() => setEditing(null)}
              onDelete={() => {
                const warn =
                  n.children.length > 0
                    ? `'${n.label}' 과(와) 그 아래 단계 ${n.children.length}개가 함께 지워집니다. 계속할까요?`
                    : `'${n.label}' 을(를) 지울까요?`
                if (confirm(warn)) act(() => deleteIntent(n.id), '지웠습니다.')
              }}
            />
          </div>
        )}

        {/* 이 단추 아래에 새 단계 더하기 */}
        {addingTo === n.id && (
          <div style={{ paddingLeft: depth * 20 + 28 }} className="pb-3">
            <IntentForm
              pending={pending}
              submitText="추가"
              onSubmit={(label, intro) => act(() => addIntent(n.id, label, intro), '추가했습니다.')}
              onCancel={() => setAddingTo(undefined)}
            />
          </div>
        )}

        {n.children.length > 0 && rows(n.children, n.id, depth + 1)}
      </div>
    ))

  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-5">
      <div className="mb-1 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">시작 메뉴</h2>
        <button
          type="button"
          onClick={() => setAddingTo(addingTo === null ? undefined : null)}
          disabled={pending}
          className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-violet-600 disabled:opacity-40"
        >
          첫 단계 추가
        </button>
      </div>
      <p className="mb-4 text-xs leading-relaxed text-neutral-500">
        챗봇을 열면 <b>무엇을 만들고 싶으신가요?</b> 아래에 이 단추들이 깔립니다. 누르면 소개
        멘트가 뜨고, 아래 단계가 있으면 다음 단추가 이어집니다. 소개 멘트를 비워 두면 멘트 없이
        다음 단계로 넘어갑니다.
      </p>

      {/* 실패 문구를 목록 바로 위에 둔다 — 누른 자리에서 읽히게(AGENTS.md) */}
      <Flash msg={notice} onDone={() => setNotice(null)} className="mb-3" />

      {addingTo === null && (
        <div className="mb-3">
          <IntentForm
            pending={pending}
            submitText="추가"
            onSubmit={(label, intro) => act(() => addIntent(null, label, intro), '추가했습니다.')}
            onCancel={() => setAddingTo(undefined)}
          />
        </div>
      )}

      {tree.length === 0 ? (
        <p className="py-10 text-center text-sm text-neutral-500">
          아직 단추가 없습니다. 첫 단계 추가를 눌러 시작하세요.
        </p>
      ) : (
        <div className="rounded-lg border border-neutral-200 px-3">{rows(tree, null, 0)}</div>
      )}
    </section>
  )
}

/* 단추 하나를 적는 폼 — 더할 때와 고칠 때 같은 것을 쓴다 */
function IntentForm({
  label: initialLabel = '',
  intro: initialIntro = '',
  pending,
  submitText,
  onSubmit,
  onCancel,
  onDelete,
}: {
  label?: string
  intro?: string
  pending: boolean
  submitText: string
  onSubmit: (label: string, intro: string) => void
  onCancel: () => void
  onDelete?: () => void
}) {
  const [label, setLabel] = useState(initialLabel)
  const [intro, setIntro] = useState(initialIntro)

  const tooLongLabel = label.length > MAX_INTENT_LABEL
  const tooLongIntro = intro.length > MAX_INTENT_INTRO
  const canSave = Boolean(label.trim()) && !tooLongLabel && !tooLongIntro && !pending

  return (
    <div className="rounded-lg bg-neutral-50 p-3">
      <input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="단추에 적을 말 (예: 웹사이트)"
        className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none ring-violet-500 focus:ring-2"
      />
      <textarea
        value={intro}
        onChange={(e) => setIntro(e.target.value)}
        rows={4}
        placeholder="누르면 챗봇이 띄울 소개 멘트. 비워 두면 바로 다음 단계로 넘어갑니다"
        className="mt-2 w-full resize-y rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none ring-violet-500 focus:ring-2"
      />

      {/* 누르기 전에 막은 까닭을 입력칸 옆에 적는다(AGENTS.md) */}
      {(tooLongLabel || tooLongIntro) && (
        <p className="mt-1.5 text-[11px] text-red-600">
          {tooLongLabel
            ? `단추 글자는 ${MAX_INTENT_LABEL}자 이내로 적어 주세요.`
            : `소개 멘트는 ${MAX_INTENT_INTRO}자 이내로 적어 주세요.`}
        </p>
      )}

      <div className="mt-2 flex items-center justify-end gap-2">
        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            disabled={pending}
            className="mr-auto rounded-md px-2 py-1 text-xs font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-40"
          >
            삭제
          </button>
        )}
        <button
          type="button"
          onClick={onCancel}
          disabled={pending}
          className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-semibold transition hover:bg-neutral-100 disabled:opacity-40"
        >
          취소
        </button>
        <button
          type="button"
          onClick={() => onSubmit(label, intro)}
          disabled={!canSave}
          className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-violet-600 disabled:opacity-40"
        >
          {pending ? '저장 중…' : submitText}
        </button>
      </div>
    </div>
  )
}
