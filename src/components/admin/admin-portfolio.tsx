'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { WorkRow } from '@/lib/portfolio-limits'
import { MAX_WORKS, MAX_DESCRIPTION } from '@/lib/portfolio-limits'
import {
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

  return (
    <section className="min-w-0">
      <header className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold">포트폴리오</h2>
        <p className="text-xs text-neutral-500">
          {works.length} / {MAX_WORKS}개 · 노출 {shown}개
        </p>
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
  const [pending, start] = useTransition()
  const router = useRouter()

  const dirty =
    title !== (w.title ?? '') ||
    description !== (w.description ?? '') ||
    client !== (w.client ?? '')

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

          <button
            onClick={() =>
              act(
                () => adminUpdateWork({ id: w.id, designerId, title, description, client }),
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
