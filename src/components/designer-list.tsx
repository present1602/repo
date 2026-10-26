'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import type { PublicDesignerCard, PublicWork } from '@/lib/designer-shape'
import { displayNameOf } from '@/lib/display-name'
import { Img } from './img'
import { WorkModal } from './work-modal'
import { ScopePrompt } from './scope-prompt'
import { SCOPES, SCOPE_LABELS, acceptsScope, type Scope } from '@/lib/scopes'

export function DesignerList({
  designers,
  tags: allTags,
}: {
  designers: PublicDesignerCard[]
  tags: string[]
}) {
  const [tag, setTag] = useState<string | null>(null)
  const [q, setQ] = useState('')

  /* 들어오자마자 어떤 의뢰인지 묻고, 그 유형을 받는 디자이너만 남긴다.
     null 이면 거르지 않는다 — 고르지 않고 닫은 경우다. */
  const [scope, setScope] = useState<Scope | null>(null)
  const [asked, setAsked] = useState(false)

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return designers.filter((d) => {
      /* 받을 유형을 모두 끈 디자이너는 거르지 않을 때도 뺀다 — 탐색에는
         나오지 않고 프로필 링크로만 열리게 하려고 끈 것이다(plan-form.tsx) */
      if (!SCOPES.some((s) => acceptsScope(d, s))) return false
      if (scope && !acceptsScope(d, scope)) return false
      if (tag && !d.tags.includes(tag)) return false
      if (!needle) return true
      /* 이름·한 줄 소개·분야까지 함께 본다. 이름이 비어 있는 계정도 있으므로
         표시명으로 맞춘다 — 화면에 보이는 글자로 검색되는 게 자연스럽다. */
      const hay = [displayNameOf(d), d.one_liner ?? '', ...d.tags].join(' ').toLowerCase()
      return hay.includes(needle)
    })
  }, [designers, tag, q, scope])

  return (
    <div className="flex min-h-full bg-neutral-100 text-neutral-900">
      <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-60 shrink-0 overflow-y-auto border-r border-neutral-200 bg-white p-6 lg:block">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">전문 분야</p>
        <ul className="mt-3 space-y-0.5 text-sm">
          {[null, ...allTags].map((t) => {
            const n = t ? designers.filter((d) => d.tags.includes(t)).length : designers.length
            return (
              <li key={t ?? 'all'}>
                <button
                  onClick={() => setTag(t)}
                  className={`flex w-full justify-between rounded-md px-2 py-1.5 ${
                    tag === t ? 'bg-violet-50 font-semibold text-violet-700' : 'text-neutral-600 hover:bg-neutral-100'
                  }`}
                >
                  {t ?? '전체'} <span className="text-xs text-neutral-400">{n}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </aside>

      {/* 1920px 화면에서 꼭 차는 폭(1920 - 사이드바 240)까지만 넓어진다.
          그보다 큰 화면에서는 오른쪽이 빈 바탕으로 남는다 — 카드가 끝없이
          늘어나면 썸네일 줄이 납작해지고 눈이 좌우로 너무 멀리 오간다. */}
      <main className="min-w-0 max-w-[1680px] flex-1 px-4 py-6 md:px-8 md:py-8">
        {/* 타이틀 영역 우측 끝에 키워드 검색 */}
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div className="flex items-start gap-3">
            <div>
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
                  {tag ?? 'Designers'}
                </h1>
                {/* 고른 유형을 제목 옆에 늘 보이게 — 왜 목록이 짧은지 모르면
                    디자이너가 없는 줄 알고 되돌아간다. 고르지 않았으면 띄우지 않는다.
                    제목을 가리지 않게 테두리 없는 작은 글자로 두고, 눌러서 처음의
                    물음을 다시 연다 — 바꿀 수 있다는 걸 꺾쇠로 알린다. */}
                {scope && (
                  <button
                    type="button"
                    onClick={() => setAsked(false)}
                    aria-label={`의뢰유형 변경 (지금: ${SCOPE_LABELS[scope]})`}
                    className="inline-flex max-w-full items-center gap-1 text-xs text-violet-800 transition hover:text-violet-600"
                  >
                    <span className="shrink-0 text-violet-500">의뢰유형 :</span>
                    <span className="truncate font-semibold">{SCOPE_LABELS[scope]}</span>
                    <svg
                      viewBox="0 0 16 16"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="size-3 shrink-0"
                      aria-hidden
                    >
                      <path d="M4 6l4 4 4-4" />
                    </svg>
                  </button>
                )}
              </div>
              <p className="mt-1 text-sm text-neutral-500">
                {list.length}명 · 작업물로 먼저 확인하세요
              </p>
            </div>
          </div>

          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="디자이너 이름, 키워드 검색"
            className="h-9 w-full min-w-0 rounded-lg border border-neutral-300 bg-white px-3 text-sm outline-none ring-violet-500 focus:ring-2 sm:w-64"
          />
        </div>

        {allTags.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-3 lg:hidden">
            <Chip on={!tag} onClick={() => setTag(null)}>
              전체
            </Chip>
            {allTags.map((t) => (
              <Chip key={t} on={tag === t} onClick={() => setTag(t)}>
                {t}
              </Chip>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4">
          {list.map((d) => (
            <DesignerCard key={d.id} designer={d} />
          ))}
        </div>

        {list.length === 0 && (
          <p className="py-20 text-center text-sm text-neutral-500">
            {designers.length === 0
              ? '아직 공개된 디자이너가 없습니다.'
              : '조건에 맞는 디자이너가 없습니다.'}
          </p>
        )}
      </main>

      {/* 목록 위에 덮는다 — 뒤가 비쳐야 무엇을 고르는 자리인지 읽힌다 */}
      {!asked && (
        <ScopePrompt
          current={scope}
          onPick={(s) => {
            setScope(s)
            setAsked(true)
          }}
          /* 다시 열어 '모르겠어요'를 누르면 고른 유형도 푼다 — 전체 보기 버튼을
             따로 두지 않으므로 거르기를 끄는 길은 여기다 */
          onSkip={() => {
            setScope(null)
            setAsked(true)
          }}
        />
      )}
    </div>
  )
}

/* 목록 한 줄.

   어드민 미리보기(designer-detail.tsx)도 이것을 그대로 쓴다 —
   베껴 두면 한쪽만 고쳐져 "실제로 이렇게 보인다"가 거짓이 된다. */
export function DesignerCard({ designer: d }: { designer: PublicDesignerCard }) {
  const href = `/designers/${d.id}`
  const name = displayNameOf(d)

  /* 카드에는 썸네일 몇 장만 담겨 온다(public-designers 의 CARD_THUMBS) —
     남은 장수를 "+N개" 로 알린다 */
  const more = d.works_total - d.works.length

  /* 썸네일을 누르면 상세 페이지로 가지 않고 그 자리에서 다이얼로그를 띄운다.
     모달이 넘길 수 있는 범위는 카드에 담겨 온 몇 장뿐이다 — 전체를 보려면
     "+N개 더보기" 로 상세 페이지로 간다. */
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  return (
    <article className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-neutral-200/70">
      <div className="flex flex-wrap items-center gap-3 p-4 md:flex-nowrap md:p-5">
        {/* 프로필 사진과 이름도 상세로 가는 길이다 — 아래 '프로필 보기'
            버튼과 같은 곳으로 간다. 분야 태그와 버튼은 이 링크 밖에 둔다:
            링크 안에 링크를 넣으면 HTML 상 허용되지 않는다. */}
        <h2 className="min-w-0 flex-1">
          <Link href={href} className="group/name flex min-w-0 items-center gap-3">
            <Avatar designer={d} />
            <span className="min-w-0 flex-1">
              <span className="block font-semibold transition group-hover/name:text-violet-600">
                {name}
              </span>
              {d.one_liner && (
                <span className="block truncate text-sm font-normal text-neutral-600">
                  {d.one_liner}
                </span>
              )}
            </span>
          </Link>
        </h2>
        {d.tags.length > 0 && (
          <div className="order-last flex w-full flex-wrap gap-1.5 md:order-none md:w-auto">
            {d.tags.map((t) => (
              <span key={t} className="rounded-md bg-neutral-100 px-2 py-1 text-[11px] text-neutral-600">
                {t}
              </span>
            ))}
          </div>
        )}
        <Link
          href={href}
          className="shrink-0 rounded-lg bg-neutral-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-violet-600"
        >
          프로필 보기
        </Link>
      </div>

      {/* 작업이 없는 디자이너도 있다 — 그때는 썸네일 줄을 아예 비운다 */}
      {d.works.length > 0 && (
        /* 높이를 고정하고 너비는 비율대로 — 가로/세로 썸네일이 한 줄에 자연스럽게 섞인다 */
        <div className="flex h-44 gap-2 overflow-x-auto px-4 pb-4 md:h-56 md:px-5 md:pb-5">
          {d.works.map((w, i) => (
            <button
              key={w.id}
              onClick={() => setOpenIndex(i)}
              aria-label={w.title ? `${w.title} 크게 보기` : '작업 크게 보기'}
              className="group relative h-full shrink-0 overflow-hidden rounded-lg"
            >
              <Img
                src={w.thumb_url}
                alt={w.title ?? ''}
                className={`h-full transition duration-500 group-hover:scale-[1.03] ${
                  isLandscape(w) ? 'aspect-[16/10]' : 'aspect-[9/16]'
                }`}
              />
              {w.title && (
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-2 text-left text-[11px] text-white opacity-0 transition group-hover:opacity-100">
                  {w.title}
                </span>
              )}
            </button>
          ))}

          {more > 0 && (
            <Link
              href={href}
              className="grid h-full w-24 shrink-0 place-items-center rounded-lg border border-dashed border-neutral-300 text-center text-xs text-neutral-500 hover:border-violet-400 hover:text-violet-600"
            >
              +{more}개
              <br />
              더보기
            </Link>
          )}
        </div>
      )}

      {openIndex !== null && (
        <WorkModal
          works={d.works}
          index={openIndex}
          setIndex={setOpenIndex}
          onClose={() => setOpenIndex(null)}
        />
      )}
    </article>
  )
}

/* 프로필 이미지가 없으면 이름 첫 글자로 채운다 — 빈 회색 원이 줄줄이 늘어서지 않게 */
function Avatar({ designer: d }: { designer: PublicDesignerCard }) {
  const name = displayNameOf(d)

  if (d.avatar_url) {
    return <Img src={d.avatar_url} alt={name} className="size-11 shrink-0 rounded-full" />
  }
  return (
    <div className="grid size-11 shrink-0 place-items-center rounded-full bg-neutral-200 text-sm font-medium text-neutral-500">
      {name.slice(0, 1)}
    </div>
  )
}

/* 원본 비율로 가로형을 가른다. 목업은 제목에 '웹·랜딩·대시보드'가 들어가면
   가로형으로 쳤지만, 실제 데이터는 업로드 때 받아 둔 width·height 가 있다.
   비율을 모르면 세로형으로 둔다 — 포트폴리오는 대개 세로로 길다. */
function isLandscape(w: PublicWork): boolean {
  if (!w.width || !w.height) return false
  return w.width > w.height
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ${
        on ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-600'
      }`}
    >
      {children}
    </button>
  )
}
