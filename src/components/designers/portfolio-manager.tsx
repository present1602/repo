'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  type WorkRow,
  MAX_WORKS,
  MAX_DESCRIPTION,
  MAX_SOURCE_BYTES,
  MAX_PDF_PAGES,
  thumbSrc,
} from '@/lib/portfolio-limits'
import {
  addWork,
  prepareWorkUpload,
  prepareWorkPages,
  updateWork,
  updateWorkCrop,
  setWorkVisible,
  deleteWork,
  reorderWorks,
} from '@/app/studio/actions'
import { Img } from '@/components/img'
import { WorkThumb } from '@/components/work-thumb'
import { CropEditor, CropPreview } from '@/components/admin/crop-editor'
import { StackView, ZoomArea, type ZoomAreaHandle } from '@/components/zoom-area'
import {
  type Crop,
  type RatioKey,
  THUMB_RATIOS,
  centeredCrop,
  clampCrop,
  insetCrop,
  cropOf,
  ratioValue,
  reshapeCrop,
} from '@/lib/crop'
import { makeStackThumb, makeThumb, makeThumbFromUrl } from '@/lib/make-thumb'
import { firstPageCrop, stackOfWork } from '@/lib/work-stack'
import { WorkUploader } from '@/components/work-uploader'
import { Flash } from '@/components/flash'

