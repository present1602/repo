'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { type WorkRow, MAX_WORKS, MAX_DESCRIPTION, thumbSrc } from '@/lib/portfolio-limits'
import {
  addWork,
  updateWork,
  updateWorkCrop,
  setWorkVisible,
  deleteWork,
  reorderWorks,
} from '@/app/studio/actions'
import { Img } from '@/components/img'
import { CropEditor } from '@/components/admin/crop-editor'
import {
  type Crop,
  type RatioKey,
  THUMB_RATIOS,
  centeredCrop,
  cropOf,
  ratioValue,
  reshapeCrop,
} from '@/lib/crop'
import { makeThumbFromUrl } from '@/lib/make-thumb'

export function PortfolioManager({ works }: { works: WorkRow[] }) {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  /* 편집 레이어로 열어 둔 작업. 목록이 새로 와도(저장 후 refresh) 같은
     id 로 다시 찾으므로 방금 고친 값이 레이어에 바로 반영된다. */
  const [editing, setEditing] = useState<string | null>(null)
  const openWork = works.find((w) => w.id === editing) ?? null

  /* 기본은 공개 화면과 비슷한 그리드, 편집을 켜면 어드민과 같은 리스트가 된다.
     추가와 순서 바꾸기는 리스트에서만 한다 — 그리드에서 끌게 하면
     구경하다 실수로 순서가 바뀐다. */
  const [editMode, setEditMode] = useState(false)
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
        {/* 좌상단 — 편집 들어가기·나가기 */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              setEditMode((v) => !v)
              /* 모드를 옮길 때 열어 둔 편집칸은 닫는다 — 다른 화면에
                 그대로 남아 있으면 어디를 고치던 중이었는지 헷갈린다 */
              setEditing(null)
              setMsg(null)
            }}
            className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
              editMode
                ? 'bg-neutral-900 text-white hover:bg-neutral-700'
                : 'border border-neutral-300 text-neutral-700 hover:bg-neutral-100'
            }`}
          >
            {editMode ? '편집 끝내기' : '포트폴리오 편집'}
          </button>
          <p className="text-sm text-neutral-500">
            {works.length} / {MAX_WORKS}개
            {full && <span className="ml-1.5 text-amber-700">· 상한</span>}
          </p>
        </div>

        {/* 추가는 편집 중에만 — 보기 화면에는 손댈 거리를 두지 않는다 */}
        {editMode && <AddButton disabled={full} onMessage={setMsg} />}
      </div>

      {works.length === 0 ? (
        <p className="rounded-xl border border-dashed border-neutral-300 py-16 text-center text-sm text-neutral-500">
          아직 올린 작업이 없습니다.
          {!editMode && (
            <>
              <br />
              <span className="text-xs text-neutral-400">
                &lsquo;포트폴리오 편집&rsquo;으로 올릴 수 있습니다.
              </span>
            </>
          )}
        </p>
      ) : editMode ? (
        <EditList works={works} onMessage={setMsg} onEdit={setEditing} />
      ) : (
        /* 3열 masonry — 가로 폭은 그리드가 정하고, 카드마다 세로 칸 수만 다르다.
           auto-rows 를 작게 쪼개 row_span 으로 높이를 조절한다. */
        <div className="grid auto-rows-[110px] grid-cols-2 gap-3 md:grid-cols-3">
          {works.map((w) => (
            <WorkCard key={w.id} work={w} onEdit={() => setEditing(w.id)} />
          ))}
        </div>
      )}

      <p className="text-xs text-neutral-400">
        {editMode
          ? '왼쪽 손잡이를 끌어 순서를 바꿀 수 있습니다. 이 순서가 공개 화면에도 그대로 쓰입니다.'
          : '카드의 편집을 누르면 제목·설명과 썸네일을 고칠 수 있습니다.'}
      </p>

      {/* 편집 레이어 — 목록 위에 띄운다. 모드와 상관없이 같은 화면을 쓴다. */}
      {openWork && (
        <WorkEditDialog
          work={openWork}
          onClose={() => setEditing(null)}
          onMessage={setMsg}
        />
      )}
    </div>
  )
}

/* ─────────── 편집 목록 ───────────

   어드민 화면(admin-portfolio.tsx)과 같은 모양이다 — 썸네일과 제목이
   한 줄씩 늘어서고, 왼쪽 손잡이를 끌어 순서를 바꾼다.

   끄는 동안에는 화면에서만 자리를 옮기고, 손을 떼는 순간 한 번 저장한다.
   지나갈 때마다 저장하면 한 번 끌어도 요청이 수십 번 나간다. */
function EditList({
  works,
  onMessage,
  onEdit,
}: {
  works: WorkRow[]
  onMessage: (m: { ok: boolean; text: string } | null) => void
  onEdit: (id: string) => void
}) {
  const [dragging, setDragging] = useState<{ id: string; ids: string[] } | null>(null)
  const [saving, startSaving] = useTransition()
  const router = useRouter()

  const dragId = dragging?.id ?? null

  /* 화면에 그릴 순서. 끄는 중이면 그 순서를, 아니면 서버 순서를 쓴다 —
     서버 목록을 state 로 베껴 두면 추가·삭제 때마다 둘을 맞추는 코드가
     따라붙는다. 끄는 중 목록이 바뀌면 사라진 작업은 빼고 새 작업은 뒤에 붙인다. */
  const order = (() => {
    if (!dragging) return works
    const byId = new Map(works.map((w) => [w.id, w]))
    const kept = dragging.ids.map((id) => byId.get(id)).filter((w) => w != null)
    const known = new Set(kept.map((w) => w.id))
    return [...kept, ...works.filter((w) => !known.has(w.id))]
  })()

  const moveTo = (i: number) => {
    setDragging((cur) => {
      if (!cur) return cur
      const from = order.findIndex((w) => w.id === cur.id)
      if (from === -1 || from === i) return cur
      const next = order.map((w) => w.id)
      const [id] = next.splice(from, 1)
      next.splice(i, 0, id)
      return { ...cur, ids: next }
    })
  }

  const commit = () => {
    const moved = dragging
    setDragging(null)
    if (!moved) return

    if (works.map((w) => w.id).join() === moved.ids.join()) return

    startSaving(async () => {
      const r = await reorderWorks(moved.ids)
      if (!r.ok) {
        /* 실패하면 화면도 서버 순서로 돌아간다 — dragging 을 이미 비웠으므로
           works 가 그대로 그려진다. 보이는 순서와 실제가 어긋나면 더 나쁘다. */
        onMessage({ ok: false, text: r.error })
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="space-y-2">
      {saving && <p className="text-xs text-neutral-400">순서 저장 중…</p>}

      <ul className="divide-y divide-neutral-200 overflow-hidden rounded-xl ring-1 ring-neutral-200">
        {order.map((w, i) => (
          <li
            key={w.id}
            onDragOver={(e) => {
              /* 끌고 지나가는 자리마다 미리 바꿔 보여준다 —
                 놓을 때까지 기다리면 어디에 떨어질지 알 수 없다. */
              if (dragId == null) return
              e.preventDefault()
              moveTo(i)
            }}
            className={`flex items-center bg-white transition ${
              dragId === w.id ? 'opacity-40' : ''
            }`}
          >
            {/* 끌기 손잡이 — 여기서만 끌 수 있다 */}
            <span
              draggable
              onDragStart={(e) => {
                setDragging({ id: w.id, ids: works.map((x) => x.id) })
                e.dataTransfer.effectAllowed = 'move'
                /* Firefox 는 데이터가 없으면 드래그를 시작하지 않는다 */
                e.dataTransfer.setData('text/plain', w.id)
              }}
              onDragEnd={commit}
              aria-label="끌어서 순서 바꾸기"
              title="끌어서 순서 바꾸기"
              className="flex w-8 shrink-0 cursor-grab touch-none items-center justify-center self-stretch text-neutral-300 hover:text-neutral-600 active:cursor-grabbing"
            >
              <svg viewBox="0 0 16 16" fill="currentColor" className="size-4">
                {[4, 8, 12].map((cy) =>
                  [6, 10].map((cx) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1.3" />),
                )}
              </svg>
            </span>

            <Img
              src={thumbSrc(w)}
              alt={w.title ?? ''}
              className={`my-3 size-14 shrink-0 rounded-lg ${w.visible ? '' : 'opacity-40'}`}
            />

            <div className="min-w-0 flex-1 px-3 py-3">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="text-sm font-medium">
                  {w.title ?? <span className="text-neutral-400">제목 없음</span>}
                </span>
                {!w.visible && (
                  <span className="rounded bg-neutral-200 px-1.5 py-0.5 text-[11px] text-neutral-600">
                    숨김
                  </span>
                )}
                {w.ai_used && (
                  <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-[11px] text-indigo-700">
                    AI
                  </span>
                )}
              </div>
              {w.description && (
                <p className="mt-0.5 line-clamp-1 text-xs text-neutral-500">{w.description}</p>
              )}
            </div>

            {/* 여기서도 같은 편집 레이어를 연다 — 순서를 바꾸다 내용도
                고치고 싶을 때 모드를 오가지 않아도 된다 */}
            <button
              type="button"
              onClick={() => onEdit(w.id)}
              className="mr-3 shrink-0 rounded-md border border-neutral-300 px-2 py-1 text-[11px] font-medium text-neutral-700 transition hover:bg-neutral-100"
            >
              편집
            </button>
          </li>
        ))}
      </ul>
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
  onEdit,
}: {
  work: WorkRow
  onEdit: () => void
}) {
  return (
    <article
      className="relative overflow-hidden rounded-lg ring-1 ring-neutral-200"
      style={{ gridRow: `span ${w.row_span} / span ${w.row_span}` }}
    >
      <Img
        src={thumbSrc(w)}
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
          <span className="rounded bg-indigo-600/90 px-1.5 py-0.5 text-[11px] text-white">AI</span>
        )}
      </div>

      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-gradient-to-t from-black/70 to-transparent p-2">
        <span className="min-w-0 truncate text-[11px] text-white">{w.title ?? ' '}</span>
        <button
          onClick={onEdit}
          className="shrink-0 rounded bg-white/90 px-1.5 py-0.5 text-[11px] font-medium text-neutral-900"
        >
          편집
        </button>
      </div>
    </article>
  )
}

/* ─────────── 편집 레이어 ───────────

   어드민 상세(admin-portfolio.tsx 의 WorkDialog)와 같은 짜임이다 —
   좌측에 원본을 크게 띄우고 우측에서 고친다. 좁은 화면에서는 위아래로
   쌓여, 이미지를 먼저 보고 아래로 내려가며 고치게 된다.

   세로 길이(row_span) 조절은 뺐다 — 카드 안에서 즉시 보며 맞추던 값이라
   레이어로 옮기면 결과를 볼 수 없다. 컬럼과 공개 화면 동작은 그대로 둔다. */
function WorkEditDialog({
  work: w,
  onClose,
  onMessage,
}: {
  work: WorkRow
  onClose: () => void
  onMessage: (m: { ok: boolean; text: string } | null) => void
}) {
  const [title, setTitle] = useState(w.title ?? '')
  const [description, setDescription] = useState(w.description ?? '')
  const [client, setClient] = useState(w.client ?? '')
  /* 묻기 전에 올라간 작업은 null 이다 — 체크박스로는 둘 중 하나만 고를 수
     있으므로 '아직 답하지 않음'으로 보고 꺼진 상태에서 시작한다. */
  const [aiUsed, setAiUsed] = useState(w.ai_used === true)
  const [pending, start] = useTransition()
  const router = useRouter()

  /* ─── 썸네일 영역 ───
     편집을 켜면 왼쪽 원본 위에서 영역을 잡는다. 켜기 전에는 지금 쓰이는
     썸네일만 보여준다 — 늘 편집기를 띄우면 원본을 볼 수 없다. */
  const [cropMode, setCropMode] = useState(false)
  const [crop, setCrop] = useState<Crop | null>(cropOf(w))
  const [ratio, setRatio] = useState<RatioKey | null>(null)
  const [savingCrop, startCrop] = useTransition()

  const imgRatio = w.width && w.height ? w.width / w.height : 1

  /* 아직 답하지 않은 작업(null)은 체크박스를 건드리지 않아도 저장할 수 있어야
     한다 — 끈 채로 저장하는 것이 '쓰지 않았다'는 답이다. */
  const dirty =
    title !== (w.title ?? '') ||
    description !== (w.description ?? '') ||
    client !== (w.client ?? '') ||
    aiUsed !== w.ai_used

  /* Esc 로 닫고, 열려 있는 동안 뒤쪽 목록이 스크롤되지 않게 한다 */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  const act = (fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) => {
    onMessage(null)
    start(async () => {
      const r = await fn()
      if (!r.ok) {
        onMessage({ ok: false, text: r.error ?? '처리에 실패했습니다.' })
        return
      }
      router.refresh()
      after?.()
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 md:p-4"
      /* 바깥을 눌러 닫는다 — 안쪽 클릭은 아래에서 멈춘다 */
      onClick={onClose}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-white md:flex-row"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 이미지 — 좁은 화면에서는 높이를 줄여 아래 입력칸이 가려지지 않게 한다 */}
        <div className="flex max-h-[38vh] min-h-0 shrink-0 items-center justify-center overflow-auto bg-neutral-100 p-3 md:max-h-none md:flex-1">
          {cropMode && crop ? (
            <CropEditor
              src={w.image_url}
              crop={crop}
              onChange={setCrop}
              lockedRatio={ratio == null ? null : ratioValue(ratio)}
              imgRatio={imgRatio}
            />
          ) : (
            /* 상세에서는 잘리지 않은 원본 비율을 봐야 하므로 Img(object-cover) 대신
               img + object-contain 을 쓴다. Storage 도메인이라 next/image 설정이 필요 없다. */
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={w.image_url}
              alt={w.title ?? ''}
              className="max-h-[34vh] w-auto max-w-full object-contain md:max-h-[84vh]"
            />
          )}
        </div>

        {/* 편집 */}
        <div className="flex min-h-0 w-full shrink-0 flex-col overflow-y-auto border-t border-neutral-200 p-4 md:w-80 md:border-l md:border-t-0 md:p-5">
          <div className="mb-4 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="text-sm font-semibold">작업 편집</h3>
              {w.width && w.height && (
                <p className="mt-1 text-xs text-neutral-400">
                  {w.width} × {w.height}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              aria-label="닫기"
              className="shrink-0 rounded p-1 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-900"
            >
              ✕
            </button>
          </div>

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-neutral-600">제목</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="제목 없음"
              className="h-9 w-full rounded-lg border border-neutral-300 px-3 text-sm outline-none ring-indigo-500 focus:ring-2"
            />
          </label>

          <label className="mt-3 block">
            <span className="mb-1.5 flex items-baseline justify-between text-xs font-medium text-neutral-600">
              설명
              <span className="font-normal text-neutral-400">
                {description.length} / {MAX_DESCRIPTION}
              </span>
            </span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              maxLength={MAX_DESCRIPTION}
              placeholder="설명 없음"
              className="w-full resize-none rounded-lg border border-neutral-300 px-3 py-2 text-sm leading-relaxed outline-none ring-indigo-500 focus:ring-2"
            />
          </label>

          {/* 선택 입력 — 비우면 공개 화면에서 해당 표기가 사라진다 */}
          <label className="mt-3 block">
            <span className="mb-1.5 block text-xs font-medium text-neutral-600">
              클라이언트 <span className="font-normal text-neutral-400">(선택)</span>
            </span>
            <input
              value={client}
              onChange={(e) => setClient(e.target.value)}
              placeholder="없음"
              className="h-9 w-full rounded-lg border border-neutral-300 px-3 text-sm outline-none ring-indigo-500 focus:ring-2"
            />
          </label>

          {/* AI 사용 여부 — 공개 화면에는 켠 것만 표기된다 */}
          <div className="mt-3 flex items-center gap-1.5">
            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={aiUsed}
                onChange={(e) => setAiUsed(e.target.checked)}
                className="accent-indigo-600"
              />
              AI 사용
            </label>
            <InfoTip text="AI를 활용해 제작된 경우 체크해주세요" />
          </div>

          {/* 썸네일 — 목록에 실제로 깔리는 그림 */}
          <div className="mt-4 border-t border-neutral-200 pt-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-neutral-600">썸네일</span>
              <button
                type="button"
                onClick={() => {
                  if (cropMode) {
                    /* 편집을 접으면 잡던 영역도 원래대로 — 저장하지 않고
                       닫았는데 다음에 열었을 때 남아 있으면 헷갈린다 */
                    setCrop(cropOf(w))
                    setRatio(null)
                  } else if (!crop) {
                    setCrop(centeredCrop(imgRatio, imgRatio))
                  }
                  setCropMode((v) => !v)
                }}
                disabled={savingCrop || !w.width || !w.height}
                title={!w.width || !w.height ? '원본 크기를 몰라 영역을 잡을 수 없습니다' : undefined}
                className="rounded-md border border-neutral-300 px-2 py-1 text-[11px] font-medium text-neutral-700 transition hover:bg-neutral-100 disabled:opacity-40"
              >
                {cropMode ? '취소' : '썸네일 편집'}
              </button>
            </div>

            {cropMode ? (
              <div className="space-y-2.5">
                <p className="text-[11px] leading-relaxed text-neutral-500">
                  위쪽 이미지에서 영역을 끌어 옮기고 핸들로 크기를 맞춥니다.
                </p>

                <div className="flex flex-wrap gap-1.5">
                  {THUMB_RATIOS.map((r) => (
                    <label
                      key={r.key}
                      className={`flex cursor-pointer items-center gap-1 rounded-md border px-1.5 py-1 text-[11px] transition ${
                        ratio === r.key
                          ? 'border-indigo-600 bg-indigo-50 font-medium text-indigo-700'
                          : 'border-neutral-300 hover:bg-neutral-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={ratio === r.key}
                        onChange={() => {
                          /* 같은 것을 다시 누르면 고정이 풀린다(자유 비율).
                             다른 것을 누르면 기존 선택은 자동으로 해제된다. */
                          const next = ratio === r.key ? null : r.key
                          setRatio(next)
                          if (next && crop) setCrop(reshapeCrop(crop, ratioValue(next), imgRatio))
                        }}
                        className="accent-indigo-600"
                      />
                      {r.key}
                    </label>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (!crop) return
                    startCrop(async () => {
                      onMessage(null)
                      /* 자르는 일은 여기서 한다 — 서버는 받은 파일을 저장만 한다 */
                      const thumb = await makeThumbFromUrl(w.image_url, crop)

                      const form = new FormData()
                      form.set('id', w.id)
                      form.set('cropX', String(crop.x))
                      form.set('cropY', String(crop.y))
                      form.set('cropW', String(crop.w))
                      form.set('cropH', String(crop.h))
                      if (thumb) form.set('thumb', thumb.file)

                      const r = await updateWorkCrop(form)
                      if (!r.ok) {
                        onMessage({ ok: false, text: r.error })
                        return
                      }
                      setCropMode(false)
                      setRatio(null)
                      router.refresh()
                      onMessage({
                        ok: true,
                        text: thumb
                          ? '썸네일을 바꿨습니다.'
                          : '영역만 저장했습니다(썸네일 생성 실패).',
                      })
                    })
                  }}
                  disabled={savingCrop || !crop}
                  className="w-full rounded-lg bg-neutral-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-indigo-600 disabled:opacity-40"
                >
                  {savingCrop ? '만드는 중…' : '썸네일 저장'}
                </button>
              </div>
            ) : (
              <div className="flex items-start gap-3">
                <Img
                  src={thumbSrc(w)}
                  alt=""
                  className="size-20 shrink-0 rounded-lg ring-1 ring-neutral-200"
                />
                <p className="min-w-0 text-[11px] leading-relaxed text-neutral-500">
                  {cropOf(w)
                    ? '영역을 잡아 만든 썸네일입니다.'
                    : w.thumb_url
                      ? '원본 전체를 줄인 썸네일입니다.'
                      : '아직 썸네일이 없어 목록에서 원본을 씁니다.'}
                </p>
              </div>
            )}
          </div>

          <button
            onClick={() =>
              act(
                () => updateWork({ id: w.id, title, description, client, aiUsed }),
                onClose,
              )
            }
            disabled={pending || !dirty}
            className="mt-4 rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-600 disabled:opacity-40"
          >
            {pending ? '저장 중…' : '저장'}
          </button>

          <div className="mt-5 border-t border-neutral-200 pt-4">
            <p className="mb-2 text-xs font-medium text-neutral-600">
              상태
              <span
                className={`ml-1.5 rounded px-1.5 py-0.5 text-[11px] ${
                  w.visible ? 'bg-emerald-100 text-emerald-800' : 'bg-neutral-200 text-neutral-600'
                }`}
              >
                {w.visible ? '노출 중' : '숨김'}
              </span>
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => act(() => setWorkVisible(w.id, !w.visible))}
                disabled={pending}
                className="rounded-md border border-neutral-300 px-2.5 py-1.5 text-xs font-medium text-neutral-700 transition hover:bg-neutral-100 disabled:opacity-50"
              >
                {w.visible ? '숨기기' : '노출하기'}
              </button>
              <button
                onClick={() => {
                  if (!confirm('이 작업을 삭제할까요? 되돌릴 수 없습니다.')) return
                  act(() => deleteWork(w.id), onClose)
                }}
                disabled={pending}
                className="rounded-md border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─────────── 설명 말풍선 ───────────

   아이콘에 올리거나(데스크톱) 누르면(터치) 짧은 안내가 뜬다.
   CSS group-hover 만 쓰면 터치 기기에서 영영 안 보이므로 상태도 함께 둔다.
   button 으로 만든다 — span 에 핸들러만 달면 키보드로 닿을 수 없다. */
function InfoTip({ text }: { text: string }) {
  const [open, setOpen] = useState(false)

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        aria-label={text}
        onClick={() => setOpen((v) => !v)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="grid size-4 place-items-center rounded-full border border-neutral-300 text-[10px] font-bold text-neutral-400 transition hover:border-neutral-500 hover:text-neutral-700"
      >
        i
      </button>

      {open && (
        <span
          role="tooltip"
          /* 좁은 칸에서 오른쪽으로 넘치지 않도록 왼쪽으로 펼친다 */
          className="absolute bottom-full right-0 z-10 mb-1.5 w-max max-w-[15rem] rounded-md bg-neutral-900 px-2 py-1.5 text-[11px] leading-relaxed text-white shadow-lg"
        >
          {text}
        </span>
      )}
    </span>
  )
}
