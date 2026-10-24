'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { type WorkRow, MAX_WORKS, MIN_ROW_SPAN, MAX_ROW_SPAN } from '@/lib/portfolio-limits'
import { addWork, updateWork, setWorkVisible, deleteWork } from '@/app/studio/actions'
import { Img } from '@/components/img'

export function PortfolioManager({ works }: { works: WorkRow[] }) {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const full = works.length >= MAX_WORKS

  return (
    <div className="space-y-5">
      {msg && (
        <p
          className={`rounded-lg px-3 py-2.5 text-sm ${
            msg.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'
          }`}
        >
          {msg.text}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-neutral-500">
          {works.length} / {MAX_WORKS}개
          {full && <span className="ml-1.5 text-amber-700">· 상한에 도달했습니다</span>}
        </p>
        <AddButton disabled={full} onMessage={setMsg} />
      </div>

      {works.length === 0 ? (
        <p className="rounded-xl border border-dashed border-neutral-300 py-16 text-center text-sm text-neutral-500">
          아직 올린 작업이 없습니다.
        </p>
      ) : (
        /* 3열 masonry — 가로 폭은 그리드가 정하고, 카드마다 세로 칸 수만 다르다.
           auto-rows 를 작게 쪼개 row_span 으로 높이를 조절한다. */
        <div className="grid auto-rows-[110px] grid-cols-2 gap-3 md:grid-cols-3">
          {works.map((w) => (
            <WorkCard
              key={w.id}
              work={w}
              editing={editing === w.id}
              onEdit={() => setEditing(w.id)}
              onClose={() => setEditing(null)}
              onMessage={setMsg}
            />
          ))}
        </div>
      )}

      <p className="text-xs text-neutral-400">
        카드를 누르면 제목·설명을 고치고 세로 길이를 조절할 수 있습니다. 가로 폭은 열에 맞춰
        고정됩니다.
      </p>
    </div>
  )
}

/* ─────────── 추가 ─────────── */

function AddButton({
  disabled,
  onMessage,
}: {
  disabled: boolean
  onMessage: (m: { ok: boolean; text: string } | null) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [pending, start] = useTransition()
  const router = useRouter()
  /* 고른 파일을 바로 올리지 않고 붙잡아 둔다 — AI 사용 여부를 먼저 묻는다.
     기본값을 정해두면 아무 생각 없이 넘어가므로 고를 때까지 비워둔다. */
  const [picked, setPicked] = useState<File | null>(null)
  const [aiUsed, setAiUsed] = useState<boolean | null>(null)

  /* 올리기 전에 원본 크기를 읽어둔다 — 세로로 긴 이미지는 2칸으로 시작한다 */
  const measure = (file: File) =>
    new Promise<{ width: number | null; height: number | null }>((resolve) => {
      const url = URL.createObjectURL(file)
      const img = new Image()
      img.onload = () => {
        resolve({ width: img.naturalWidth, height: img.naturalHeight })
        URL.revokeObjectURL(url)
      }
      img.onerror = () => {
        resolve({ width: null, height: null })
        URL.revokeObjectURL(url)
      }
      img.src = url
    })

  const upload = (file: File, ai: boolean) => {
    onMessage(null)
    start(async () => {
      const { width, height } = await measure(file)

      const form = new FormData()
      form.set('image', file)
      if (width) form.set('width', String(width))
      if (height) form.set('height', String(height))
      /* 답했다는 사실과 답 자체를 따로 보낸다 — 체크하지 않은 체크박스는
         브라우저가 전송하지 않아 '아니오'와 '묻지 않음'이 구분되지 않는다. */
      form.set('aiAnswered', '1')
      if (ai) form.set('aiUsed', '1')

      const r = await addWork(form)
      if (!r.ok) {
        onMessage({ ok: false, text: r.error })
        return
      }
      setPicked(null)
      setAiUsed(null)
      router.refresh()
    })
  }

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) {
            setPicked(f)
            setAiUsed(null)
          }
          e.target.value = ''
        }}
      />
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={disabled || pending}
        className="rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-600 disabled:opacity-40"
      >
        작업 추가
      </button>

      {picked && (
        <AiPromptDialog
          fileName={picked.name}
          value={aiUsed}
          onChange={setAiUsed}
          pending={pending}
          onCancel={() => {
            setPicked(null)
            setAiUsed(null)
          }}
          onConfirm={() => {
            if (aiUsed === null) return
            upload(picked, aiUsed)
          }}
        />
      )}
    </>
  )
}

