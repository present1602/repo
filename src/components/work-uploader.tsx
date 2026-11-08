'use client'

/* 포트폴리오 작업 올리기 — 스튜디오(본인)와 어드민(대신 올리기)이 같이 쓴다.

   파일을 고르면 바로 올리지 않고 입력 창부터 띄운다 — 설명·클라이언트·AI·
   SOOM·노출·썸네일을 다 정한 뒤 '저장'을 눌러야 그때 올라간다. 예전에는
   이미지부터 올라가고 편집에서 정보를 채웠는데, 무엇을 더 해야 하는지
   몰라 숨김 상태로 남는 작업이 많았다.

   여러 장을 한 번에 고르면 한 장씩 차례로 묻는다 — 설명과 썸네일 영역은
   작업마다 다르므로 묶음 전체에 한 번만 물을 수 없다.

   고르는 즉시 올릴 수 있는 모양으로 바꿔 둔다(work-file.ts) — PDF 는 장마다
   이미지로, 50MB 를 넘는 이미지는 줄여서. 입력 창에는 바꾼 결과를 띄우므로
   실제로 올라갈 그림을 보고 썸네일 영역을 잡는다.

   서버 액션은 화면마다 다르다(본인은 세션, 어드민은 designerId) — 부르는 쪽이
   넘겨준다. */

import { useEffect, useRef, useState } from 'react'
import { useActionTransition } from '@/lib/use-action-transition'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { MAX_DESCRIPTION, WORK_FILE_EXTS } from '@/lib/portfolio-limits'
import { type PreparedWork, isPdf, pagesField, prepareWorkFile, uploadAll } from '@/lib/work-file'
import {
  type Crop,
  type RatioKey,
  THUMB_RATIOS,
  centeredCrop,
  clampCrop,
  insetCrop,
  ratioValue,
  reshapeCrop,
} from '@/lib/crop'
import { makeStackThumb, makeThumb } from '@/lib/make-thumb'
import { firstPageCrop, stackSize } from '@/lib/work-stack'
import { DESIGNER_IMAGES_BUCKET, uploadSigned } from '@/lib/direct-upload'
import { CropEditor, CropPreview } from '@/components/admin/crop-editor'
import { StackView, ZoomArea, type ZoomAreaHandle } from '@/components/zoom-area'

type Signed = { ok: true; path: string; token: string } | { ok: false; error: string }
type SignedMany = { ok: true; uploads: { path: string; token: string }[] } | { ok: false; error: string }

export type WorkUploaderActions = {
  prepareUpload: (name: string, size: number) => Promise<Signed>
  preparePages: (files: { name: string; size: number }[]) => Promise<SignedMany>
  addWork: (form: FormData) => Promise<{ ok: true } | { ok: false; error: string }>
}

/* 대기열 한 칸 — 고른 파일 이름과 바꾼 결과 */
type Queued = PreparedWork & { name: string }

