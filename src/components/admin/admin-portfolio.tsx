'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { WorkRow } from '@/lib/portfolio-limits'
import { MAX_WORKS, MAX_DESCRIPTION } from '@/lib/portfolio-limits'
import {
  adminAddWork,
  adminUpdateWork,
  adminSetWorkVisible,
  adminDeleteWork,
} from '@/app/admin/designers/actions'
import { Img } from '@/components/img'

type Notice = { kind: 'ok' | 'error'; text: string } | null

export function AdminPortfolio({
  designerId,
  works,
}: {
  designerId: string
  works: WorkRow[]
}) {
  const [notice, setNotice] = useState<Notice>(null)
  /* 상세로 열어둔 작업 — 모달에서 수정·상태 변경을 한다 */
  const [openId, setOpenId] = useState<string | null>(null)
  const open = works.find((w) => w.id === openId) ?? null

  const shown = works.filter((w) => w.visible).length
  /* 묻기 전에 올라간 작업 — 디자이너에게 확인해 채워야 할 몫이다 */
  const unanswered = works.filter((w) => w.ai_used === null).length

  return (
    <section className="min-w-0">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <h2 className="text-sm font-semibold">포트폴리오</h2>
          <p className="text-xs text-neutral-500">
            {works.length} / {MAX_WORKS}개 · 노출 {shown}개
            {unanswered > 0 && (
              <span className="ml-1.5 text-amber-700">· AI 미응답 {unanswered}개</span>
            )}
          </p>
        </div>
        <AddWorkButton
          designerId={designerId}
          disabled={works.length >= MAX_WORKS}
          onNotice={setNotice}
        />
      </header>

      {notice && (
        <p
          className={`mb-4 rounded-lg px-3.5 py-3 text-sm ${
            notice.kind === 'ok' ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'
          }`}
        >
          {notice.text}
        </p>
      )}

      {works.length === 0 ? (
        <p className="rounded-xl border border-dashed border-neutral-300 py-16 text-center text-sm text-neutral-500">
          등록된 작업이 없습니다.
          <br />
          <span className="text-xs text-neutral-400">
            위의 &lsquo;작업 추가&rsquo;로 대신 올려줄 수 있습니다.
          </span>
        </p>
      ) : (
        <ul className="divide-y divide-neutral-200 overflow-hidden rounded-xl ring-1 ring-neutral-200">
          {works.map((w) => (
            <li key={w.id}>
              <button
                onClick={() => setOpenId(w.id)}
                className="flex w-full items-start gap-4 bg-white p-3.5 text-left hover:bg-neutral-50"
              >
                {/* 썸네일 */}
                <Img
                  src={w.image_url}
                  alt={w.title ?? ''}
                  className={`size-16 shrink-0 rounded-lg md:size-20 ${
                    w.visible ? '' : 'opacity-40'
                  }`}
                />

                {/* 제목·설명 */}
                <div className="min-w-0 flex-1">
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
                        AI 사용
                      </span>
                    )}
                    {w.ai_used === null && (
                      <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] text-amber-800">
                        AI 미응답
                      </span>
                    )}
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-neutral-600">
                    {w.description ?? <span className="text-neutral-400">설명 없음</span>}
                  </p>
                </div>

                {/* 등록일 */}
                <div className="shrink-0 text-right">
                  <p className="text-xs text-neutral-500">
                    {new Date(w.created_at).toLocaleDateString('ko-KR')}
                  </p>
                  <p className="mt-0.5 text-[11px] text-neutral-400">
                    {new Date(w.created_at).toLocaleTimeString('ko-KR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      {open && (
        <WorkDialog
          work={open}
          designerId={designerId}
          onClose={() => setOpenId(null)}
          onNotice={setNotice}
        />
      )}
    </section>
  )
}

/* ─────────── 추가 ─────────── */

/* 어드민이 디자이너를 대신해 작업을 올린다.
   여러 장을 한 번에 고를 수 있다 — 대신 올려주는 상황에서는 보통 묶음이다. */
function AddWorkButton({
  designerId,
  disabled,
  onNotice,
}: {
  designerId: string
  disabled: boolean
  onNotice: (n: Notice) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [pending, start] = useTransition()
  /* 여러 장일 때 어디까지 갔는지 — 큰 파일은 한참 걸린다 */
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const router = useRouter()
  /* 고른 파일을 붙잡아 두고 AI 사용 여부를 먼저 묻는다.
     묶음 전체에 한 번만 묻는다 — 대신 올려주는 상황에서 장마다 묻는 건
     쓸 수 없고, 묶음은 보통 한 작업의 여러 컷이다. 장마다 다르면
     나눠 올리거나 올린 뒤 상세에서 고친다. */
  const [picked, setPicked] = useState<File[] | null>(null)
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

  const upload = (files: File[], ai: boolean) => {
    onNotice(null)
    start(async () => {
      const failed: string[] = []

      /* 한 장씩 차례로 올린다. 동시에 보내면 상한(30개) 검사가
         서로를 못 보고 통과해 버린다 — DB 트리거가 막더라도
         이미 올라간 이미지가 버킷에 남는다. */
      for (let i = 0; i < files.length; i++) {
        setProgress({ done: i, total: files.length })

        const file = files[i]
        const { width, height } = await measure(file)

        const form = new FormData()
        form.set('designerId', designerId)
        form.set('image', file)
        /* 파일명을 제목의 출발점으로 쓴다 — 확장자는 뗀다.
           어드민이 여러 장을 올릴 때 하나하나 제목을 적기 어렵다. */
        form.set('title', file.name.replace(/\.[^.]+$/, ''))
        if (width) form.set('width', String(width))
        if (height) form.set('height', String(height))
        /* 답했다는 사실과 답 자체를 따로 보낸다 — 체크하지 않은 체크박스는
           브라우저가 전송하지 않아 '아니오'와 '묻지 않음'이 구분되지 않는다. */
        form.set('aiAnswered', '1')
        if (ai) form.set('aiUsed', '1')

        const r = await adminAddWork(form)
        if (!r.ok) {
          failed.push(`${file.name}: ${r.error}`)
          /* 상한에 걸렸으면 나머지도 전부 실패한다 — 여기서 멈춘다 */
          if (r.error.includes('최대')) break
        }
      }

      setProgress(null)
      setPicked(null)
      setAiUsed(null)
      router.refresh()

      if (failed.length === 0) {
        onNotice({ kind: 'ok', text: `${files.length}개를 올렸습니다.` })
      } else if (failed.length === files.length) {
        onNotice({ kind: 'error', text: failed[0] })
      } else {
        onNotice({
          kind: 'error',
          text: `${files.length - failed.length}개 성공 · ${failed.length}개 실패 (${failed[0]})`,
        })
      }
    })
  }

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          const files = Array.from(e.target.files ?? [])
          if (files.length > 0) {
            setPicked(files)
            setAiUsed(null)
          }
          /* 같은 파일을 다시 고를 수 있게 비운다 */
          e.target.value = ''
        }}
      />
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={disabled || pending}
        title={disabled ? `최대 ${MAX_WORKS}개까지 올릴 수 있습니다` : undefined}
        className="rounded-lg bg-neutral-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-indigo-600 disabled:opacity-40"
      >
        {pending
          ? progress && progress.total > 1
            ? `올리는 중 ${progress.done + 1}/${progress.total}…`
            : '올리는 중…'
          : '작업 추가'}
      </button>

      {picked && (
        <AiPromptDialog
          files={picked}
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
   둘 중 하나를 직접 고를 때까지 올리는 버튼을 잠근다.

   어드민은 본인이 아니라 디자이너를 대신해 답하는 자리다 —
   확실하지 않으면 올리지 말고 본인에게 확인하라고 화면에서 알려준다. */

function AiPromptDialog({
  files,
  value,
  onChange,
  pending,
  onCancel,
  onConfirm,
}: {
  files: File[]
  value: boolean | null
  onChange: (v: boolean) => void
  pending: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  const many = files.length > 1

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-5">
        <h3 className="text-sm font-semibold">
          {many ? `${files.length}개 작업에 AI를 사용했나요?` : '이 작업에 AI를 사용했나요?'}
        </h3>
        <p className="mt-1.5 truncate text-xs text-neutral-500">
          {many ? `${files[0].name} 외 ${files.length - 1}개` : files[0].name}
        </p>
        {many && (
          <p className="mt-1 text-[11px] leading-relaxed text-neutral-500">
            고른 전체에 같은 값이 들어갑니다. 장마다 다르면 나눠 올리거나 올린 뒤 상세에서
            고쳐 주세요.
          </p>
        )}

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

        <p className="mt-3 text-[11px] leading-relaxed text-amber-700">
          디자이너를 대신해 답하는 항목입니다. 확실하지 않으면 본인에게 확인해 주세요.
        </p>

        <div className="mt-4 flex justify-end gap-2">
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
        name="admin-ai-used"
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

/* ─────────── 상세 ─────────── */

function WorkDialog({
  work: w,
  designerId,
  onClose,
  onNotice,
}: {
  work: WorkRow
  designerId: string
  onClose: () => void
  onNotice: (n: Notice) => void
}) {
  const [title, setTitle] = useState(w.title ?? '')
  const [description, setDescription] = useState(w.description ?? '')
  const [client, setClient] = useState(w.client ?? '')
  /* 묻기 전에 올라간 작업은 null 이다 — 체크박스로는 둘 중 하나만 고를 수
     있으므로 '아직 답하지 않음'으로 보고 꺼진 상태에서 시작한다. */
  const [aiUsed, setAiUsed] = useState(w.ai_used === true)
  const [pending, start] = useTransition()
  const router = useRouter()

  /* 아직 답하지 않은 작업(null)은 체크박스를 건드리지 않아도 저장할 수 있어야
     한다 — 끈 채로 저장하는 것이 '쓰지 않았다'는 답이다. null 을 false 와
     같다고 보면 저장 버튼이 잠겨 영원히 미응답으로 남는다. */
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
    onNotice(null)
    start(async () => {
      const r = await fn()
      if (!r.ok) {
        onNotice({ kind: 'error', text: r.error ?? '처리에 실패했습니다.' })
        return
      }
      router.refresh()
      after?.()
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      /* 바깥을 눌러 닫는다 — 안쪽 클릭은 아래에서 멈춘다 */
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-white md:flex-row"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 이미지 — 원본을 크게 본다 */}
        <div className="flex min-h-0 flex-1 items-center justify-center bg-neutral-100 p-3">
          {/* 상세에서는 잘리지 않은 원본 비율을 봐야 하므로 Img(object-cover) 대신
              img + object-contain 을 쓴다. Storage 도메인이라 next/image 설정이 필요 없다. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={w.image_url}
            alt={w.title ?? ''}
            className="max-h-[52vh] w-auto max-w-full object-contain md:max-h-[84vh]"
          />
        </div>

        {/* 편집 */}
        <div className="flex w-full shrink-0 flex-col overflow-y-auto border-t border-neutral-200 p-5 md:w-80 md:border-l md:border-t-0">
          <div className="mb-4 flex items-start justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold">작업 상세</h3>
              <p className="mt-1 text-xs text-neutral-500">
                등록 {new Date(w.created_at).toLocaleString('ko-KR')}
              </p>
              {w.width && w.height && (
                <p className="text-xs text-neutral-400">
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
              rows={7}
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
          <label className="mt-3 flex cursor-pointer items-start gap-2.5 rounded-lg border border-neutral-300 p-3">
            <input
              type="checkbox"
              checked={aiUsed}
              onChange={(e) => setAiUsed(e.target.checked)}
              className="mt-0.5 accent-indigo-600"
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium">AI 사용</span>
              <span className="mt-0.5 block text-xs leading-relaxed text-neutral-500">
                {w.ai_used === null
                  ? '아직 답하지 않은 작업입니다. 디자이너에게 확인한 뒤 정해 주세요.'
                  : '켜면 공개 화면에 AI 활용 표기가 붙습니다.'}
              </span>
            </span>
          </label>

          <button
            onClick={() =>
              act(
                () =>
                  adminUpdateWork({ id: w.id, designerId, title, description, client, aiUsed }),
                () => onNotice({ kind: 'ok', text: '저장했습니다.' }),
              )
            }
            disabled={pending || !dirty}
            className="mt-3 rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-600 disabled:opacity-40"
          >
            {pending ? '저장 중…' : '저장'}
          </button>

          <div className="mt-5 border-t border-neutral-200 pt-4">
            <p className="mb-2 text-xs font-medium text-neutral-600">
              상태
              <span
                className={`ml-1.5 rounded px-1.5 py-0.5 text-[11px] ${
                  w.visible
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-neutral-200 text-neutral-600'
                }`}
              >
                {w.visible ? '노출 중' : '숨김'}
              </span>
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => act(() => adminSetWorkVisible(w.id, designerId, !w.visible))}
                disabled={pending}
                className="rounded-md border border-neutral-300 px-2.5 py-1.5 text-xs font-medium text-neutral-700 transition hover:bg-neutral-100 disabled:opacity-50"
              >
                {w.visible ? '숨기기' : '노출하기'}
              </button>
              <button
                onClick={() => {
                  if (!confirm('이 작업을 삭제할까요? 되돌릴 수 없습니다.')) return
                  act(
                    () => adminDeleteWork(w.id, designerId),
                    () => {
                      onNotice({ kind: 'ok', text: '삭제했습니다.' })
                      onClose()
                    },
                  )
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