/* ─────────── AI 사용 여부 ───────────

   올리기 전에 한 번 묻는다. 기본값을 정해두면 그대로 통과해 버리므로
   둘 중 하나를 직접 고를 때까지 올리는 버튼을 잠근다. */

function AiPromptDialog({
  fileName,
  value,
  onChange,
  pending,
  onCancel,
  onConfirm,
}: {
  fileName: string
  value: boolean | null
  onChange: (v: boolean) => void
  pending: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-5">
        <h3 className="text-sm font-semibold">이 작업에 AI를 사용했나요?</h3>
        <p className="mt-1.5 truncate text-xs text-neutral-500">{fileName}</p>

        <div className="mt-4 space-y-2">
          <AiChoice
            checked={value === true}
            onSelect={() => onChange(true)}
            label="AI를 사용했습니다"
            hint="생성·보정·업스케일 등 과정 일부에 썼다면 포함됩니다."
          />
          <AiChoice
            checked={value === false}
            onSelect={() => onChange(false)}
            label="사용하지 않았습니다"
            hint="전 과정을 직접 작업했습니다."
          />
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="rounded-lg border border-neutral-300 px-3.5 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100 disabled:opacity-50"
          >
            취소
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending || value === null}
            className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-600 disabled:opacity-40"
          >
            {pending ? '올리는 중…' : '올리기'}
          </button>
        </div>
      </div>
    </div>
  )
}

function AiChoice({
  checked,
  onSelect,
  label,
  hint,
}: {
  checked: boolean
  onSelect: () => void
  label: string
  hint: string
}) {
  return (
    <label
      className={`flex cursor-pointer gap-2.5 rounded-lg border p-3 transition ${
        checked ? 'border-indigo-600 bg-indigo-50' : 'border-neutral-300 hover:bg-neutral-50'
      }`}
    >
      <input
        type="radio"
        name="ai-used"
        checked={checked}
        onChange={onSelect}
        className="mt-0.5 accent-indigo-600"
      />
      <span className="min-w-0">
        <span className="block text-sm font-medium">{label}</span>
        <span className="mt-0.5 block text-xs leading-relaxed text-neutral-500">{hint}</span>
      </span>
    </label>
  )
}

/* ─────────── 카드 ─────────── */