export function PortfolioManager({ works }: { works: WorkRow[] }) {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  /* 편집 레이어로 열어 둔 작업. 목록이 새로 와도(저장 후 refresh) 같은
     id 로 다시 찾으므로 방금 고친 값이 레이어에 바로 반영된다. */
  const [editing, setEditing] = useState<string | null>(null)
  const openWork = works.find((w) => w.id === editing) ?? null

  /* 기본은 공개 화면과 비슷한 그리드, 편집을 켜면 어드민과 같은 리스트가 된다.
     순서 바꾸기는 리스트에서만 한다 — 그리드에서 끌게 하면
     구경하다 실수로 순서가 바뀐다. */
  const [editMode, setEditMode] = useState(false)
  const full = works.length >= MAX_WORKS

  return (
    <div className="space-y-5">
      <Flash msg={msg} onDone={() => setMsg(null)} />

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

        {/* 추가는 모드와 상관없이 늘 보인다 — 편집을 켜야 찾을 수 있으면 첫 작업을 못 올린다 */}
        <AddButton disabled={full} onMessage={setMsg} />
      </div>

      {works.length === 0 ? (
        <p className="rounded-xl border border-dashed border-neutral-300 py-16 text-center text-sm text-neutral-500">
          아직 올린 작업이 없습니다.
          <br />
          <span className="text-xs text-neutral-400">
            &lsquo;작업 추가&rsquo;로 올릴 수 있습니다.
          </span>
        </p>
      ) : editMode ? (
        <EditList works={works} onMessage={setMsg} onEdit={setEditing} />
      ) : (
        /* masonry — 카드 높이는 썸네일 비율을 따른다(공개 화면 work-gallery.tsx 와 같은 WorkThumb).
           왼쪽부터 한 장씩 돌아가며 칸에 넣어 읽는 순서가 공개 화면 순서와 같게 한다.
           좁은 화면 2열, 넓은 화면 3열 — 열 수마다 따로 나눠 그린다 */
        <>
          {[2, 3].map((n) => (
            <div key={n} className={`gap-3 ${n === 2 ? 'flex md:hidden' : 'hidden md:flex'}`}>
              {Array.from({ length: n }, (_, c) => (
                <div key={c} className="min-w-0 flex-1 space-y-3">
                  {works
                    .filter((_, i) => i % n === c)
                    .map((w) => (
                      <WorkCard key={w.id} work={w} onEdit={() => setEditing(w.id)} />
                    ))}
                </div>
              ))}
            </div>
          ))}
        </>
      )}

      <p className="text-xs text-neutral-400">
        {editMode
          ? '왼쪽 손잡이를 끌어 순서를 바꿀 수 있습니다. 이 순서가 공개 화면에도 그대로 쓰입니다.'
          : '카드를 누르면 설명과 썸네일을 고칠 수 있습니다.'}
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

            {/* 썸네일을 눌러도 편집 레이어가 열린다 — 버튼까지 가지 않아도 되게 */}
            <button
              type="button"
              onClick={() => onEdit(w.id)}
              aria-label={`${w.title ?? '작업'} 편집`}
              className="my-3 shrink-0 cursor-pointer rounded-lg transition hover:opacity-80"
            >
              <Img
                src={thumbSrc(w)}
                alt={w.title ?? ''}
                className={`size-14 rounded-lg ${w.visible ? '' : 'opacity-40'}`}
              />
            </button>

            <div className="min-w-0 flex-1 px-3 py-3">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="line-clamp-1 text-sm">
                  {w.description || <span className="text-neutral-400">설명 없음</span>}
                </span>
                {/* 올리면 숨김으로 시작한다 — 어느 쪽인지 늘 보이게 */}
                <span
                  className={`rounded px-1.5 py-0.5 text-[11px] ${
                    w.visible ? 'bg-emerald-100 text-emerald-800' : 'bg-neutral-200 text-neutral-600'
                  }`}
                >
                  {w.visible ? '노출' : '숨김'}
                </span>
                {w.ai_used && (
                  <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[11px] text-violet-700">
                    AI
                  </span>
                )}
                {w.soom_work && (
                  <span className="rounded bg-neutral-900 px-1.5 py-0.5 text-[11px] text-white">
                    SOOM
                  </span>
                )}
              </div>
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

/* 고르면 입력 창부터 뜬다 — 설명·노출·썸네일을 정하고 '저장'해야 올라간다
   (work-uploader.tsx, 어드민과 같은 창). 50MB 를 넘는 이미지는 줄이고 PDF 는
   장마다 이미지로 바꿔 올린다. AI 활용은 꺼진 채로 시작한다 — 본인이 답한다. */
function AddButton({
  disabled,
  onMessage,
}: {
  disabled: boolean
  onMessage: (m: { ok: boolean; text: string } | null) => void
}) {
  return (
    <div className="flex flex-col items-end gap-1">
      <WorkUploader
        actions={{ prepareUpload: prepareWorkUpload, preparePages: prepareWorkPages, addWork }}
        disabled={disabled}
        aiDefault={false}
        className="rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-600 disabled:opacity-40"
        successText={() => '작업을 올렸습니다.'}
        onMessage={onMessage}
      />
      <span className="text-[11px] text-neutral-400">
        이미지·PDF {MAX_SOURCE_BYTES / 1024 / 1024}MB 이하 · PDF {MAX_PDF_PAGES}쪽까지
      </span>
    </div>
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
    <article className="relative overflow-hidden rounded-lg ring-1 ring-neutral-200">
      {/* 카드 어디를 눌러도 편집 레이어가 열린다. 배지·제목 줄은 위에 겹쳐 있어
          클릭을 막지 않게 pointer-events-none 으로 둔다(편집 버튼만 받는다) */}
      <button
        type="button"
        onClick={onEdit}
        aria-label={`${w.title ?? '작업'} 편집`}
        className={`block w-full cursor-pointer transition hover:opacity-90 ${w.visible ? '' : 'opacity-40'}`}
      >
        {/* 공개 화면과 같은 칸 — 썸네일 비율대로, 영역 없는 긴 페이지는 1:1.8 에서 끊는다 */}
        <WorkThumb work={{ ...w, thumb_url: thumbSrc(w) }} rounded="" />
      </button>

      <div className="pointer-events-none absolute left-2 top-2 flex flex-wrap gap-1">
        {/* 올리면 숨김으로 시작한다 — 어느 쪽인지 늘 보이게 */}
        <span
          className={`rounded px-1.5 py-0.5 text-[11px] text-white ${
            w.visible ? 'bg-emerald-600/90' : 'bg-neutral-900/80'
          }`}
        >
          {w.visible ? '노출' : '숨김'}
        </span>
        {w.ai_used && (
          <span className="rounded bg-violet-600/90 px-1.5 py-0.5 text-[11px] text-white">AI</span>
        )}
        {w.pages && w.pages.length > 0 && (
          <span className="rounded bg-red-600/90 px-1.5 py-0.5 text-[11px] text-white">
            PDF {w.pages.length + 1}쪽
          </span>
        )}
        {w.soom_work && (
          <span className="rounded bg-neutral-900/90 px-1.5 py-0.5 text-[11px] text-white">
            SOOM
          </span>
        )}
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-gradient-to-t from-black/70 to-transparent p-2">
        <span className="min-w-0 truncate text-[11px] text-white">{w.description ?? ' '}</span>
        <button
          onClick={onEdit}
          className="pointer-events-auto shrink-0 rounded bg-white/90 px-1.5 py-0.5 text-[11px] font-medium text-neutral-900"
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
  const [title] = useState(w.title ?? '')
  const [description, setDescription] = useState(w.description ?? '')
  const [client, setClient] = useState(w.client ?? '')
  /* 묻기 전에 올라간 작업은 null 이다 — 체크박스로는 둘 중 하나만 고를 수
     있으므로 '아직 답하지 않음'으로 보고 꺼진 상태에서 시작한다. */
  const [aiUsed, setAiUsed] = useState(w.ai_used === true)
  /* 020 전 DB 에서는 undefined 로 온다 — 꺼짐으로 본다 */
  const [soomWork, setSoomWork] = useState(w.soom_work === true)
  const [pending, start] = useTransition()
  const router = useRouter()

  /* ─── 썸네일 ───
     영역을 잡거나(cropMode) 파일을 따로 고르면(thumbFile) 오른쪽 미리보기만
     바뀌고, '저장'을 누를 때 다른 칸과 함께 저장한다. 둘은 하나만 쓴다.
     영역 지정을 켜기 전에는 지금 쓰이는 썸네일만 보여준다 — 늘 편집기를 띄우면
     원본을 볼 수 없다. */
  const [cropMode, setCropMode] = useState(false)
  const [crop, setCrop] = useState<Crop | null>(cropOf(w))
  const [ratio, setRatio] = useState<RatioKey | null>(null)
  /* 왼쪽 그림 칸 — 키워 둔 채 영역 지정을 켜면 보이는 부분에 처음 영역을 잡는다 */
  const zoomRef = useRef<ZoomAreaHandle>(null)
  const [thumbFile, setThumbFile] = useState<File | null>(null)
  const [thumbUrl, setThumbUrl] = useState<string | null>(null)
  const thumbFileRef = useRef<HTMLInputElement>(null)

  const imgRatio = w.width && w.height ? w.width / w.height : 1
  const hasPages = (w.pages?.length ?? 0) > 0
  /* 이어 붙인 전체로 영역을 잡을 수 있는 PDF 작업인지(work-stack.ts).
     전체 크기가 저장되기 전에 올라간 PDF 는 null — 첫 장에서만 잡는다 */
  const stack = stackOfWork(w)
  /* 미리보기 재료 — PDF 는 이어 붙인 장, 이미지는 원본 한 장 */
  const previewParts = stack
    ? stack.map((p) => ({ src: String(p.src), width: p.width, height: p.height }))
    : w.width && w.height
      ? [{ src: w.image_url, width: w.width, height: w.height }]
      : null
  /* 저장할 썸네일 변경이 있는지 */
  const thumbDirty = cropMode || thumbFile != null

  /* 아직 답하지 않은 작업(null)은 체크박스를 건드리지 않아도 저장할 수 있어야
     한다 — 끈 채로 저장하는 것이 '쓰지 않았다'는 답이다. */
  const dirty =
    title !== (w.title ?? '') ||
    description !== (w.description ?? '') ||
    client !== (w.client ?? '') ||
    aiUsed !== w.ai_used ||
    soomWork !== (w.soom_work === true)

  /* Esc 로 닫고, 열려 있는 동안 뒤쪽 목록이 스크롤되지 않게 한다 */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      /* 썸네일을 고치는 동안에는 Esc 로 닫지 않는다 — 잡던 영역·고른 파일과 적은 내용이 날아간다 */
      if (e.key === 'Escape' && !thumbDirty) onClose()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose, thumbDirty])

  /* ─── 썸네일 영역 지정 ───
     시작하면 지금 스크롤로 보고 있는 부분 안에 새 영역을 잡는다 — 기존 영역은
     긴 그림 어딘가에 있어 화면 밖일 수 있다. 이어 붙인 장을 못 쓰는 옛 PDF 는
     보기와 잡기의 그림이 달라 가운데에 잡는다. 따로 고른 파일은 내려놓는다. */
  const startCropMode = () => {
    const v = stack || !hasPages ? zoomRef.current?.visible() : null
    const start = v ? clampCrop(insetCrop(v), imgRatio) : centeredCrop(imgRatio, imgRatio)
    setCrop(start)
    setRatio(null)
    setCropMode(true)
    setThumbFile(null)
    setThumbUrl(null)
  }

  /* 파일을 썸네일로 고른다 — 잡던 영역은 버린다 */
  const pickThumb = (f: File) => {
    setThumbFile(f)
    setThumbUrl(URL.createObjectURL(f))
    setCropMode(false)
    setCrop(cropOf(w))
    setRatio(null)
  }

  /* 영역(없으면 비움)과 썸네일 파일을 updateWorkCrop 에 보낼 꼴로 */
  const cropForm = (c: Crop | null, thumb: File | null) => {
    const form = new FormData()
    form.set('id', w.id)
    if (c) {
      form.set('cropX', String(c.x))
      form.set('cropY', String(c.y))
      form.set('cropW', String(c.w))
      form.set('cropH', String(c.h))
    }
    if (thumb) form.set('thumb', thumb)
    return form
  }

  /* 저장 — 썸네일을 바꿨으면 먼저 저장하고, 다른 칸이 바뀌었으면 이어서 저장한다.
     자르는 일은 여기서 한다 — 서버는 받은 파일을 저장만 한다. */
  const save = () => {
    onMessage(null)
    start(async () => {
      let thumbNote: { ok: boolean; text: string } | null = null

      if (cropMode && crop) {
        const thumb = stack ? await makeStackThumb(stack, crop) : await makeThumbFromUrl(w.image_url, crop)
        const r = await updateWorkCrop(cropForm(crop, thumb?.file ?? null))
        if (!r.ok) {
          onMessage({ ok: false, text: r.error })
          return
        }
        thumbNote = thumb
          ? { ok: true, text: '썸네일을 바꿨습니다.' }
          : { ok: false, text: '영역만 저장했습니다(썸네일 생성 실패).' }
      } else if (thumbFile) {
        /* 따로 고른 이미지는 원본(PDF 표지 포함)에서 자르지 않고 통째로 줄여 쓴다 */
        const thumb = await makeThumb(thumbFile, null)
        if (!thumb) {
          onMessage({ ok: false, text: '이미지를 읽지 못했습니다.' })
          return
        }
        /* 영역은 지운다 — 남겨 두면 다음에 열었을 때 원본 위에 엉뚱한 영역이 잡혀 있다.
           PDF 는 첫 장 영역을 남긴다 — 목록·카드가 그 비율로 자리를 잡는다(work-stack.ts) */
        const keep = stack ? firstPageCrop(stack[0], stack.slice(1)) : null
        const r = await updateWorkCrop(cropForm(keep, thumb.file))
        if (!r.ok) {
          onMessage({ ok: false, text: r.error })
          return
        }
        thumbNote = { ok: true, text: '썸네일을 바꿨습니다.' }
      }

      if (dirty) {
        const r = await updateWork({ id: w.id, title, description, client, aiUsed, soomWork })
        if (!r.ok) {
          onMessage({ ok: false, text: r.error ?? '처리에 실패했습니다.' })
          return
        }
      }

      router.refresh()
      onMessage(thumbNote)
      onClose()
    })
  }

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
        {/* 이미지 — 좁은 화면에서는 높이를 줄여 아래 입력칸이 가려지지 않게 한다.
            PDF 작업은 첫 장 아래로 나머지 장을 이어 붙여 내려 보며 확인하고,
            영역도 그 이어진 그림 어디에서나 잡는다. */}
        <ZoomArea
          handle={zoomRef}
          ratio={w.width && w.height ? w.width / w.height : null}
          naturalWidth={w.width}
          fit={hasPages ? 'width' : 'contain'}
          className="max-h-[38vh] shrink-0 md:max-h-none md:flex-1"
        >
          {cropMode && crop ? (
            <CropEditor
              src={w.image_url}
              pages={stack ? w.pages! : undefined}
              crop={crop}
              onChange={setCrop}
              lockedRatio={ratio == null ? null : ratioValue(ratio)}
              imgRatio={imgRatio}
            />
          ) : (
            /* 전체 크기가 저장되기 전에 올라간 PDF(stack 없음)는 보기만 이어 붙인다 */
            <StackView src={w.image_url} pages={hasPages ? w.pages : null} alt={w.title ?? ''} />
          )}
        </ZoomArea>

        {/* 편집 */}
        <div className="flex min-h-0 w-full shrink-0 flex-col overflow-y-auto border-t border-neutral-200 p-4 md:w-80 md:border-l md:border-t-0 md:p-5">
          <div className="mb-4 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="text-sm font-semibold">작업 편집</h3>
              {w.pages && w.pages.length > 0 ? (
                /* 편집 창은 첫 장만 띄운다 — 나머지 장은 공개 화면에서 이어 보인다 */
                <p className="mt-1 text-xs text-neutral-400">PDF {w.pages.length + 1}쪽</p>
              ) : (
                w.width &&
                w.height && (
                  <p className="mt-1 text-xs text-neutral-400">
                    {w.width} × {w.height}
                  </p>
                )
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

          {/* 제목은 숨겼다 — 설명만 선택으로 받는다. 칸(title)은 남겨 두고 저장된 값을 그대로 보낸다 */}
          <label className="block">
            <span className="mb-1.5 flex items-baseline justify-between text-xs font-medium text-neutral-600">
              <span>
                설명 <span className="font-normal text-neutral-400">(선택)</span>
              </span>
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
              className="w-full resize-none rounded-lg border border-neutral-300 px-3 py-2 text-sm leading-relaxed outline-none ring-violet-500 focus:ring-2"
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
              className="h-9 w-full rounded-lg border border-neutral-300 px-3 text-sm outline-none ring-violet-500 focus:ring-2"
            />
          </label>

          {/* AI 사용 여부 — 공개 화면에는 켠 것만 표기된다 */}
          <div className="mt-3 flex items-center gap-1.5">
            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={aiUsed}
                onChange={(e) => setAiUsed(e.target.checked)}
                className="accent-violet-600"
              />
              AI 사용
            </label>
            <InfoTip text="AI를 활용해 제작된 경우 체크해주세요" />
          </div>

          {/* SOOM 의뢰 여부 — 공개 화면에는 켠 것만 표기된다 */}
          <div className="mt-2 flex items-center gap-1.5">
            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={soomWork}
                onChange={(e) => setSoomWork(e.target.checked)}
                className="accent-violet-600"
              />
              SOOM에서 수행한 의뢰
            </label>
            <InfoTip text="SOOM을 통해 받은 의뢰의 결과물이면 체크해주세요" />
          </div>

          {/* 썸네일 — 목록에 실제로 깔리는 그림 */}
          <div className="mt-4 border-t border-neutral-200 pt-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-neutral-600">썸네일</span>
              <div className="flex flex-wrap justify-end gap-1.5">
                <input
                  ref={thumbFileRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) pickThumb(f)
                    e.target.value = ''
                  }}
                />
                <button
                  type="button"
                  onClick={() => thumbFileRef.current?.click()}
                  disabled={pending}
                  className="whitespace-nowrap rounded-md border border-neutral-300 px-2 py-1 text-[11px] font-medium text-neutral-700 transition hover:bg-neutral-100 disabled:opacity-40"
                >
                  파일시스템에서 업로드
                </button>
                {/* 영역을 잡는 중에는 켜진 모양으로 둔다 — 다시 눌러도 잡던 영역을 되돌리지 않는다 */}
                <button
                  type="button"
                  data-crop-keep
                  onClick={cropMode ? undefined : startCropMode}
                  aria-pressed={cropMode}
                  disabled={pending || !w.width || !w.height}
                  title={!w.width || !w.height ? '원본 크기를 몰라 영역을 잡을 수 없습니다' : undefined}
                  className={`whitespace-nowrap rounded-md border px-2 py-1 text-[11px] font-medium transition disabled:opacity-40 ${
                    cropMode
                      ? 'border-violet-600 text-violet-700'
                      : 'border-neutral-300 text-neutral-700 hover:bg-neutral-100'
                  }`}
                >
                  썸네일 편집
                </button>
              </div>
            </div>

            {cropMode && crop && previewParts ? (
              <div className="space-y-2.5">
                {/* 잡고 있는 영역 — 잡는 대로 바뀌고, 저장하면 이 그림이 썸네일이 된다 */}
                <CropPreview parts={previewParts} crop={crop} />
                <p className="text-[11px] leading-relaxed text-neutral-500">저장을 누르면 이 영역이 썸네일이 됩니다.</p>
              </div>
            ) : (
              <div className="flex items-start gap-3">
                {thumbUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={thumbUrl} alt="" className="size-20 shrink-0 rounded-lg object-cover ring-1 ring-neutral-200" />
                ) : (
                  <Img src={thumbSrc(w)} alt="" className="size-20 shrink-0 rounded-lg ring-1 ring-neutral-200" />
                )}
                <p className="min-w-0 text-[11px] leading-relaxed text-neutral-500">
                  {thumbFile ? (
                    <>
                      <span className="block truncate" title={thumbFile.name}>
                        {thumbFile.name}
                      </span>
                      저장을 누르면 이 이미지가 썸네일이 됩니다.
                    </>
                  ) : hasPages ? (
                    '썸네일 파일을 업로드 하지 않으면 첫 슬라이드가 썸네일로 저장됩니다.'
                  ) : (
                    '썸네일로 쓸 영역을 지정해 주세요.'
                  )}
                </p>
              </div>
            )}

            {cropMode && (
                <div data-crop-keep className="mt-2.5 flex flex-wrap gap-1.5">
                  {THUMB_RATIOS.map((r) => (
                    <label
                      key={r.key}
                      className={`flex cursor-pointer items-center gap-1 rounded-md border px-1.5 py-1 text-[11px] transition ${
                        ratio === r.key
                          ? 'border-violet-600 bg-violet-50 font-medium text-violet-700'
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
                        className="accent-violet-600"
                      />
                      {r.key}
                    </label>
                  ))}
                </div>
            )}
          </div>

          {/* 썸네일(잡은 영역·고른 파일)과 다른 칸을 함께 저장한다 */}
          <button
            onClick={save}
            disabled={pending || (!dirty && !thumbDirty)}
            className="mt-4 rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-600 disabled:opacity-40"
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
