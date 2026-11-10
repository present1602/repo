'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { useActionTransition } from '@/lib/use-action-transition'
import {
  GUIDE_IMAGES_BUCKET,
  GUIDE_IMAGE_ACCEPT,
  MAX_GUIDE_BLOCKS,
  MAX_GUIDE_SUMMARY,
  MAX_GUIDE_TEXT_BLOCK,
  MAX_GUIDE_TITLE,
  guideBodySummary,
  guideImageUrl,
  hasGuideBody,
  type GuideBlock,
  type GuideChapter,
} from '@/lib/guide-shape'
import {
  addGuideChapter,
  deleteGuideChapter,
  prepareGuideUpload,
  reorderGuideChapters,
  setGuideChapterVisible,
  updateGuideChapter,
} from '@/app/admin/guide/actions'
import { Flash } from '@/components/flash'
import { ghostButton } from './form-bits'

type Notice = { kind: 'ok' | 'error'; text: string } | null

/* 화면에서만 쓰는 꼬리표 — 순서를 바꿔도 입력칸이 섞이지 않게 key 로 쓴다.
   올리는 중인 이미지는 아직 경로가 없어 미리보기 주소(preview)로 그린다
   (popup-form.tsx 의 EditBlock 과 같은 방식). */
type EditBlock =
  | { key: string; type: 'text'; text: string }
  | { key: string; type: 'image'; path: string; preview?: string }

/* 렌더 중에 만들지 않는다 — 프리렌더가 깨진다. 핸들러·초기화에서만 부른다 */
const newKey = () => crypto.randomUUID()

/* 서명 주소로 바로 올린다 — 서버 액션은 본문 크기 제한에 걸린다(popup-form.tsx 와 같다) */
async function uploadImage(file: File): Promise<string> {
  const prep = await prepareGuideUpload(file.name, file.size)
  if (!prep.ok) throw new Error(prep.error)

  const storage = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  ).storage.from(GUIDE_IMAGES_BUCKET)

  const { error } = await storage.uploadToSignedUrl(prep.path, prep.token, file, {
    contentType: file.type || undefined,
  })
  if (error) {
    console.error('[guide] 업로드 실패:', error.message)
    throw new Error(`${file.name} 을(를) 올리지 못했습니다.`)
  }
  return prep.path
}

/* 설정 가이드 챕터 관리(0024_setup_guide.sql).

   기능과 엮이지 않은 안내문이다 — 챕터를 차례대로 두고, 챕터마다 글과 이미지를
   원하는 순서로 쌓는다(팝업 본문과 같은 방식). 순서는 손잡이를 끌어 바꾸고
   (FaqManager 와 같은 방식), 숨긴 챕터는 목록에 '숨김' 으로 남는다. */
