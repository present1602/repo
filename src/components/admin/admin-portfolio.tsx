'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { WorkRow } from '@/lib/portfolio-limits'
import { MAX_WORKS, MAX_DESCRIPTION, thumbSrc } from '@/lib/portfolio-limits'
import {
  adminAddWork,
  adminUpdateWork,
  adminSetWorkVisible,
  adminDeleteWork,
  adminReorderWorks,
  adminUpdateWorkCrop,
} from '@/app/admin/designers/actions'
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
import { makeThumb, makeThumbFromUrl } from '@/lib/make-thumb'

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

  /* ─── 순서 바꾸기 ───

     끄는 동안에는 화면에서만 자리를 옮기고, 손을 떼는 순간 한 번 저장한다.
     지나갈 때마다 저장하면 한 번 끌어도 요청이 수십 번 나간다.

     끄는 중에 쓸 순서만 따로 들고, 평소에는 서버가 준 works 를 그대로
     보여준다 — 서버 목록을 state 로 베껴 두면 추가·삭제 때마다
     둘을 맞추는 코드가 따라붙는다. */
  const [dragging, setDragging] = useState<{ id: string; ids: string[] } | null>(null)
  const [savingOrder, startSaving] = useTransition()
  const router = useRouter()

  const dragId = dragging?.id ?? null

  /* 화면에 그릴 순서. 끄는 중이면 그 순서를, 아니면 서버 순서를 쓴다.
     끄는 중 서버 목록이 바뀌면(다른 탭에서 삭제) 사라진 작업은 빼고
     새로 생긴 작업은 뒤에 붙여, 손에 쥔 자리는 지키면서 어긋남도 막는다. */
  const order = (() => {
    if (!dragging) return works
    const byId = new Map(works.map((w) => [w.id, w]))
    const kept = dragging.ids.map((id) => byId.get(id)).filter((w) => w != null)
    const known = new Set(kept.map((w) => w.id))
    return [...kept, ...works.filter((w) => !known.has(w.id))]
  })()

  /* 끌고 있는 행을 i 번째 자리로 옮긴다 */
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

  /* 손을 뗐다 — 바뀐 게 있으면 저장한다 */
  const commit = () => {
    const moved = dragging
    setDragging(null)
    if (!moved) return

    const before = works.map((w) => w.id).join()
    const after = moved.ids.join()
    if (before === after) return

    startSaving(async () => {
      const r = await adminReorderWorks(designerId, moved.ids)
      if (!r.ok) {
        /* 저장에 실패해도 화면은 서버 순서로 돌아간다 — dragging 을
           이미 비웠으므로 works 가 그대로 그려진다. */
        setNotice({ kind: 'error', text: r.error })
        return
      }
      router.refresh()
    })
  }

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
            {savingOrder && <span className="ml-1.5 text-neutral-400">· 순서 저장 중…</span>}
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
              className={`flex items-stretch bg-white transition ${
                dragId === w.id ? 'opacity-40' : 'hover:bg-neutral-50'
              }`}
            >
              {/* 끌기 손잡이 — 여기서만 끌 수 있다.
                  행 전체를 draggable 로 두면 상세로 들어가려는 클릭이
                  자꾸 드래그로 먹힌다. */}
              <span
                draggable
                onDragStart={(e) => {
                  /* 시작 시점의 순서를 함께 담는다 — 이후 자리 이동은
                     이 배열을 고쳐 나간다 */
                  setDragging({ id: w.id, ids: works.map((x) => x.id) })
                  e.dataTransfer.effectAllowed = 'move'
                  /* Firefox 는 데이터가 없으면 드래그를 시작하지 않는다 */
                  e.dataTransfer.setData('text/plain', w.id)
                }}
                onDragEnd={commit}
                aria-label="끌어서 순서 바꾸기"
                title="끌어서 순서 바꾸기"
                className="flex w-8 shrink-0 cursor-grab touch-none items-center justify-center text-neutral-300 hover:text-neutral-600 active:cursor-grabbing"
              >
                <svg viewBox="0 0 16 16" fill="currentColor" className="size-4">
                  {[4, 8, 12].map((cy) =>
                    [6, 10].map((cx) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1.3" />),
                  )}
                </svg>
              </span>

              <button
                onClick={() => setOpenId(w.id)}
                className="flex min-w-0 flex-1 items-start gap-4 py-3.5 pr-3.5 text-left"
              >
                {/* 썸네일 — 64~80px 자리이므로 작게 만들어 둔 파일을 쓴다 */}
                <Img
                  src={thumbSrc(w)}
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

      {works.length > 1 && (
        <p className="mt-3 text-xs text-neutral-400">
          왼쪽 손잡이를 끌어 순서를 바꿀 수 있습니다. 이 순서가 공개 화면에도 그대로
          쓰입니다.
        </p>
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

   여러 장을 한 번에 고를 수 있다 — 대신 올려주는 상황에서는 보통 묶음이다.
   고른 뒤에는 한 장씩 차례로 확인한다. 썸네일 영역은 사진마다 다르므로
   묶음 전체에 한 번만 물을 수 없다. */
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
  const router = useRouter()

  /* 아직 올리지 않은 파일들 — 맨 앞이 지금 편집 중인 장이다 */
  const [queue, setQueue] = useState<File[]>([])
  /* 묶음에서 지금까지 올린 장수 — 진행 상황을 보여준다 */
  const [done, setDone] = useState(0)
  const [failed, setFailed] = useState<string[]>([])

  const current = queue[0] ?? null
  const total = done + queue.length + failed.length

  /* 한 장을 올리고 다음 장으로 넘어간다.
     묶음이 끝나면(큐가 비면) 결과를 한 줄로 알린다. */
  const uploadOne = (file: File, opts: UploadOpts) => {
    onNotice(null)
    start(async () => {
      /* 목록에서 쓸 작은 이미지를 먼저 만든다 — 영역을 잡아 뒀으면
         그 부분만 자른다. 실패해도 그냥 올린다(make-thumb.ts). */
      const thumb = await makeThumb(file, opts.crop)

      const form = new FormData()
      form.set('designerId', designerId)
      form.set('image', file)
      if (thumb) form.set('thumb', thumb.file)
      /* 파일명을 제목의 출발점으로 쓴다 — 확장자는 뗀다.
         어드민이 여러 장을 올릴 때 하나하나 제목을 적기 어렵다. */
      form.set('title', file.name.replace(/\.[^.]+$/, ''))
      if (opts.width) form.set('width', String(opts.width))
      if (opts.height) form.set('height', String(opts.height))
      /* 답했다는 사실과 답 자체를 따로 보낸다 — 체크하지 않은 체크박스는
         브라우저가 전송하지 않아 '아니오'와 '묻지 않음'이 구분되지 않는다. */
      form.set('aiAnswered', '1')
      if (opts.aiUsed) form.set('aiUsed', '1')
      if (opts.crop) {
        form.set('cropX', String(opts.crop.x))
        form.set('cropY', String(opts.crop.y))
        form.set('cropW', String(opts.crop.w))
        form.set('cropH', String(opts.crop.h))
      }

      const r = await adminAddWork(form)

      const rest = queue.slice(1)
      const nextFailed = r.ok ? failed : [...failed, `${file.name}: ${r.error}`]
      const nextDone = r.ok ? done + 1 : done

      /* 상한에 걸렸으면 남은 장도 전부 실패한다 — 큐를 비워 멈춘다 */
      const stop = !r.ok && r.error.includes('최대')
      const remaining = stop ? [] : rest

      setDone(nextDone)
      setFailed(nextFailed)
      setQueue(remaining)
      router.refresh()

      if (remaining.length > 0) return

      /* 묶음 끝 — 결과를 알리고 상태를 비운다 */
      if (nextFailed.length === 0) {
        onNotice({ kind: 'ok', text: `${nextDone}개를 올렸습니다.` })
      } else if (nextDone === 0) {
        onNotice({ kind: 'error', text: nextFailed[0] })
      } else {
        onNotice({
          kind: 'error',
          text: `${nextDone}개 성공 · ${nextFailed.length}개 실패 (${nextFailed[0]})`,
        })
      }
      setDone(0)
      setFailed([])
    })
  }

  /* 지금 장을 건너뛴다 — 고르고 보니 올릴 것이 아니었을 때 */
  const skip = () => {
    const rest = queue.slice(1)
    setQueue(rest)
    if (rest.length > 0) return

    if (done > 0 || failed.length > 0) {
      onNotice(
        failed.length > 0
          ? { kind: 'error', text: `${done}개 성공 · ${failed.length}개 실패 (${failed[0]})` }
          : { kind: 'ok', text: `${done}개를 올렸습니다.` },
      )
    }
    setDone(0)
    setFailed([])
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
            setQueue(files)
            setDone(0)
            setFailed([])
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
        {pending ? '올리는 중…' : '작업 추가'}
      </button>

      {current && (
        <UploadDialog
          /* 파일이 바뀌면 편집 상태를 처음부터 다시 잡는다 —
             앞 장에서 잡아 둔 영역이 다음 장에 남으면 엉뚱한 곳이 잘린다 */
          key={`${current.name}-${current.size}-${queue.length}`}
          file={current}
          index={done + failed.length}
          total={total}
          pending={pending}
          onCancel={skip}
          onConfirm={(opts) => uploadOne(current, opts)}
        />
      )}
    </>
  )
}

/* ─────────── 업로드 다이얼로그 ───────────

   좌측에 원본을 크게 띄우고, 우측에 올리기 버튼과 설정을 둔다.
   썸네일 영역은 좌측 미리보기 위에서 직접 잡는다. */

type UploadOpts = {
  width: number | null
  height: number | null
  aiUsed: boolean
  crop: Crop | null
}

function UploadDialog({
  file,
  index,
  total,
  pending,
  onCancel,
  onConfirm,
}: {
  file: File
  index: number
  total: number
  pending: boolean
  onCancel: () => void
  onConfirm: (o: UploadOpts) => void
}) {
  /* 미리보기 URL — 파일 하나에 하나다. 바깥에서 key 로 파일마다 새
     인스턴스를 만들므로(AddWorkButton) 여기서 다시 만들 일이 없다.

     돌려주는(revoke) 일은 하지 않는다. Strict Mode 는 effect 를 한 번 더
     돌리는데, 정리에서 돌려주면 재실행 때 이미 죽은 URL 이 남아 미리보기가
     영영 뜨지 않는다. blob 은 문서가 사라질 때 함께 해제되고, 업로드
     다이얼로그는 한 번에 하나라 쌓이지도 않는다. */
  const [url] = useState(() => URL.createObjectURL(file))
  const [size, setSize] = useState<{ width: number; height: number } | null>(null)
  /* 크기를 못 읽었는지 — 못 읽어도 미리보기와 업로드는 되어야 한다 */
  const [measureFailed, setMeasureFailed] = useState(false)

  /* 요청대로 기본 체크 상태로 시작한다 */
  const [aiUsed, setAiUsed] = useState(true)

  /* 썸네일 영역 — 켜기 전에는 null 이라 원본 전체가 쓰인다 */
  const [cropOn, setCropOn] = useState(false)
  const [crop, setCrop] = useState<Crop | null>(null)
  /* 고른 비율. null 이면 자유 비율이다 — 체크를 끄면 여기로 돌아온다. */
  const [ratio, setRatio] = useState<RatioKey | null>(null)

  /* 원본 크기를 읽는다 — 브라우저가 이미지를 다 받은 뒤에야 알 수 있어
     외부 시스템 구독에 해당한다. 영역 계산과 row_span 에 쓰인다.

     실패해도 막지 않는다. 크기는 썸네일 자리를 미리 잡는 용도라
     없으면 서버가 null 로 받아 기존 규칙대로 처리한다(work-ratio.ts). */
  useEffect(() => {
    let alive = true
    const img = new Image()
    img.onload = () => {
      if (!alive) return
      setSize({ width: img.naturalWidth, height: img.naturalHeight })
      setMeasureFailed(false)
    }
    img.onerror = () => {
      if (!alive) return
      setSize(null)
      setMeasureFailed(true)
    }
    img.src = url

    return () => {
      alive = false
    }
  }, [url])

  /* Esc 로 닫고, 열려 있는 동안 뒤쪽 목록이 스크롤되지 않게 한다 */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !pending) onCancel()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onCancel, pending])

  const imgRatio = size ? size.width / size.height : 1

  /* 영역 지정을 켜면 가운데에 기본 영역을 깔아 둔다 —
     빈 화면에서 직접 끌어 만들게 하면 처음 쓰는 사람이 막힌다. */
  const toggleCrop = (on: boolean) => {
    setCropOn(on)
    if (!on) {
      setCrop(null)
      setRatio(null)
      return
    }
    setCrop(crop ?? centeredCrop(imgRatio, imgRatio))
  }

  /* 비율 체크박스 — 같은 것을 다시 누르면 고정이 풀린다(자유 비율).
     다른 것을 누르면 기존 선택은 자동으로 해제된다. */
  const pickRatio = (key: RatioKey) => {
    const next = ratio === key ? null : key
    setRatio(next)
    if (next == null || !crop) return
    setCrop(reshapeCrop(crop, ratioValue(next), imgRatio))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-white md:flex-row">
        {/* 좌측 — 미리보기. 영역 지정을 켜면 여기서 직접 잡는다.

            크기를 읽는 중이거나 못 읽었더라도 이미지는 그린다 —
            측정은 썸네일 자리를 잡는 보조 정보일 뿐인데, 그것 때문에
            미리보기까지 막으면 무엇을 올리는지 볼 수 없다. */}
        <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-neutral-100 p-4">
          {cropOn && crop ? (
            <CropEditor
              src={url}
              crop={crop}
              onChange={setCrop}
              lockedRatio={ratio == null ? null : ratioValue(ratio)}
              imgRatio={imgRatio}
            />
          ) : (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={url} alt="" className="max-h-[70vh] w-auto object-contain" />
          )}
        </div>

        {/* 우측 — 올리기 버튼과 설정 */}
        <div className="flex w-full shrink-0 flex-col overflow-y-auto border-t border-neutral-200 p-5 md:w-80 md:border-l md:border-t-0">
          <div>
            <h3 className="text-sm font-semibold">작업 올리기</h3>
            <p className="mt-1 truncate text-xs text-neutral-500" title={file.name}>
              {file.name}
            </p>
            <p className="mt-0.5 text-xs text-neutral-400">
              {total > 1 && `${index + 1} / ${total}장 · `}
              {size
                ? `${size.width} × ${size.height}`
                : measureFailed
                  ? '크기를 읽지 못했습니다'
                  : '크기 확인 중…'}
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              onConfirm({
                width: size?.width ?? null,
                height: size?.height ?? null,
                aiUsed,
                crop: cropOn ? crop : null,
              })
            }
            /* 크기를 못 읽었어도 올릴 수 있다 — 서버가 null 로 받아
               기존 규칙대로 자리를 잡는다. 읽는 중일 때만 잠깐 막는다. */
            disabled={pending || (size == null && !measureFailed)}
            className="mt-4 rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-600 disabled:opacity-40"
          >
            {pending ? '올리는 중…' : '업로드'}
          </button>

          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="mt-2 rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100 disabled:opacity-50"
          >
            {total > 1 ? '이 장 건너뛰기' : '취소'}
          </button>

          {/* AI 활용 — 기본 체크 */}
          <label className="mt-5 flex cursor-pointer items-start gap-2.5 rounded-lg border border-neutral-300 p-3">
            <input
              type="checkbox"
              checked={aiUsed}
              onChange={(e) => setAiUsed(e.target.checked)}
              disabled={pending}
              className="mt-0.5 accent-indigo-600"
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium">AI 활용</span>
              <span className="mt-0.5 block text-xs leading-relaxed text-neutral-500">
                켜면 공개 화면에 AI 활용 표기가 붙습니다.
              </span>
            </span>
          </label>

          {/* 썸네일 영역 */}
          <div className="mt-3 rounded-lg border border-neutral-300 p-3">
            <label className="flex cursor-pointer items-start gap-2.5">
              <input
                type="checkbox"
                checked={cropOn}
                onChange={(e) => toggleCrop(e.target.checked)}
                disabled={pending || size == null}
                className="mt-0.5 accent-indigo-600"
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium">썸네일 영역 지정</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-neutral-500">
                  {measureFailed
                    ? /* 원본 비율을 모르면 영역의 실제 비율을 계산할 수 없다 */
                      '원본 크기를 읽지 못해 영역을 잡을 수 없습니다. 올린 뒤 다시 시도해 주세요.'
                    : cropOn
                      ? '왼쪽에서 영역을 끌어 옮기고 핸들로 크기를 맞춥니다.'
                      : '끄면 원본 전체가 쓰입니다.'}
                </span>
              </span>
            </label>

            {cropOn && (
              <div className="mt-3 border-t border-neutral-200 pt-3">
                <p className="text-xs font-medium text-neutral-600">썸네일 비율</p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-neutral-400">
                  체크하면 그 비율로 고정됩니다. 다시 누르면 자유 비율로 돌아갑니다.
                </p>

                <div className="mt-2 flex flex-wrap gap-1.5">
                  {THUMB_RATIOS.map((r) => (
                    <label
                      key={r.key}
                      className={`flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1.5 text-xs transition ${
                        ratio === r.key
                          ? 'border-indigo-600 bg-indigo-50 font-medium text-indigo-700'
                          : 'border-neutral-300 hover:bg-neutral-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={ratio === r.key}
                        onChange={() => pickRatio(r.key)}
                        disabled={pending}
                        className="accent-indigo-600"
                      />
                      {r.key}
                    </label>
                  ))}
                </div>

                {ratio != null && (
                  <p className="mt-2 text-[11px] leading-relaxed text-neutral-500">
                    비율이 고정돼 있어 대각선 핸들로만 크기를 바꿉니다.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
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

  /* ─── 썸네일 영역 ───

     편집을 켜면 왼쪽의 원본 위에서 영역을 잡는다. 켜기 전에는 지금
     쓰이는 썸네일만 보여준다 — 늘 편집기를 띄우면 원본을 볼 수 없다. */
  const [cropMode, setCropMode] = useState(false)
  const [crop, setCrop] = useState<Crop | null>(cropOf(w))
  const [ratio, setRatio] = useState<RatioKey | null>(null)
  const [savingCrop, startCrop] = useTransition()

  const imgRatio = w.width && w.height ? w.width / w.height : 1

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
        {/* 이미지 — 원본을 크게 본다. 썸네일을 편집할 때는 이 위에서 영역을 잡는다. */}
        <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-neutral-100 p-3">
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
              className="max-h-[52vh] w-auto max-w-full object-contain md:max-h-[84vh]"
            />
          )}
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

          {/* 썸네일 — 목록에 실제로 깔리는 그림. 영역을 고치면 파일을 다시 만든다. */}
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
                    /* 영역을 잡은 적이 없으면 가운데에 기본값을 깔아 준다 */
                    setCrop(centeredCrop(imgRatio, imgRatio))
                  }
                  setCropMode((v) => !v)
                }}
                disabled={savingCrop || !w.width || !w.height}
                title={
                  !w.width || !w.height
                    ? '원본 크기를 몰라 영역을 잡을 수 없습니다'
                    : undefined
                }
                className="rounded-md border border-neutral-300 px-2 py-1 text-[11px] font-medium text-neutral-700 transition hover:bg-neutral-100 disabled:opacity-40"
              >
                {cropMode ? '취소' : '썸네일 편집'}
              </button>
            </div>

            {cropMode ? (
              <div className="space-y-2.5">
                <p className="text-[11px] leading-relaxed text-neutral-500">
                  왼쪽에서 영역을 끌어 옮기고 핸들로 크기를 맞춥니다.
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
                          if (next && crop) {
                            setCrop(reshapeCrop(crop, ratioValue(next), imgRatio))
                          }
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
                      onNotice(null)
                      /* 자르는 일은 여기서 한다 — 서버는 받은 파일을 저장만 한다.
                         원본을 다시 받아 잘라야 하므로 잠시 걸린다. */
                      const thumb = await makeThumbFromUrl(w.image_url, crop)

                      const form = new FormData()
                      form.set('id', w.id)
                      form.set('designerId', designerId)
                      form.set('cropX', String(crop.x))
                      form.set('cropY', String(crop.y))
                      form.set('cropW', String(crop.w))
                      form.set('cropH', String(crop.h))
                      if (thumb) form.set('thumb', thumb.file)

                      const r = await adminUpdateWorkCrop(form)
                      if (!r.ok) {
                        onNotice({ kind: 'error', text: r.error })
                        return
                      }
                      setCropMode(false)
                      setRatio(null)
                      router.refresh()
                      onNotice({
                        kind: 'ok',
                        text: thumb ? '썸네일을 바꿨습니다.' : '영역만 저장했습니다(썸네일 생성 실패).',
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
