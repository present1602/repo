'use client'

import { useState } from 'react'
import Link from 'next/link'
import { type FeaturedCandidate, thumbSrc } from '@/lib/portfolio-limits'
import { displayName } from '@/lib/display-name'
import { shortDate } from '@/lib/format-date'
import { WorkModal } from '@/components/work-modal'
import { WorkDialog, type Notice } from './admin-portfolio'

/* 포트폴리오 모아보기의 격자.

   카드를 누르면 공개 화면과 같은 상세 모달(WorkModal)이 뜨고, 그 안에서
   이 쪽의 작업을 좌우로 넘겨 볼 수 있다. 디자이너 이름은 카드 버튼 밖에
   따로 둔 링크라 누르면 그 디자이너의 관리 화면으로 간다
   (버튼 안의 링크는 HTML 상 허용되지 않는다). */
export function WorksGrid({ works }: { works: FeaturedCandidate[] }) {
  const [index, setIndex] = useState<number | null>(null)
  /* 수정 다이얼로그 — 디자이너 관리 화면의 포트폴리오에서 쓰는 것과 같다 */
  const [editId, setEditId] = useState<string | null>(null)
  const editing = works.find((w) => w.id === editId) ?? null
  const [notice, setNotice] = useState<Notice>(null)

  /* 모달은 thumb_url 이 늘 채워진 공개 모양을 받는다 */
  const forModal = works.map((w) => ({ ...w, thumb_url: thumbSrc(w) }))

  return (
    <>
      {notice && (
        <p
          className={`mb-4 rounded-lg px-3.5 py-3 text-sm ${
            notice.kind === 'ok' ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'
          }`}
        >
          {notice.text}
        </p>
      )}

      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 min-[1920px]:grid-cols-4">
        {works.map((w, i) => {
          /* 공개 화면에 안 보이는 이유 — 작업을 숨겼거나 디자이너 쪽이 닫혀 있다 */
          const hidden = !w.visible
            ? '작업 숨김'
            : !w.designer.visible
              ? '계정 비활성'
              : !w.designer.profile_public
                ? '프로필 숨김'
                : null

          return (
            <li key={w.id}>
              <button
                type="button"
                onClick={() => setIndex(i)}
                className="group block w-full text-left"
                aria-label={w.title ?? '작업 보기'}
              >
                <div className="relative aspect-[5/4] overflow-hidden rounded-xl bg-neutral-100 ring-1 ring-neutral-200">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={thumbSrc(w)}
                    alt={w.title ?? ''}
                    loading="lazy"
                    className="size-full object-cover object-top transition duration-300 group-hover:scale-[1.02]"
                  />
                  {hidden && (
                    <span className="absolute left-2 top-2 rounded bg-neutral-900/70 px-1.5 py-0.5 text-[11px] font-medium text-white">
                      {hidden}
                    </span>
                  )}
                </div>
                <div className="mt-2 flex items-baseline justify-between gap-2 text-sm">
                  <span className="truncate font-medium">
                    {w.title || <span className="text-neutral-400">제목 없음</span>}
                  </span>
                  <span className="shrink-0 text-xs text-neutral-400">{shortDate(w.created_at)}</span>
                </div>
              </button>

              <div className="flex items-center justify-between gap-2">
                <Link
                  href={`/admin/designers/${w.designer.id}`}
                  className="min-w-0 truncate text-xs text-neutral-500 transition hover:text-violet-700 hover:underline"
                >
                  {displayName(w.designer)}
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setNotice(null)
                    setEditId(w.id)
                  }}
                  className="shrink-0 rounded-md border border-neutral-300 px-2 py-0.5 text-[11px] font-medium text-neutral-700 transition hover:bg-neutral-100"
                >
                  수정
                </button>
              </div>
            </li>
          )
        })}
      </ul>

      {index !== null && (
        <WorkModal
          works={forModal}
          index={index}
          setIndex={setIndex}
          onClose={() => setIndex(null)}
        />
      )}

      {editing && (
        <WorkDialog
          work={editing}
          designerId={editing.designer.id}
          onClose={() => setEditId(null)}
          onNotice={setNotice}
        />
      )}
    </>
  )
}