export function GuideManager({ chapters }: { chapters: GuideChapter[] }) {
  const [notice, setNotice] = useState<Notice>(null)
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  /* 펼쳐 둔 챕터 — 본문을 눌러 열어 본다 */
  const [open, setOpen] = useState<Set<string>>(new Set())
  const [pending, start] = useActionTransition()
  const router = useRouter()

  /* 끄는 동안에만 쓰는 순서 — 평소에는 서버가 준 목록을 그대로 그린다 */
  const [dragging, setDragging] = useState<{ id: string; ids: string[] } | null>(null)
  const [savingOrder, startOrder] = useActionTransition()

  const dragId = dragging?.id ?? null

  const order = (() => {
    if (!dragging) return chapters
    const byId = new Map(chapters.map((c) => [c.id, c]))
    const kept = dragging.ids.map((id) => byId.get(id)).filter((c) => c != null)
    const known = new Set(kept.map((c) => c.id))
    return [...kept, ...chapters.filter((c) => !known.has(c.id))]
  })()

  const act = (fn: () => Promise<{ ok: boolean; error?: string }>, okText?: string) => {
    setNotice(null)
    start(async () => {
      const r = await fn()
      if (!r.ok) {
        setNotice({ kind: 'error', text: r.error ?? '처리에 실패했습니다.' })
        return
      }
      router.refresh()
      if (okText) setNotice({ kind: 'ok', text: okText })
    })
  }

  const toggleOpen = (id: string) =>
    setOpen((cur) => {
      const next = new Set(cur)
      if (!next.delete(id)) next.add(id)
      return next
    })

  const moveTo = (i: number) => {
    setDragging((cur) => {
      if (!cur) return cur
      const from = order.findIndex((c) => c.id === cur.id)
      if (from === -1 || from === i) return cur
      const next = order.map((c) => c.id)
      const [id] = next.splice(from, 1)
      next.splice(i, 0, id)
      return { ...cur, ids: next }
    })
  }

  const commitOrder = () => {
    const moved = dragging
    setDragging(null)
    if (!moved) return
    if (chapters.map((c) => c.id).join() === moved.ids.join()) return

    startOrder(async () => {
      const r = await reorderGuideChapters(moved.ids)
      if (!r.ok) {
        setNotice({ kind: 'error', text: r.error })
        return
      }
      router.refresh()
    })
  }

  return (
    <section className="rounded-xl bg-white p-5 ring-1 ring-neutral-200 md:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold">챕터</h2>
        <p className="text-xs text-neutral-500">
          제목을 누르면 본문이 펼쳐집니다
          {savingOrder && <span className="ml-1.5 text-neutral-400">· 순서 저장 중…</span>}
        </p>
      </div>

      <Flash msg={notice} onDone={() => setNotice(null)} className="mt-3" />

      {/* 추가 — 제목·설명·본문이 길어 버튼을 눌러 폼을 연다 */}
      {adding ? (
        <div className="mt-4 rounded-xl bg-neutral-50 p-3.5 ring-1 ring-neutral-200">
          <ChapterForm
            pending={pending}
            submitLabel="추가"
            onCancel={() => setAdding(false)}
            onSubmit={(input) =>
              act(async () => {
                const r = await addGuideChapter(input)
                if (r.ok) setAdding(false)
                return r
              }, '챕터를 추가했습니다.')
            }
          />
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          disabled={pending}
          className="mt-4 w-full rounded-lg border border-dashed border-neutral-300 py-2.5 text-sm font-medium text-neutral-600 transition hover:border-violet-400 hover:text-violet-700 disabled:opacity-50"
        >
          + 챕터 추가
        </button>
      )}

      {chapters.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-neutral-300 py-12 text-center text-sm text-neutral-500">
          아직 등록된 챕터가 없습니다.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-neutral-200 overflow-hidden rounded-xl ring-1 ring-neutral-200">
          {order.map((c, i) => (
            <li
              key={c.id}
              onDragOver={(e) => {
                if (dragId == null) return
                e.preventDefault()
                moveTo(i)
              }}
              className={`transition ${dragId === c.id ? 'opacity-40' : ''} ${
                c.visible ? 'bg-white' : 'bg-neutral-50'
              }`}
            >
              {editing === c.id ? (
                <div className="p-3.5">
                  <ChapterForm
                    chapter={c}
                    pending={pending}
                    submitLabel="저장"
                    onCancel={() => setEditing(null)}
                    onSubmit={(input) =>
                      act(async () => {
                        const r = await updateGuideChapter(c.id, input)
                        if (r.ok) setEditing(null)
                        return r
                      }, '챕터를 저장했습니다.')
                    }
                  />
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-x-2 pr-3">
                  {/* 끌기 손잡이 — 여기서만 끌 수 있다 */}
                  <span
                    draggable
                    onDragStart={(e) => {
                      setDragging({ id: c.id, ids: chapters.map((x) => x.id) })
                      e.dataTransfer.effectAllowed = 'move'
                      /* Firefox 는 데이터가 없으면 드래그를 시작하지 않는다 */
                      e.dataTransfer.setData('text/plain', c.id)
                    }}
                    onDragEnd={commitOrder}
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

                  {/* 제목 — 누르면 본문이 펼쳐진다 */}
                  <button
                    onClick={() => toggleOpen(c.id)}
                    aria-expanded={open.has(c.id)}
                    className="flex min-w-0 flex-1 items-start gap-2 py-3 text-left"
                  >
                    <svg
                      viewBox="0 0 16 16"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1.8}
                      strokeLinecap="round"
                      aria-hidden
                      className={`mt-0.5 size-3.5 shrink-0 text-neutral-400 transition-transform ${
                        open.has(c.id) ? 'rotate-90' : ''
                      }`}
                    >
                      <path d="M6 3l5 5-5 5" />
                    </svg>
                    <span className="min-w-0">
                      <span className="block">
                        <span
                          className={`text-sm font-medium ${c.visible ? '' : 'text-neutral-400 line-through'}`}
                        >
                          {i + 1}. {c.title}
                        </span>
                        {!c.visible && (
                          <span className="ml-1.5 text-xs text-neutral-500">· 숨김</span>
                        )}
                        {hasGuideBody(c.body) ? (
                          <span className="ml-1.5 text-xs text-neutral-400">
                            · {guideBodySummary(c.body)}
                          </span>
                        ) : (
                          <span className="ml-1.5 text-xs text-amber-700">본문 없음</span>
                        )}
                      </span>
                      {c.summary && (
                        <span className="mt-0.5 block truncate text-xs text-neutral-500">
                          {c.summary}
                        </span>
                      )}
                    </span>
                  </button>

                  {/* 좁은 화면에서는 제목 아래로 내려 접히게 하고(손잡이 폭만큼 들여),
                      넓은 화면에서는 오른쪽 한 줄 — FaqManager 와 같은 방식 */}
                  <div className="flex basis-full flex-wrap items-center gap-1.5 pb-3 pl-8 md:basis-auto md:shrink-0 md:flex-nowrap md:pb-0 md:pl-0">
                    <button onClick={() => setEditing(c.id)} disabled={pending} className={ghost}>
                      수정
                    </button>
                    <button
                      onClick={() => act(() => setGuideChapterVisible(c.id, !c.visible))}
                      disabled={pending}
                      className={ghost}
                    >
                      {c.visible ? '숨기기' : '노출'}
                    </button>
                    <button
                      onClick={() => {
                        if (!confirm(`'${c.title}' 챕터를 지울까요? 본문 이미지도 함께 지워집니다.`)) {
                          return
                        }
                        act(() => deleteGuideChapter(c.id), '지웠습니다.')
                      }}
                      disabled={pending}
                      className="rounded-md border border-red-200 px-2 py-1 text-[11px] font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                    >
                      삭제
                    </button>
                  </div>

                  {/* 펼친 본문 — 저장된 블록을 쌓인 차례대로 */}
                  {open.has(c.id) && (
                    <div className="basis-full space-y-2 pb-3.5 pl-8 pr-1">
                      {hasGuideBody(c.body) ? (
                        c.body.map((b, bi) =>
                          b.type === 'text' ? (
                            <p
                              key={bi}
                              className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-600"
                            >
                              {b.text}
                            </p>
                          ) : (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              key={bi}
                              src={guideImageUrl(b.path)}
                              alt=""
                              className="max-h-80 w-full rounded-lg bg-neutral-100 object-contain"
                            />
                          ),
                        )
                      ) : (
                        <p className="text-sm text-neutral-400">본문이 비어 있습니다.</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <p className="mt-3 text-xs text-neutral-400">
        손잡이를 끌어 디자이너에게 보이는 차례를 바꿉니다. 숨긴 챕터는 디자이너 화면에서만 빠지고 이
        목록에는 남습니다. 본문 글은 줄바꿈을 적은 그대로 나갑니다.
      </p>
    </section>
  )
}

/* 챕터 한 건을 적는 폼 — 추가와 수정이 같은 모양을 쓴다.
   본문은 글·이미지 블록을 원하는 순서로 쌓는다(popup-form.tsx 와 같은 방식). */
function ChapterForm({
  chapter,
  pending,
  submitLabel,
  onCancel,
  onSubmit,
}: {
  chapter?: GuideChapter
  pending: boolean
  submitLabel: string
  onCancel: () => void
  onSubmit: (input: { title: string; summary: string; body: GuideBlock[] }) => void
}) {
  const [title, setTitle] = useState(chapter?.title ?? '')
  const [summary, setSummary] = useState(chapter?.summary ?? '')
  const [blocks, setBlocks] = useState<EditBlock[]>(() =>
    chapter?.body.length
      ? chapter.body.map((b) => ({ ...b, key: newKey() }))
      : [{ key: newKey(), type: 'text', text: '' }],
  )
  /* 업로드 실패는 저장 버튼 위가 아니라 폼 안에 남긴다 — 눌렀는데 아무 일도
     안 일어난 것처럼 보이지 않게 */
  const [error, setError] = useState<string | null>(null)

  const imageInput = useRef<HTMLInputElement>(null)

  /* 아직 경로가 없는 블록이 있으면 올리는 중 — 저장을 막는다(경로 없이 저장되면 사라진다) */
  const uploading = blocks.some((b) => b.type === 'image' && !b.path)

  /* 저장할 모양 — 업로드가 끝난 것만 */
  const body: GuideBlock[] = blocks.flatMap((b): GuideBlock[] =>
    b.type === 'text'
      ? b.text.trim()
        ? [{ type: 'text', text: b.text }]
        : []
      : b.path
        ? [{ type: 'image', path: b.path }]
        : [],
  )

  const same =
    chapter != null &&
    title === chapter.title &&
    summary === chapter.summary &&
    JSON.stringify(body) === JSON.stringify(chapter.body)

  const patch = (key: string, text: string) =>
    setBlocks((bs) => bs.map((b) => (b.key === key && b.type === 'text' ? { ...b, text } : b)))

  const move = (i: number, d: -1 | 1) =>
    setBlocks((bs) => {
      const j = i + d
      if (j < 0 || j >= bs.length) return bs
      const next = [...bs]
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })

  const removeBlock = (key: string) => setBlocks((bs) => bs.filter((b) => b.key !== key))

  const addText = () => setBlocks((bs) => [...bs, { key: newKey(), type: 'text', text: '' }])

  const addImages = async (list: FileList | null) => {
    const picked = Array.from(list ?? []).slice(0, MAX_GUIDE_BLOCKS - blocks.length)
    if (picked.length === 0) return
    setError(null)

    const added = picked.map((file) => ({ key: newKey(), file, preview: URL.createObjectURL(file) }))

    /* 비어 있는 첫 글 칸 하나뿐이면 이미지로 갈아끼운다 — 이미지만 있는 챕터를
       만들 때 빈 글 칸을 따로 지우지 않아도 되게 */
    setBlocks((bs) => {
      const lone = bs.length === 1 && bs[0].type === 'text' && !bs[0].text.trim()
      return [
        ...(lone ? [] : bs),
        ...added.map(({ key, preview }) => ({ key, type: 'image' as const, path: '', preview })),
      ]
    })

    await Promise.all(
      added.map(async ({ key, file }) => {
        try {
          const path = await uploadImage(file)
          setBlocks((bs) => bs.map((b) => (b.key === key ? { ...b, path } : b)))
        } catch (e) {
          setError(e instanceof Error ? e.message : '이미지를 올리지 못했습니다.')
          removeBlock(key)
        }
      }),
    )
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (!title.trim() || uploading) return
        onSubmit({ title, summary, body })
      }}
      className="space-y-3"
    >
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="챕터 제목 — 예: 1. 프로필과 소개글 채우기"
        maxLength={MAX_GUIDE_TITLE}
        autoFocus
        className="h-9 w-full min-w-0 rounded-lg border border-neutral-300 bg-white px-3 text-sm outline-none ring-violet-500 placeholder:text-neutral-400 focus:ring-2"
      />
      <input
        value={summary}
        onChange={(e) => setSummary(e.target.value)}
        placeholder="한 줄 설명 (선택) — 제목 아래에 작게 나갑니다"
        maxLength={MAX_GUIDE_SUMMARY}
        className="h-9 w-full min-w-0 rounded-lg border border-neutral-300 bg-white px-3 text-sm outline-none ring-violet-500 placeholder:text-neutral-400 focus:ring-2"
      />

      {/* 본문 — 글과 이미지를 원하는 순서로 쌓는다 */}
      <div>
        <span className="mb-1.5 block text-xs font-medium text-neutral-600">
          본문
          <span className="ml-1 font-normal text-neutral-400">
            (글·이미지를 쌓아 올립니다 · 최대 {MAX_GUIDE_BLOCKS}칸, 이미지당 10MB)
          </span>
        </span>

        <ul className="space-y-2">
          {blocks.map((b, i) => (
            <li
              key={b.key}
              className="flex gap-2 rounded-lg border border-neutral-200 bg-white p-2"
            >
              <div className="min-w-0 flex-1">
                {b.type === 'text' ? (
                  <textarea
                    value={b.text}
                    onChange={(e) => patch(b.key, e.target.value)}
                    maxLength={MAX_GUIDE_TEXT_BLOCK}
                    rows={4}
                    placeholder="안내 글 — 줄바꿈은 그대로 나갑니다"
                    className="w-full resize-y rounded-md border border-neutral-300 px-3 py-2 text-sm leading-relaxed outline-none ring-violet-500 placeholder:text-neutral-400 focus:ring-2"
                  />
                ) : (
                  <div className="relative overflow-hidden rounded-md bg-neutral-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={b.preview ?? guideImageUrl(b.path)}
                      alt=""
                      className={`max-h-64 w-full object-contain ${b.path ? '' : 'opacity-50'}`}
                    />
                    {/* 올리는 동안 도는 중인 것을 보여 준다 */}
                    {!b.path && (
                      <span className="absolute inset-0 grid place-items-center text-xs font-medium text-neutral-700">
                        올리는 중…
                      </span>
                    )}
                  </div>
                )}
              </div>
              <div className="flex shrink-0 flex-col gap-1">
                <button
                  type="button"
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  className={ghostButton}
                  aria-label="위로"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => move(i, 1)}
                  disabled={i === blocks.length - 1}
                  className={ghostButton}
                  aria-label="아래로"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => removeBlock(b.key)}
                  className={`${ghostButton} text-red-600`}
                  aria-label="삭제"
                >
                  ✕
                </button>
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={addText}
            disabled={blocks.length >= MAX_GUIDE_BLOCKS}
            className={ghostButton}
          >
            + 글
          </button>
          <button
            type="button"
            onClick={() => imageInput.current?.click()}
            disabled={blocks.length >= MAX_GUIDE_BLOCKS}
            className={ghostButton}
          >
            + 이미지
          </button>
          <input
            ref={imageInput}
            type="file"
            accept={GUIDE_IMAGE_ACCEPT}
            multiple
            hidden
            onChange={(e) => {
              addImages(e.target.files)
              e.target.value = ''
            }}
          />
        </div>
      </div>

      {/* 업로드 실패 — 이 폼 안에 남긴다. 무엇이 잘못됐는지 읽어야 한다 */}
      {error && <p className="rounded-lg bg-red-50 px-3.5 py-3 text-sm text-red-700">{error}</p>}

      <div className="flex items-center justify-end gap-1.5">
        <button type="button" onClick={onCancel} disabled={pending} className={ghost}>
          취소
        </button>
        <button
          type="submit"
          disabled={pending || !title.trim() || uploading || same}
          className="rounded-lg bg-neutral-900 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-violet-600 disabled:opacity-40"
        >
          {pending ? '저장 중…' : uploading ? '업로드 중…' : submitLabel}
        </button>
      </div>
    </form>
  )
}

const ghost =
  'rounded-md border border-neutral-300 px-2 py-1 text-[11px] font-medium text-neutral-700 transition hover:bg-neutral-100 disabled:opacity-50'
