'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import {
  POPUP_FILES_BUCKET,
  POPUP_IMAGE_ACCEPT,
  POPUP_FILE_ACCEPT,
  MAX_TITLE,
  MAX_BLOCKS,
  MAX_FILES,
  POPUP_COLORS,
  STATUS_LABELS,
  hasBody,
  isoToLocalInput,
  publicUrl,
  type PopupBlock,
  type PopupColor,
  type PopupFile,
  type PopupRow,
  type PopupStatus,
  type UploadKind,
} from '@/lib/popup-shape'
import { createPopup, preparePopupUpload, updatePopup } from '@/app/admin/popups/actions'
import { PopupCard, PopupFooter } from '@/components/site-popup'
import { Field, ghostButton, input } from './form-bits'

/* 화면에서만 쓰는 꼬리표 — 순서를 바꿔도 입력칸이 섞이지 않게 key 로 쓴다.
   업로드 중인 이미지는 아직 경로가 없어 미리보기 주소(preview)로 그린다. */
type EditBlock =
  | { key: string; type: 'text'; text: string }
  | { key: string; type: 'image'; path: string; preview?: string }

type EditFile = PopupFile & { key: string; uploading?: boolean }

const newKey = () => crypto.randomUUID()

/* 링크 주소로 받을 수 있는지 — 공개 화면(richParts)이 링크로 바꾸는 것과 같은 범위.
   'notefolio.net/…' 처럼 앞을 빼고 적으면 https:// 를 붙여 준다 */
function normalizeHref(raw: string): string | null {
  const v = raw.trim()
  if (!v || /\s/.test(v)) return null
  if (/^https?:\/\//.test(v)) return v
  if (v.startsWith('/') && !v.startsWith('//')) return v
  if (/^[\w-]+(\.[\w-]+)+/.test(v)) return `https://${v}`
  return null
}

/* 본문 글 칸 — 글자를 드래그해 고르고 굵게·밑줄·글자색·링크 버튼을 누르면
   그 글자를 표시로 감싼다(**굵게**, __밑줄__, {{red:색}}, [글자](주소)).
   칸에는 이 모양 그대로 보이고, 미리보기와 공개 화면에서 서식으로 그려진다
   (popup-shape.ts 의 richParts). */
const toolButton =
  'inline-flex h-7 min-w-7 items-center justify-center gap-1 rounded-md border border-neutral-300 px-2 text-xs text-neutral-700 transition hover:border-violet-400 hover:text-violet-700'

function LinkableText({ value, onChange }: { value: string; onChange: (text: string) => void }) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const [hint, setHint] = useState('')

  /* 고른 글자를 앞뒤 표시로 감싼다. 고른 게 없거나 줄을 넘으면 안내만 한다 */
  const wrap = (make: (picked: string) => string | null, what: string) => {
    const el = ref.current
    if (!el) return
    const { selectionStart: a, selectionEnd: z } = el
    const picked = value.slice(a, z)
    if (!picked.trim()) {
      setHint(`${what} 글자를 먼저 드래그해 고르세요.`)
      el.focus()
      return
    }
    if (picked.includes('\n')) {
      setHint('한 줄 안의 글자만 고를 수 있어요.')
      return
    }
    const wrapped = make(picked)
    if (wrapped == null) return
    onChange(value.slice(0, a) + wrapped + value.slice(z))
    setHint('')
    /* 감싼 뒤 커서를 그 뒤로 — 이어서 쓰기 편하게 */
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(a + wrapped.length, a + wrapped.length)
    })
  }

  const addLink = () =>
    wrap((picked) => {
      if (/[[\]]/.test(picked)) {
        setHint('대괄호가 들어간 글자에는 링크를 걸 수 없어요.')
        return null
      }
      const raw = window.prompt('이동할 주소를 적어 주세요 (예: https://notefolio.net/… 또는 /designers/apply)')
      if (raw == null) return null
      const href = normalizeHref(raw)
      if (!href) {
        setHint('주소를 확인해 주세요 — https:// 로 시작하는 주소나 /로 시작하는 사이트 안 경로만 됩니다.')
        return null
      }
      return `[${picked}](${href})`
    }, '링크를 걸')

  /* 누르는 순간 칸의 선택이 풀리지 않게 — 포커스를 버튼으로 옮기지 않는다 */
  const keepSelection = (e: React.MouseEvent) => e.preventDefault()

  return (
    <div>
      <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onMouseDown={keepSelection}
          onClick={() => wrap((p) => `**${p}**`, '굵게 할')}
          aria-label="굵게"
          title="굵게"
          className={`${toolButton} font-bold`}
        >
          B
        </button>
        <button
          type="button"
          onMouseDown={keepSelection}
          onClick={() => wrap((p) => `__${p}__`, '밑줄을 그을')}
          aria-label="밑줄"
          title="밑줄"
          className={`${toolButton} underline underline-offset-2`}
        >
          U
        </button>

        <span className="mx-0.5 h-4 w-px bg-neutral-200" aria-hidden />

        {/* 글자색 — 색 칸을 바로 누른다 */}
        {(Object.keys(POPUP_COLORS) as PopupColor[]).map((c) => (
          <button
            key={c}
            type="button"
            onMouseDown={keepSelection}
            onClick={() => wrap((p) => `{{${c}:${p}}}`, '색을 바꿀')}
            aria-label={`글자색 ${POPUP_COLORS[c].label}`}
            title={POPUP_COLORS[c].label}
            className="grid size-7 place-items-center rounded-md border border-neutral-300 transition hover:border-neutral-500"
          >
            <span className="size-3.5 rounded-full" style={{ background: POPUP_COLORS[c].hex }} />
          </button>
        ))}

        <span className="mx-0.5 h-4 w-px bg-neutral-200" aria-hidden />

        <button type="button" onMouseDown={keepSelection} onClick={addLink} className={toolButton}>
          <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" aria-hidden>
            <path d="M6.5 9.5l3-3M7 4.5l1-1a2.5 2.5 0 013.5 3.5l-1 1M9 11.5l-1 1a2.5 2.5 0 01-3.5-3.5l1-1" />
          </svg>
          링크
        </button>
      </div>
      <p className="mb-1.5 text-[11px] text-neutral-400">
        {hint || '글자를 드래그한 뒤 버튼을 누르세요. 결과는 아래 미리보기에서 보입니다.'}
      </p>
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={4}
        placeholder="본문 글"
        className="w-full resize-y rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none ring-violet-500 focus:ring-2"
      />
    </div>
  )
}