export function WorkUploader({
  actions,
  disabled,
  disabledTitle,
  multiple = false,
  aiDefault,
  className,
  label = '작업 추가',
  successText,
  onMessage,
}: {
  actions: WorkUploaderActions
  disabled: boolean
  disabledTitle?: string
  multiple?: boolean
  /* AI 활용 체크의 처음 상태 — 어드민은 켠 채로 시작한다(요청) */
  aiDefault: boolean
  className: string
  label?: string
  /* 묶음을 다 올렸을 때 알릴 말 */
  successText: (count: number) => string
  onMessage: (m: { ok: boolean; text: string } | null) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [pending, start] = useActionTransition()
  const router = useRouter()

  /* 아직 올리지 않은 파일들 — 맨 앞이 지금 입력 중인 장이다 */
  const [queue, setQueue] = useState<Queued[]>([])
  /* 고른 파일을 바꾸거나 올리는 중 — PDF 는 오래 걸려 글자로 알린다 */
  const [status, setStatus] = useState<string | null>(null)
  /* PDF 를 이미지로 바꾸는 중 — 길면 수십 초 걸려 화면 전체를 덮어 알린다 */
  const [converting, setConverting] = useState(false)
  /* 묶음에서 지금까지 올린 장수 — 진행 상황을 보여준다 */
  const [done, setDone] = useState(0)
  const [failed, setFailed] = useState<string[]>([])

  const current = queue[0] ?? null
  const total = done + queue.length + failed.length

  /* 묶음이 끝났을 때 — 결과를 한 줄로 알리고 상태를 비운다 */
  const finish = (nextDone: number, nextFailed: string[]) => {
    if (nextFailed.length === 0) {
      if (nextDone > 0) onMessage({ ok: true, text: successText(nextDone) })
    } else if (nextDone === 0) {
      onMessage({ ok: false, text: nextFailed[0] })
    } else {
      onMessage({ ok: false, text: `${nextDone}개 성공 · ${nextFailed.length}개 실패 (${nextFailed[0]})` })
    }
    setDone(0)
    setFailed([])
  }

  /* 한 장을 올리고 다음 장으로 넘어간다 */
  const uploadOne = ({ name, file, pages }: Queued, o: UploadOpts) => {
    onMessage(null)
    start(async () => {
      setStatus('올리는 중…')
      /* 원본은 서명 주소로 바로 올린다 — 서버 액션은 본문 1MB 제한에 걸린다(direct-upload.ts) */
      const prep = await actions.prepareUpload(file.name, file.size)
      /* PDF 의 둘째 장부터는 주소를 한 번에 받는다 */
      const pagePrep = prep.ok
        ? await actions.preparePages(pages.map((p) => ({ name: p.file.name, size: p.file.size })))
        : prep

      /* 썸네일 — 따로 고른 이미지가 있으면 그것을 통째로 줄이고, 아니면 올릴
         그림에서 영역만큼 자른다. PDF 는 이어 붙인 장 어디서든 자른다(영역이
         없으면 첫 장). 실패해도 그냥 올린다(make-thumb.ts) */
      const makeOwnThumb = () =>
        pages.length > 0 && o.crop && o.firstSize
          ? makeStackThumb(
              [
                { src: file, ...o.firstSize },
                ...pages.map((p) => ({ src: p.file, width: p.width, height: p.height })),
              ],
              o.crop,
            )
          : makeThumb(file, o.crop)
      const [sent, thumb, pagesSent] =
        prep.ok && pagePrep.ok
          ? await Promise.all([
              uploadSigned(DESIGNER_IMAGES_BUCKET, prep, file),
              o.thumbFile ? makeThumb(o.thumbFile, null) : makeOwnThumb(),
              uploadAll(pages.map((p, i) => () => uploadSigned(DESIGNER_IMAGES_BUCKET, pagePrep.uploads[i], p.file))),
            ])
          : [false, null, false]

      const form = new FormData()
      if (prep.ok) form.set('imagePath', prep.path)
      if (pagePrep.ok && pages.length > 0) form.set('pages', pagesField(pages, pagePrep.uploads.map((u) => u.path)))
      if (thumb) form.set('thumb', thumb.file)
      if (o.width) form.set('width', String(o.width))
      if (o.height) form.set('height', String(o.height))
      form.set('description', o.description)
      form.set('client', o.client)
      /* 답했다는 사실과 답 자체를 따로 보낸다 — 체크하지 않은 체크박스는
         브라우저가 전송하지 않아 '아니오'와 '묻지 않음'이 구분되지 않는다. */
      form.set('aiAnswered', '1')
      if (o.aiUsed) form.set('aiUsed', '1')
      if (o.soomWork) form.set('soomWork', '1')
      form.set('visible', o.visible ? '1' : '0')
      /* 영역은 썸네일 자리 비율로도 쓰인다(목록·카드) — 다이얼로그가 정해 보낸다 */
      if (o.crop) {
        form.set('cropX', String(o.crop.x))
        form.set('cropY', String(o.crop.y))
        form.set('cropW', String(o.crop.w))
        form.set('cropH', String(o.crop.h))
      }

      const r = !prep.ok
        ? prep
        : !pagePrep.ok
          ? pagePrep
          : !sent || !pagesSent
            ? { ok: false as const, error: '파일을 올리지 못했습니다. 잠시 후 다시 시도해 주세요.' }
            : await actions.addWork(form)
      setStatus(null)

      const nextFailed = r.ok ? failed : [...failed, total > 1 ? `${name}: ${r.error}` : r.error]
      const nextDone = r.ok ? done + 1 : done

      /* 한 장뿐이면 실패해도 창을 닫지 않는다 — 적어 둔 설명을 날리지 않고
         다시 저장해 볼 수 있게. 묶음이면 다음 장으로 넘어간다. */
      if (!r.ok && total === 1) {
        onMessage({ ok: false, text: r.error })
        return
      }

      /* 상한에 걸렸으면 남은 장도 전부 실패한다 — 큐를 비워 멈춘다 */
      const stop = !r.ok && r.error.includes('최대')
      const remaining = stop ? [] : queue.slice(1)

      setDone(nextDone)
      setFailed(nextFailed)
      setQueue(remaining)
      router.refresh()

      if (remaining.length === 0) finish(nextDone, nextFailed)
    }, '포트폴리오 업로드')
  }

  /* 지금 장을 건너뛴다 — 고르고 보니 올릴 것이 아니었을 때 */
  const skip = () => {
    const rest = queue.slice(1)
    setQueue(rest)
    if (rest.length === 0) finish(done, failed)
  }

  /* 고른 파일을 차례로 바꿔 대기열에 넣는다. 못 쓰는 파일(형식·크기·깨진 PDF)은
     빼고 토스트로 알린다 — 나머지는 그대로 이어서 묻는다. */
  /* 고른 파일을 바꾸는 중 — transition 으로 감싸지 않는다. 그 안의 상태 변경은
     작업이 끝날 때까지 화면에 나오지 않아, 변환 중 알림이 한 번도 뜨지 않는다 */
  const [picking, setPicking] = useState(false)
  const pick = (files: File[]) => {
    onMessage(null)
    setPicking(true)
    void (async () => {
      const ready: Queued[] = []
      const rejected: string[] = []
      for (const [i, f] of files.entries()) {
        const head = files.length > 1 ? `${i + 1}/${files.length} · ` : ''
        setStatus(`${head}준비 중…`)
        setConverting(isPdf(f))
        const r = await prepareWorkFile(f, (t) => setStatus(head + t))
        setConverting(false)
        if (r.ok) ready.push({ name: f.name, file: r.file, pages: r.pages })
        else rejected.push(files.length > 1 ? `${f.name}: ${r.error}` : r.error)
      }
      setStatus(null)

      if (rejected.length > 0) {
        onMessage({
          ok: false,
          text: rejected.length === 1 ? rejected[0] : `${rejected.length}개를 뺐습니다 (${rejected[0]})`,
        })
      }
      if (ready.length > 0) {
        setQueue(ready)
        setDone(0)
        setFailed([])
      }
      setPicking(false)
    })()
  }

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept={WORK_FILE_EXTS.map((e) => `.${e}`).join(',')}
        multiple={multiple}
        hidden
        onChange={(e) => {
          const files = Array.from(e.target.files ?? [])
          if (files.length > 0) pick(files)
          /* 같은 파일을 다시 고를 수 있게 비운다 */
          e.target.value = ''
        }}
      />
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={disabled || pending || picking}
        title={disabled ? disabledTitle : undefined}
        className={className}
      >
        {(pending || picking) && !current ? (status ?? '준비 중…') : label}
      </button>

      {converting && <ConvertingOverlay />}

      {current && (
        <UploadDialog
          /* 파일이 바뀌면 입력 상태를 처음부터 다시 잡는다 —
             앞 장에서 적은 설명·영역이 다음 장에 남으면 엉뚱하게 저장된다 */
          key={`${current.name}-${current.file.size}-${queue.length}`}
          item={current}
          index={done + failed.length}
          total={total}
          pending={pending}
          status={status}
          aiDefault={aiDefault}
          onCancel={skip}
          onConfirm={(o) => uploadOne(current, o)}
        />
      )}
    </>
  )
}