function WorkCard({
  work: w,
  editing,
  onEdit,
  onClose,
  onMessage,
}: {
  work: WorkRow
  editing: boolean
  onEdit: () => void
  onClose: () => void
  onMessage: (m: { ok: boolean; text: string } | null) => void
}) {
  const [title, setTitle] = useState(w.title ?? '')
  const [description, setDescription] = useState(w.description ?? '')
  const [client, setClient] = useState(w.client ?? '')
  const [rowSpan, setRowSpan] = useState(w.row_span)
  /* 묻기 전에 올라간 작업은 null 이다 — 체크박스로는 둘 중 하나만 고를 수
     있으므로 '아직 답하지 않음'으로 보고 꺼진 상태에서 시작한다. */
  const [aiUsed, setAiUsed] = useState(w.ai_used === true)
  const [pending, start] = useTransition()
  const router = useRouter()

  const act = (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    onMessage(null)
    start(async () => {
      const r = await fn()
      if (!r.ok) {
        onMessage({ ok: false, text: r.error ?? '처리에 실패했습니다.' })
        return
      }
      router.refresh()
    })
  }

  /* 편집 중에는 조절한 길이를 즉시 반영해 결과를 눈으로 보고 정한다 */
  const span = editing ? rowSpan : w.row_span

  return (
    <article
      className="relative overflow-hidden rounded-lg ring-1 ring-neutral-200"
      style={{ gridRow: `span ${span} / span ${span}` }}
    >
      <Img
        src={w.image_url}
        alt={w.title ?? ''}
        className={`h-full w-full ${w.visible ? '' : 'opacity-40'}`}
      />

      <div className="absolute left-2 top-2 flex flex-wrap gap-1">
        {!w.visible && (
          <span className="rounded bg-neutral-900/80 px-1.5 py-0.5 text-[11px] text-white">
            숨김
          </span>
        )}
        {w.ai_used && (
          <span className="rounded bg-indigo-600/90 px-1.5 py-0.5 text-[11px] text-white">
            AI
          </span>
        )}
      </div>

      {!editing && (
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-gradient-to-t from-black/70 to-transparent p-2">
          <span className="min-w-0 truncate text-[11px] text-white">{w.title ?? ' '}</span>
          <button
            onClick={onEdit}
            className="shrink-0 rounded bg-white/90 px-1.5 py-0.5 text-[11px] font-medium text-neutral-900"
          >
            편집
          </button>
        </div>
      )}

      {editing && (
        <div className="absolute inset-0 overflow-y-auto bg-white/97 p-3">
          <div className="space-y-2.5">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="제목"
              className="h-8 w-full rounded border border-neutral-300 px-2 text-xs outline-none ring-indigo-500 focus:ring-2"
            />
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="설명"
              rows={3}
              className="w-full resize-none rounded border border-neutral-300 px-2 py-1.5 text-xs outline-none ring-indigo-500 focus:ring-2"
            />

            {/* 선택 입력 — 비우면 공개 화면에서 해당 표기가 사라진다 */}
            <input
              value={client}
              onChange={(e) => setClient(e.target.value)}
              placeholder="클라이언트 (선택)"
              className="h-8 w-full rounded border border-neutral-300 px-2 text-xs outline-none ring-indigo-500 focus:ring-2"
            />

            {/* AI 사용 여부 — 공개 화면에는 켠 것만 표기된다 */}
            <label className="flex cursor-pointer items-start gap-2 rounded border border-neutral-300 p-2">
              <input
                type="checkbox"
                checked={aiUsed}
                onChange={(e) => setAiUsed(e.target.checked)}
                className="mt-0.5 accent-indigo-600"
              />
              <span className="min-w-0">
                <span className="block text-[11px] font-medium">AI 사용</span>
                {w.ai_used === null && (
                  <span className="mt-0.5 block text-[10px] leading-snug text-amber-700">
                    아직 답하지 않은 작업입니다
                  </span>
                )}
              </span>
            </label>

            <div>
              <label className="flex items-center justify-between text-[11px] text-neutral-600">
                세로 길이
                <span className="text-neutral-400">{rowSpan}칸</span>
              </label>
              <input
                type="range"
                min={MIN_ROW_SPAN}
                max={MAX_ROW_SPAN}
                step={1}
                value={rowSpan}
                onChange={(e) => setRowSpan(Number(e.target.value))}
                className="mt-1 w-full accent-indigo-600"
              />
            </div>

            <div className="flex flex-wrap gap-1.5 pt-0.5">
              <button
                onClick={() =>
                  act(async () => {
                    const r = await updateWork({
                      id: w.id,
                      title,
                      description,
                      client,
                      rowSpan,
                      aiUsed,
                    })
                    if (r.ok) onClose()
                    return r
                  })
                }
                disabled={pending}
                className="rounded bg-neutral-900 px-2 py-1 text-[11px] font-semibold text-white disabled:opacity-50"
              >
                저장
              </button>
              <button
                onClick={() => {
                  setRowSpan(w.row_span)
                  setAiUsed(w.ai_used === true)
                  onClose()
                }}
                disabled={pending}
                className={tiny}
              >
                취소
              </button>
              <button
                onClick={() => act(() => setWorkVisible(w.id, !w.visible))}
                disabled={pending}
                className={tiny}
              >
                {w.visible ? '숨기기' : '노출'}
              </button>
              <button
                onClick={() => {
                  if (!confirm('이 작업을 삭제할까요? 되돌릴 수 없습니다.')) return
                  act(() => deleteWork(w.id))
                }}
                disabled={pending}
                className="rounded border border-red-200 px-2 py-1 text-[11px] font-medium text-red-600 disabled:opacity-50"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}
    </article>
  )
}

const tiny =
  'rounded border border-neutral-300 px-2 py-1 text-[11px] font-medium text-neutral-700 disabled:opacity-50'