/* 서명 주소로 바로 올린다 — 서버 액션은 본문 크기 제한에 걸린다 */
async function upload(kind: UploadKind, file: File): Promise<string> {
  const prep = await preparePopupUpload(kind, file.name, file.size)
  if (!prep.ok) throw new Error(prep.error)

  const storage = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  ).storage.from(POPUP_FILES_BUCKET)

  const { error } = await storage.uploadToSignedUrl(prep.path, prep.token, file, {
    contentType: file.type || undefined,
  })
  if (error) {
    console.error('[popup] 업로드 실패:', error.message)
    throw new Error(`${file.name} 을(를) 올리지 못했습니다.`)
  }
  return prep.path
}

function formatSize(n: number) {
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))}KB`
  return `${(n / 1024 / 1024).toFixed(1)}MB`
}

export function PopupForm({ popup }: { popup?: PopupRow }) {
  const router = useRouter()

  const [title, setTitle] = useState(popup?.title ?? '')
  const [blocks, setBlocks] = useState<EditBlock[]>(() =>
    popup?.body.length
      ? popup.body.map((b) => ({ ...b, key: newKey() }))
      : [{ key: newKey(), type: 'text', text: '' }],
  )
  const [files, setFiles] = useState<EditFile[]>(() =>
    (popup?.files ?? []).map((f) => ({ ...f, key: newKey() })),
  )
  const [startsAt, setStartsAt] = useState(isoToLocalInput(popup?.starts_at ?? null))
  const [endsAt, setEndsAt] = useState(isoToLocalInput(popup?.ends_at ?? null))
  const [status, setStatus] = useState<PopupStatus>(popup?.status ?? 'visible')

  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)

  const imageInput = useRef<HTMLInputElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const uploading =
    blocks.some((b) => b.type === 'image' && !b.path) || files.some((f) => f.uploading)

  /* 저장할 모양 — 업로드가 끝난 것만 */
  const body: PopupBlock[] = blocks.flatMap((b): PopupBlock[] =>
    b.type === 'text' ? [{ type: 'text', text: b.text }] : b.path ? [{ type: 'image', path: b.path }] : [],
  )

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
    const picked = Array.from(list ?? []).slice(0, MAX_BLOCKS - blocks.length)
    if (picked.length === 0) return
    setError(null)

    /* 비어 있는 첫 글 칸 하나뿐이면 이미지로 갈아끼운다 — 이미지 한 장짜리
       팝업을 만들 때 빈 글 칸을 따로 지우지 않아도 되게 */
    const added = picked.map((file) => ({
      key: newKey(),
      type: 'image' as const,
      path: '',
      preview: URL.createObjectURL(file),
      file,
    }))
    setBlocks((bs) => {
      const lone = bs.length === 1 && bs[0].type === 'text' && !bs[0].text.trim()
      return [...(lone ? [] : bs), ...added.map(({ key, preview }) => ({ key, type: 'image' as const, path: '', preview }))]
    })

    await Promise.all(
      added.map(async ({ key, file }) => {
        try {
          const path = await upload('image', file)
          setBlocks((bs) => bs.map((b) => (b.key === key ? { ...b, path } : b)))
        } catch (e) {
          setError(e instanceof Error ? e.message : '이미지를 올리지 못했습니다.')
          removeBlock(key)
        }
      }),
    )
  }

  const addFiles = async (list: FileList | null) => {
    const picked = Array.from(list ?? []).slice(0, MAX_FILES - files.length)
    if (picked.length === 0) return
    setError(null)

    const added = picked.map((file) => ({ key: newKey(), file }))
    setFiles((fs) => [
      ...fs,
      ...added.map(({ key, file }) => ({ key, name: file.name, size: file.size, path: '', uploading: true })),
    ])

    await Promise.all(
      added.map(async ({ key, file }) => {
        try {
          const path = await upload('file', file)
          setFiles((fs) => fs.map((f) => (f.key === key ? { ...f, path, uploading: false } : f)))
        } catch (e) {
          setError(e instanceof Error ? e.message : '파일을 올리지 못했습니다.')
          setFiles((fs) => fs.filter((f) => f.key !== key))
        }
      }),
    )
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSaved(false)

    if (!hasBody(body)) return setError('본문에 글이나 이미지를 넣어 주세요.')

    const payload = {
      title,
      body,
      files: files.map(({ name, path, size }) => ({ name, path, size })),
      startsAt,
      endsAt,
      status,
    }

    setSaving(true)
    try {
      if (popup) {
        const r = await updatePopup(popup.id, payload)
        if (!r.ok) return setError(r.error)
        setSaved(true)
        router.refresh()
      } else {
        const r = await createPopup(payload)
        if (!r.ok) return setError(r.error)
        router.push('/admin/popups')
      }
    } finally {
      setSaving(false)
    }
  }

  const statusOptions: PopupStatus[] =
    popup?.status === 'expired' ? ['visible', 'hidden', 'expired'] : ['visible', 'hidden']

  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,40rem)_minmax(0,1fr)]">
      <form onSubmit={submit} className="space-y-6">
        <Field label="제목" hint="선택">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={MAX_TITLE}
            placeholder="비우면 제목 없이 본문만 뜹니다"
            className={input}
          />
        </Field>

        {/* 본문 — 글과 이미지를 원하는 순서로 쌓는다 */}
        <div>
          <span className="mb-1.5 block text-xs font-medium text-neutral-600">
            본문<span className="text-red-500"> *</span>
            <span className="ml-1 font-normal text-neutral-400">(글 또는 이미지 하나 이상)</span>
          </span>
          <ul className="space-y-2">
            {blocks.map((b, i) => (
              <li key={b.key} className="flex gap-2 rounded-lg border border-neutral-200 bg-white p-2">
                <div className="min-w-0 flex-1">
                  {b.type === 'text' ? (
                    <LinkableText value={b.text} onChange={(text) => patch(b.key, text)} />
                  ) : (
                    <div className="relative overflow-hidden rounded-md bg-neutral-100">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={b.preview ?? publicUrl(b.path)}
                        alt=""
                        className={`max-h-64 w-full object-contain ${b.path ? '' : 'opacity-50'}`}
                      />
                      {!b.path && (
                        <span className="absolute inset-0 grid place-items-center text-xs font-medium text-neutral-700">
                          올리는 중…
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 flex-col gap-1">
                  <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className={ghostButton} aria-label="위로">
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
                  <button type="button" onClick={() => removeBlock(b.key)} className={`${ghostButton} text-red-600`} aria-label="삭제">
                    ✕
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-2 flex gap-2">
            <button type="button" onClick={addText} disabled={blocks.length >= MAX_BLOCKS} className={ghostButton}>
              + 글
            </button>
            <button
              type="button"
              onClick={() => imageInput.current?.click()}
              disabled={blocks.length >= MAX_BLOCKS}
              className={ghostButton}
            >
              + 이미지
            </button>
            <input
              ref={imageInput}
              type="file"
              accept={POPUP_IMAGE_ACCEPT}
              multiple
              hidden
              onChange={(e) => {
                addImages(e.target.files)
                e.target.value = ''
              }}
            />
          </div>
        </div>

        {/* 첨부 — 본문 이미지와 별개로 방문자가 내려받는 파일 */}
        <div>
          <span className="mb-1.5 block text-xs font-medium text-neutral-600">
            첨부 파일
            <span className="ml-1 font-normal text-neutral-400">(선택 · 최대 {MAX_FILES}개, 파일당 20MB)</span>
          </span>

          {files.length > 0 && (
            <ul className="mb-2 divide-y divide-neutral-200 rounded-lg border border-neutral-200 bg-white">
              {files.map((f) => (
                <li key={f.key} className="flex items-center gap-3 px-3 py-2 text-sm">
                  <span className="min-w-0 flex-1 truncate">{f.name}</span>
                  <span className="shrink-0 text-xs text-neutral-400">
                    {f.uploading ? '올리는 중…' : formatSize(f.size)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setFiles((fs) => fs.filter((x) => x.key !== f.key))}
                    disabled={f.uploading}
                    className={`${ghostButton} text-red-600`}
                  >
                    삭제
                  </button>
                </li>
              ))}
            </ul>
          )}

          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            disabled={files.length >= MAX_FILES}
            className={ghostButton}
          >
            + 파일 첨부
          </button>
          <input
            ref={fileInput}
            type="file"
            accept={POPUP_FILE_ACCEPT}
            multiple
            hidden
            onChange={(e) => {
              addFiles(e.target.files)
              e.target.value = ''
            }}
          />
        </div>

        {/* 게시 기간 — 한국 시간 기준 */}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="게시 시작" hint="비우면 바로">
            <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className={input} />
          </Field>
          <Field label="게시 종료" hint="비우면 계속">
            <input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} className={input} />
          </Field>
        </div>

        <div>
          <span className="mb-1.5 block text-xs font-medium text-neutral-600">상태</span>
          <div className="flex gap-2">
            {statusOptions.map((s) => (
              <label
                key={s}
                className={`cursor-pointer rounded-lg border px-3.5 py-2 text-sm font-medium transition ${
                  status === s
                    ? 'border-neutral-900 bg-neutral-900 text-white'
                    : 'border-neutral-300 text-neutral-600 hover:bg-neutral-100'
                }`}
              >
                <input
                  type="radio"
                  name="status"
                  value={s}
                  checked={status === s}
                  onChange={() => setStatus(s)}
                  className="sr-only"
                />
                {STATUS_LABELS[s]}
              </label>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-neutral-400">
            {popup?.status === 'expired'
              ? '게시 기간이 지나 만료됐습니다. 종료 일시를 늘리고 노출로 저장하면 다시 뜹니다.'
              : '노출 상태여도 게시 기간 밖이면 뜨지 않습니다. 기간이 지나면 만료로 바뀝니다.'}
          </p>
        </div>

        {error && <p className="rounded-lg bg-red-50 px-3.5 py-3 text-sm text-red-700">{error}</p>}
        {saved && <p className="rounded-lg bg-emerald-50 px-3.5 py-3 text-sm text-emerald-800">저장했습니다.</p>}

        <button
          type="submit"
          disabled={saving || uploading}
          className="rounded-lg bg-neutral-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-600 disabled:opacity-50"
        >
          {saving ? '저장 중…' : uploading ? '업로드 중…' : popup ? '저장' : '등록'}
        </button>
      </form>

      {/* 미리보기 — 사이트에 뜨는 모양 그대로 */}
      <aside className="min-w-0">
        <p className="mb-2 text-xs font-medium text-neutral-600">미리보기</p>
        <div className="grid place-items-center rounded-xl bg-neutral-800/80 p-6">
          {hasBody(body) ? (
            <PopupCard
              popup={{ id: 'preview', title: title.trim() || null, body, files: files.filter((f) => f.path) }}
              onClose={() => {}}
              footer={<PopupFooter />}
            />
          ) : (
            <p className="py-16 text-sm text-neutral-300">본문을 채우면 여기에 보입니다</p>
          )}
        </div>
      </aside>
    </div>
  )
}