/* PDF 변환 중 — 화면 전체를 어둡게 덮어 다른 조작을 막고 가운데에 알린다.
   점 셋이 차례로 튀어 멈춘 게 아님을 보인다. body 에 붙인다 — 버튼 둘레의
   쌓임 맥락에 갇히면 다이얼로그·헤더 아래로 깔린다. */
function ConvertingOverlay() {
  return createPortal(
    <div
      role="alertdialog"
      aria-busy="true"
      aria-live="polite"
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/55 px-4 backdrop-blur-[1px]"
    >
      <div className="rounded-2xl bg-white px-8 py-7 text-center shadow-xl">
        <div className="flex h-6 items-end justify-center gap-2" aria-hidden>
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="size-2.5 animate-bounce rounded-full bg-violet-600"
              style={{ animationDelay: `${i * 160}ms` }}
            />
          ))}
        </div>
        <p className="mt-4 text-sm font-medium leading-relaxed text-neutral-800">
          PDF를 이미지로 변환중입니다.
          <br />
          다소 시간이 소요될 수 있습니다.
        </p>
      </div>
    </div>,
    document.body,
  )
}

/* ─────────── 입력 다이얼로그 ───────────

   편집 창(작업 편집)과 같은 짜임이다 — 좌측에 올릴 그림을 크게 띄우고
   우측에서 정보를 적는다. PDF 는 좌측에서 장을 내려 보며 확인한다.
   썸네일 영역은 좌측 첫 장 위에서 직접 잡는다. */

