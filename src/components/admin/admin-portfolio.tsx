'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { WorkRow } from '@/lib/portfolio-limits'
import { MAX_WORKS, MAX_DESCRIPTION, thumbSrc } from '@/lib/portfolio-limits'
import { WorkUploader } from '@/components/work-uploader'
import {
  adminAddWork,
  adminPrepareWorkUpload,
  adminPrepareWorkPages,
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
import { makeStackThumb, makeThumbFromUrl } from '@/lib/make-thumb'
import { stackOfWork } from '@/lib/work-stack'
import { Flash } from '@/components/flash'

export type Notice = { kind: 'ok' | 'error'; text: string } | null

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

      <Flash msg={notice} onDone={() => setNotice(null)} className="mb-4" />

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

                {/* 설명 */}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-2">

                    {!w.visible && (
                      <span className="rounded bg-neutral-200 px-1.5 py-0.5 text-[11px] text-neutral-600">
                        숨김
                      </span>
                    )}
                    {w.ai_used && (
                      <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[11px] text-violet-700">
                        AI 사용
                      </span>
                    )}
                    {w.ai_used === null && (
                      <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] text-amber-800">
                        AI 미응답
                      </span>
                    )}
                    {w.soom_work && (
                      <span className="rounded bg-neutral-900 px-1.5 py-0.5 text-[11px] text-white">
                        SOOM 의뢰
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

/* 어드민이 디자이너를 대신해 작업을 올린다 — 입력 창과 변환은 스튜디오와
   같은 것을 쓴다(work-uploader.tsx). 대신 올려주는 상황에서는 보통 묶음이라
   여러 장을 한 번에 고를 수 있고, AI 활용은 켠 채로 시작한다(요청). */
function AddWorkButton({
  designerId,
  disabled,
  onNotice,
}: {
  designerId: string
  disabled: boolean
  onNotice: (n: Notice) => void
}) {
  return (
    <WorkUploader
      actions={{
        prepareUpload: (name, size) => adminPrepareWorkUpload(designerId, name, size),
        preparePages: (files) => adminPrepareWorkPages(designerId, files),
        addWork: (form) => {
          form.set('designerId', designerId)
          return adminAddWork(form)
        },
      }}
      disabled={disabled}
      disabledTitle={`최대 ${MAX_WORKS}개까지 올릴 수 있습니다`}
      multiple
      aiDefault
      className="rounded-lg bg-neutral-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-violet-600 disabled:opacity-40"
      successText={(n) => `${n}개를 올렸습니다.`}
      onMessage={(m) => onNotice(m && { kind: m.ok ? 'ok' : 'error', text: m.text })}
    />
  )
}

/* ─────────── 상세 ─────────── */

export function WorkDialog({
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

  /* ─── 썸네일 영역 ───

     편집을 켜면 왼쪽의 원본 위에서 영역을 잡는다. 켜기 전에는 지금
     쓰이는 썸네일만 보여준다 — 늘 편집기를 띄우면 원본을 볼 수 없다. */
  const [cropMode, setCropMode] = useState(false)
  const [crop, setCrop] = useState<Crop | null>(cropOf(w))
  const [ratio, setRatio] = useState<RatioKey | null>(null)
  const [savingCrop, startCrop] = useTransition()

  const imgRatio = w.width && w.height ? w.width / w.height : 1
  /* PDF 로 올린 작업인지 — 둘째 장부터가 있을 때만 이어 붙여 보여 준다 */
  const hasPages = (w.pages?.length ?? 0) > 0
  /* 이어 붙인 전체로 영역을 잡을 수 있는 PDF 작업인지(work-stack.ts).
     전체 크기가 저장되기 전에 올라간 PDF 는 null — 첫 장에서만 잡는다 */
  const stack = stackOfWork(w)

  /* 아직 답하지 않은 작업(null)은 체크박스를 건드리지 않아도 저장할 수 있어야
     한다 — 끈 채로 저장하는 것이 '쓰지 않았다'는 답이다. null 을 false 와
     같다고 보면 저장 버튼이 잠겨 영원히 미응답으로 남는다. */
  const dirty =
    title !== (w.title ?? '') ||
    description !== (w.description ?? '') ||
    client !== (w.client ?? '') ||
    aiUsed !== w.ai_used ||
    soomWork !== (w.soom_work === true)

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
        {/* 이미지 — 원본을 크게 본다. 썸네일을 편집할 때는 이 위에서 영역을 잡는다.
            PDF 작업은 첫 장 아래로 나머지 장을 이어 붙여 내려 보며 확인하고,
            영역도 그 이어진 그림 어디에서나 잡는다. */}
        <div
          className={`flex min-h-0 flex-1 justify-center overflow-auto bg-neutral-100 p-3 ${
            hasPages && (!cropMode || stack) ? 'items-start' : 'items-center'
          }`}
        >
          {hasPages && !cropMode ? (
            <div className="w-full max-w-3xl space-y-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={w.image_url} alt={w.title ?? ''} className="block h-auto w-full bg-white" />
              {w.pages!.map((p) => (
                /* 크기를 미리 알고 있어 받아지기 전에도 자리를 잡는다 — 내려 보는 동안 밀리지 않는다 */
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  key={p.url}
                  src={p.url}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  style={{ aspectRatio: `${p.width} / ${p.height}` }}
                  className="block h-auto w-full bg-white"
                />
              ))}
            </div>
          ) : cropMode && crop ? (
            <CropEditor
              src={w.image_url}
              pages={stack ? w.pages! : undefined}
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
              rows={7}
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
                  {hasPages ? '썸네일 파일을 업로드 하지 않으면 첫 슬라이드가 썸네일로 저장됩니다.' : '썸네일로 쓸 영역을 지정해 주세요.'}
                </p>

                <div className="flex flex-wrap gap-1.5">
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
                          if (next && crop) {
                            setCrop(reshapeCrop(crop, ratioValue(next), imgRatio))
                          }
                        }}
                        className="accent-violet-600"
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
                      const thumb = stack
                        ? await makeStackThumb(stack, crop)
                        : await makeThumbFromUrl(w.image_url, crop)

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
                  className="w-full rounded-lg bg-neutral-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-violet-600 disabled:opacity-40"
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
                  {hasPages ? '썸네일 파일을 업로드 하지 않으면 첫 슬라이드가 썸네일로 저장됩니다.' : '썸네일로 쓸 영역을 지정해 주세요.'}
                </p>
              </div>
            )}
          </div>

          <button
            onClick={() =>
              act(
                () =>
                  adminUpdateWork({
                    id: w.id,
                    designerId,
                    title,
                    description,
                    client,
                    aiUsed,
                    soomWork,
                  }),
                () => onNotice({ kind: 'ok', text: '저장했습니다.' }),
              )
            }
            disabled={pending || !dirty}
            className="mt-3 rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-600 disabled:opacity-40"
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