type UploadOpts = {
  /* 작업 크기 — PDF 면 장을 이어 붙인 전체 크기(work-stack.ts) */
  width: number | null
  height: number | null
  /* PDF 첫 장의 실제 크기 — 이어 붙인 그림에서 썸네일을 자를 때 쓴다 */
  firstSize: { width: number; height: number } | null
  description: string
  client: string
  aiUsed: boolean
  soomWork: boolean
  visible: boolean
  crop: Crop | null
  /* 썸네일로 따로 고른 이미지 — 있으면 영역 대신 이것을 줄여 쓴다 */
  thumbFile: File | null
}

function UploadDialog({
  item,
  index,
  total,
  pending,
  status,
  aiDefault,
  onCancel,
  onConfirm,
}: {
  item: Queued
  index: number
  total: number
  pending: boolean
  status: string | null
  aiDefault: boolean
  onCancel: () => void
  onConfirm: (o: UploadOpts) => void
}) {
  /* 미리보기 URL — 파일 하나에 하나다. 바깥에서 key 로 파일마다 새
     인스턴스를 만들므로 여기서 다시 만들 일이 없다.

     돌려주는(revoke) 일은 하지 않는다. Strict Mode 는 effect 를 한 번 더
     돌리는데, 정리에서 돌려주면 재실행 때 이미 죽은 URL 이 남아 미리보기가
     영영 뜨지 않는다. blob 은 문서가 사라질 때 함께 해제된다. */
  const [url] = useState(() => URL.createObjectURL(item.file))
  const [pageUrls] = useState(() => item.pages.map((p) => URL.createObjectURL(p.file)))
  const [size, setSize] = useState<{ width: number; height: number } | null>(null)
  /* 크기를 못 읽었는지 — 못 읽어도 미리보기와 업로드는 되어야 한다 */
  const [measureFailed, setMeasureFailed] = useState(false)

  const [description, setDescription] = useState('')
  const [client, setClient] = useState('')
  const [aiUsed, setAiUsed] = useState(aiDefault)
  /* SOOM 의뢰 여부 — 해당할 때만 켜는 표시라 꺼진 채로 시작한다 */
  const [soomWork, setSoomWork] = useState(false)
  /* 정보를 다 적고 올리는 것이므로 바로 공개로 시작한다 — 끄면 숨긴 채로 들어간다 */
  const [visible, setVisible] = useState(true)

  /* 썸네일 — 영역을 잡거나(cropOn), 이미지를 따로 고르거나(thumbFile), 둘 다
     아니면 올릴 그림 전체를 줄여 쓴다(PDF 는 첫 장). 둘은 하나만 쓴다.
     영역은 잡는 대로 오른쪽 미리보기에 비치고, '저장'을 누를 때 함께 올라간다. */
  const [cropOn, setCropOn] = useState(false)
  const [crop, setCrop] = useState<Crop | null>(null)
  /* 고른 비율. null 이면 자유 비율이다 — 체크를 끄면 여기로 돌아온다. */
  const [ratio, setRatio] = useState<RatioKey | null>(null)
  /* 왼쪽 그림 칸 — 키워 둔 채 영역 지정을 켜면 보이는 부분에 처음 영역을 잡는다 */
  const zoomRef = useRef<ZoomAreaHandle>(null)
  /* PDF 둘째 장부터 — 보기와 영역 잡기가 같은 그림을 쓴다 */
  const pageParts = item.pages.map((p, i) => ({ url: pageUrls[i], width: p.width, height: p.height }))
  const [thumbFile, setThumbFile] = useState<File | null>(null)
  const [thumbUrl, setThumbUrl] = useState<string | null>(null)
  const thumbRef = useRef<HTMLInputElement>(null)

  /* 원본 크기를 읽는다 — 브라우저가 이미지를 다 받은 뒤에야 알 수 있다.
     영역 계산과 row_span 에 쓰인다. 실패해도 막지 않는다 — 서버가 null 로
     받아 기존 규칙대로 처리한다(work-thumb.tsx). */
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
      /* 썸네일 영역을 잡는 동안에는 Esc 로 닫지 않는다 — 잡던 영역과 적은 내용이 날아간다 */
      if (e.key === 'Escape' && !pending && !cropOn) onCancel()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onCancel, pending, cropOn])

  const isPdf = item.pages.length > 0
  /* 영역을 잡는 그림 — PDF 는 장을 이어 붙인 전체(work-stack.ts) */
  const whole = size && isPdf ? stackSize(size, item.pages) : size
  const imgRatio = whole ? whole.width / whole.height : 1
  /* 영역을 잡지 않은 PDF 는 첫 장이 썸네일이 된다 */
  const firstCrop = size && isPdf ? firstPageCrop(size, item.pages) : null

  /* 영역 지정 시작 — 지금 스크롤로 보고 있는 부분 안에 새 영역을 잡는다.
     긴 그림에서 화면 밖의 기존 영역을 찾아 내려가지 않아도 된다.
     따로 고른 썸네일 이미지는 내려놓는다(둘 중 하나만 쓴다) */
  const startCrop = () => {
    const v = zoomRef.current?.visible()
    const start = v ? clampCrop(insetCrop(v), imgRatio) : (firstCrop ?? centeredCrop(imgRatio, imgRatio))
    setCrop(start)
    setRatio(null)
    setCropOn(true)
    setThumbFile(null)
    setThumbUrl(null)
  }

  /* 비율 체크박스 — 같은 것을 다시 누르면 고정이 풀린다(자유 비율) */
  const pickRatio = (key: RatioKey) => {
    const next = ratio === key ? null : key
    setRatio(next)
    if (next == null || !crop) return
    setCrop(reshapeCrop(crop, ratioValue(next), imgRatio))
  }

  const pickThumb = (f: File) => {
    setThumbFile(f)
    setThumbUrl(URL.createObjectURL(f))
    setCropOn(false)
    setCrop(null)
    setRatio(null)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 md:p-4">
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-white md:flex-row">
        {/* 좌측 — 올릴 그림. 영역 지정을 켜면 여기서 직접 잡는다.
            PDF 는 첫 장 아래로 나머지 장을 이어 붙여 내려 보며 확인하고,
            영역도 그 이어진 그림 어디에서나 잡는다. */}
        <ZoomArea
          handle={zoomRef}
          ratio={whole ? whole.width / whole.height : null}
          naturalWidth={size?.width ?? null}
          fit={isPdf ? 'width' : 'contain'}
          className="max-h-[38vh] shrink-0 md:max-h-none md:flex-1 md:shrink"
        >
          {cropOn && crop ? (
            <CropEditor
              src={url}
              pages={pageParts}
              crop={crop}
              onChange={setCrop}
              lockedRatio={ratio == null ? null : ratioValue(ratio)}
              imgRatio={imgRatio}
            />
          ) : (
            <StackView src={url} pages={pageParts} />
          )}
        </ZoomArea>

        {/* 우측 — 정보 입력과 저장 */}
        <div className="flex min-h-0 w-full flex-col overflow-y-auto border-t border-neutral-200 p-4 md:w-80 md:shrink-0 md:border-l md:border-t-0 md:p-5">
          <div className="mb-4">
            <h3 className="text-sm font-semibold">작업 올리기</h3>
            <p className="mt-1 truncate text-xs text-neutral-500" title={item.name}>
              {total > 1 && `${index + 1} / ${total} · `}
              {item.name}
            </p>
            <p className="mt-0.5 text-xs text-neutral-400">
              {isPdf
                ? `PDF ${item.pages.length + 1}쪽 · 왼쪽에서 내려 보며 확인하세요`
                : size
                  ? `${size.width} × ${size.height}`
                  : measureFailed
                    ? '크기를 읽지 못했습니다'
                    : '크기 확인 중…'}
            </p>
          </div>

          {/* 설명은 선택 입력 — 비우면 공개 화면에 설명 칸이 뜨지 않는다 */}
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
              rows={4}
              maxLength={MAX_DESCRIPTION}
              disabled={pending}
              placeholder="어떤 작업인지 적어 주세요"
              className="w-full resize-none rounded-lg border border-neutral-300 px-3 py-2 text-sm leading-relaxed outline-none ring-violet-500 focus:ring-2"
            />
          </label>

          <label className="mt-3 block">
            <span className="mb-1.5 block text-xs font-medium text-neutral-600">
              클라이언트 <span className="font-normal text-neutral-400">(선택)</span>
            </span>
            <input
              value={client}
              onChange={(e) => setClient(e.target.value)}
              disabled={pending}
              placeholder="예: 개인 작업"
              className="h-9 w-full rounded-lg border border-neutral-300 px-3 text-sm outline-none ring-violet-500 focus:ring-2"
            />
          </label>

          <div className="mt-3 space-y-2">
            <Check
              checked={aiUsed}
              onChange={setAiUsed}
              disabled={pending}
              label="AI 활용"
              hint="AI를 활용해 제작했으면 켜 주세요. 공개 화면에 표기가 붙습니다."
            />
            <Check
              checked={soomWork}
              onChange={setSoomWork}
              disabled={pending}
              label="SOOM에서 수행한 의뢰"
              hint="SOOM을 통해 받은 의뢰의 결과물이면 켜 주세요."
            />
            <Check
              checked={visible}
              onChange={setVisible}
              disabled={pending}
              label="공개 화면에 노출"
              hint="끄면 숨긴 채로 저장됩니다. 나중에 편집에서 바꿀 수 있습니다."
            />
          </div>

          {/* 썸네일 — 목록에 실제로 깔리는 그림 */}
          <div className="mt-3 rounded-lg border border-neutral-300 p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium">썸네일</span>
              <input
                ref={thumbRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) pickThumb(f)
                  e.target.value = ''
                }}
              />
              <div className="flex flex-wrap justify-end gap-1.5">
                {/* 영역을 잡는 중에는 켜진 모양으로 둔다 — 다시 눌러도 잡던 영역을 되돌리지 않는다 */}
                <button
                  type="button"
                  data-crop-keep
                  onClick={cropOn ? undefined : startCrop}
                  aria-pressed={cropOn}
                  disabled={pending || size == null}
                  title={size == null ? '원본 크기를 몰라 영역을 잡을 수 없습니다' : undefined}
                  className={`whitespace-nowrap rounded-md border px-2 py-1 text-[11px] font-medium transition disabled:opacity-40 ${
                    cropOn
                      ? 'border-violet-600 text-violet-700'
                      : 'border-neutral-300 text-neutral-700 hover:bg-neutral-100'
                  }`}
                >
                  영역 지정
                </button>
                <button
                  type="button"
                  onClick={() => thumbRef.current?.click()}
                  disabled={pending}
                  className="whitespace-nowrap rounded-md border border-neutral-300 px-2 py-1 text-[11px] font-medium text-neutral-700 transition hover:bg-neutral-100 disabled:opacity-40"
                >
                  파일시스템에서 업로드
                </button>
              </div>
            </div>

            {cropOn && crop && size ? (
              <div className="mt-2.5 space-y-2.5">
                {/* 잡고 있는 영역 — 잡는 대로 바뀌고, 저장하면 이 그림이 썸네일이 된다 */}
                <CropPreview
                  parts={[
                    { src: url, width: size.width, height: size.height },
                    ...item.pages.map((p, i) => ({ src: pageUrls[i], width: p.width, height: p.height })),
                  ]}
                  crop={crop}
                />
                <p className="text-[11px] leading-relaxed text-neutral-500">
                  {isPdf
                    ? '썸네일 파일을 업로드 하지 않으면 첫 슬라이드가 썸네일로 저장됩니다.'
                    : '썸네일로 쓸 영역을 지정해 주세요.'}
                </p>
              </div>
            ) : thumbFile && thumbUrl ? (
              <div className="mt-2.5 flex items-start gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={thumbUrl} alt="" className="size-16 shrink-0 rounded-md object-cover ring-1 ring-neutral-200" />
                <div className="min-w-0 text-[11px] leading-relaxed text-neutral-500">
                  <p className="truncate" title={thumbFile.name}>
                    {thumbFile.name}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setThumbFile(null)
                      setThumbUrl(null)
                    }}
                    disabled={pending}
                    className="mt-1 text-neutral-700 underline underline-offset-2"
                  >
                    빼기
                  </button>
                </div>
              </div>
            ) : (
              <p className="mt-2 text-[11px] leading-relaxed text-neutral-500">
                {isPdf
                  ? '썸네일 파일을 업로드 하지 않으면 첫 슬라이드가 썸네일로 저장됩니다.'
                  : '썸네일로 쓸 영역을 지정해 주세요.'}
              </p>
            )}
            {cropOn && (
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
                      onChange={() => pickRatio(r.key)}
                      disabled={pending}
                      className="accent-violet-600"
                    />
                    {r.key}
                  </label>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() =>
              onConfirm({
                width: whole ? Math.round(whole.width) : null,
                height: whole ? Math.round(whole.height) : null,
                firstSize: isPdf ? size : null,
                description: description.trim(),
                client: client.trim(),
                aiUsed,
                soomWork,
                visible,
                /* PDF 는 영역을 잡지 않았어도(썸네일을 따로 올렸어도) 첫 장 영역을
                   저장한다 — 목록·카드가 그 비율로 자리를 잡는다(work-stack.ts) */
                crop: (cropOn ? crop : null) ?? firstCrop,
                thumbFile,
              })
            }
            /* 크기를 못 읽었어도 올릴 수 있다 — 서버가 null 로 받아
               기존 규칙대로 자리를 잡는다. 읽는 중일 때만 잠깐 막는다. */
            disabled={pending || (size == null && !measureFailed)}
            className="mt-4 rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-600 disabled:opacity-40"
          >
            {pending ? (status ?? '올리는 중…') : '저장'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="mt-2 rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100 disabled:opacity-50"
          >
            {total > 1 ? '이 장 건너뛰기' : '취소'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Check({
  checked,
  onChange,
  disabled,
  label,
  hint,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  disabled: boolean
  label: string
  hint: string
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-neutral-300 p-2.5">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="mt-0.5 accent-violet-600"
      />
      <span className="min-w-0">
        <span className="block text-sm font-medium">{label}</span>
        <span className="mt-0.5 block text-[11px] leading-relaxed text-neutral-500">{hint}</span>
      </span>
    </label>
  )
}
