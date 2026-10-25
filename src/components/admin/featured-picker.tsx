'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { type FeaturedCandidate, thumbSrc } from '@/lib/portfolio-limits'
import { displayName } from '@/lib/display-name'
import { isSearchable, searchHint, matches } from '@/lib/search-term'
import { setWorkFeatured } from '@/app/admin/designers/actions'
import { Img } from '@/components/img'

type Notice = { kind: 'ok' | 'error'; text: string } | null
type Tab = 'portfolio' | 'recent'

/* 메인에 걸 작업을 고르는 화면.

   보기를 둘로 나눈다 —
     포트폴리오: 디자이너별로 묶고, 썸네일은 원본 비율 그대로 늘어선다.
                 한 사람의 작업 결을 보고 고를 때 쓴다.
     최신순:     올라온 차례로 3열 그리드. 새로 올라온 것을 훑을 때 쓴다. */
export function FeaturedPicker({ works }: { works: FeaturedCandidate[] }) {
  const [tab, setTab] = useState<Tab>('portfolio')
  const [query, setQuery] = useState('')
  const [notice, setNotice] = useState<Notice>(null)

  const hint = searchHint(query)
  const filtering = isSearchable(query)

  const shown = useMemo(() => {
    /* 기준 글자 수에 못 미치면 거르지 않는다 — 한 글자마다 목록이
       요동치면 뭘 찾던 중이었는지 놓친다(search-term.ts). */
    if (!filtering) return works
    return works.filter(
      (w) =>
        matches(w.title, query) ||
        matches(displayName(w.designer), query) ||
        matches(w.designer.email, query),
    )
  }, [works, query, filtering])

  const picked = works.filter((w) => w.featured).length

  return (
    <section className="min-w-0">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">작업 고르기</h1>
          <p className="mt-1 text-sm text-neutral-500">
            메인에 걸 작업을 고릅니다 · 지금 {picked}개
          </p>
        </div>

        <div className="w-full sm:w-72">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="디자이너 이름 · 작업 제목"
            aria-label="디자이너 이름 또는 작업 제목으로 검색"
            className="h-9 w-full rounded-lg border border-neutral-300 px-3 text-sm outline-none ring-indigo-500 focus:ring-2"
          />
          {hint && <p className="mt-1 text-xs text-neutral-400">{hint}</p>}
        </div>
      </header>

      <nav className="mb-5 flex gap-1 border-b border-neutral-200">
        <TabButton on={tab === 'portfolio'} onClick={() => setTab('portfolio')}>
          포트폴리오
        </TabButton>
        <TabButton on={tab === 'recent'} onClick={() => setTab('recent')}>
          최신순
        </TabButton>
      </nav>

      {notice && (
        <p
          className={`mb-4 rounded-lg px-3.5 py-3 text-sm ${
            notice.kind === 'ok' ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'
          }`}
        >
          {notice.text}
        </p>
      )}

      {shown.length === 0 ? (
        <p className="rounded-xl border border-dashed border-neutral-300 py-16 text-center text-sm text-neutral-500">
          {filtering ? '검색 결과가 없습니다.' : '등록된 작업이 없습니다.'}
        </p>
      ) : tab === 'portfolio' ? (
        <PortfolioView works={shown} onNotice={setNotice} />
      ) : (
        <RecentView works={shown} onNotice={setNotice} />
      )}
    </section>
  )
}

function TabButton({
  on,
  onClick,
  children,
}: {
  on: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      aria-current={on ? 'page' : undefined}
      /* 밑줄이 테두리 위에 겹치도록 -1px 내린다 */
      className={`-mb-px border-b-2 px-3 py-2.5 text-sm font-medium transition ${
        on
          ? 'border-neutral-900 text-neutral-900'
          : 'border-transparent text-neutral-500 hover:text-neutral-800'
      }`}
    >
      {children}
    </button>
  )
}

/* ─────────── 포트폴리오 보기 ───────────

   디자이너별로 묶고, 썸네일은 원본 비율 그대로 늘어선다.
   높이를 고정하고 너비를 비율대로 두면 가로·세로 사진이 한 줄에
   자연스럽게 섞이고, 줄이 차면 다음 줄로 넘어가 쌓인다. */

type Group = { designer: FeaturedCandidate['designer']; works: FeaturedCandidate[] }

function groupByDesigner(works: FeaturedCandidate[]): Group[] {
  const by = new Map<string, Group>()
  for (const w of works) {
    const g = by.get(w.designer.id)
    if (g) g.works.push(w)
    else by.set(w.designer.id, { designer: w.designer, works: [w] })
  }
  return Array.from(by.values())
}

function PortfolioView({
  works,
  onNotice,
}: {
  works: FeaturedCandidate[]
  onNotice: (n: Notice) => void
}) {
  const groups = useMemo(() => groupByDesigner(works), [works])

  return (
    <div className="space-y-5">
      {groups.map((g) => {
        const name = displayName(g.designer)
        const hidden = !g.designer.visible || !g.designer.profile_public

        return (
          <section
            key={g.designer.id}
            className="overflow-hidden rounded-xl bg-white ring-1 ring-neutral-200"
          >
            <header className="flex items-center gap-3 border-b border-neutral-200 p-4">
              {g.designer.avatar_url ? (
                <Img
                  src={g.designer.avatar_url}
                  alt={name}
                  className="size-10 shrink-0 rounded-full"
                />
              ) : (
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-neutral-200 text-sm font-medium text-neutral-500">
                  {name.slice(0, 1)}
                </span>
              )}

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-semibold">{name}</p>
                  {hidden && (
                    <span className="shrink-0 rounded bg-neutral-200 px-1.5 py-0.5 text-[11px] text-neutral-600">
                      비공개 — 골라도 메인에 안 뜸
                    </span>
                  )}
                </div>
                <p className="truncate text-xs text-neutral-500">{g.designer.email}</p>
              </div>

              <span className="shrink-0 text-xs text-neutral-400">{g.works.length}장</span>
            </header>

            {/* 높이 고정 + 너비 자동 — 비율을 지키며 줄바꿈된다 */}
            <div className="flex flex-wrap gap-3 p-4">
              {g.works.map((w) => (
                <RatioCard key={w.id} work={w} onNotice={onNotice} />
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}

/* 원본 비율을 지키는 한 장 — 높이만 맞추고 너비는 비율이 정한다 */
function RatioCard({
  work: w,
  onNotice,
}: {
  work: FeaturedCandidate
  onNotice: (n: Notice) => void
}) {
  const { pending, toggle } = useToggle(w, onNotice)

  /* 비율을 모르면 4:3 으로 둔다 — 자리만 잡는 용도다.

     높이를 고정하면 너비는 비율이 정한다. 다만 아주 긴 세로 사진은
     60px 남짓까지 좁아져 무엇인지 알아볼 수 없으므로, 바닥을 둬서
     그보다 좁아지지 않게 한다(그 경우만 위아래가 잘린다). */
  const ratio = w.width && w.height ? w.width / w.height : 4 / 3

  return (
    <button
      onClick={toggle}
      disabled={pending}
      className={`group relative h-36 min-w-24 shrink-0 overflow-hidden rounded-lg text-left ring-2 transition disabled:opacity-50 md:h-44 ${
        w.featured ? 'ring-indigo-600' : 'ring-transparent hover:ring-neutral-300'
      }`}
      style={{ aspectRatio: `${ratio}` }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={thumbSrc(w)}
        alt={w.title ?? ''}
        loading="lazy"
        className={`size-full object-cover ${w.visible ? '' : 'opacity-40'}`}
      />

      <Overlay work={w} pending={pending} />
    </button>
  )
}

/* ─────────── 최신순 보기 ───────────

   올라온 차례대로 3열 그리드. 썸네일 아래에 제목과 디자이너명을 적는다 —
   누구 작업인지 알아야 한쪽으로 치우치지 않게 고를 수 있다. */
function RecentView({
  works,
  onNotice,
}: {
  works: FeaturedCandidate[]
  onNotice: (n: Notice) => void
}) {
  /* 받아 온 순서는 '고른 것 먼저'다(listWorksForFeature) —
     이 탭에서는 올라온 차례만 본다. */
  const sorted = useMemo(
    () =>
      [...works].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      ),
    [works],
  )

  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {sorted.map((w) => (
        <RecentCard key={w.id} work={w} onNotice={onNotice} />
      ))}
    </ul>
  )
}

function RecentCard({
  work: w,
  onNotice,
}: {
  work: FeaturedCandidate
  onNotice: (n: Notice) => void
}) {
  const { pending, toggle } = useToggle(w, onNotice)

  return (
    <li>
      <button
        onClick={toggle}
        disabled={pending}
        className={`group block w-full overflow-hidden rounded-xl bg-white text-left ring-2 transition disabled:opacity-50 ${
          w.featured ? 'ring-indigo-600' : 'ring-neutral-200 hover:ring-neutral-400'
        }`}
      >
        <span className="relative block">
          <Img
            src={thumbSrc(w)}
            alt={w.title ?? ''}
            ratio="aspect-[4/3]"
            className={w.visible ? '' : 'opacity-40'}
          />
          <Overlay work={w} pending={pending} />
        </span>

        <span className="block p-3">
          <span className="block truncate text-sm font-medium">
            {w.title ?? <span className="text-neutral-400">제목 없음</span>}
          </span>
          <span className="mt-0.5 block truncate text-xs text-neutral-500">
            {displayName(w.designer)}
          </span>
          <span className="mt-1 block text-[11px] text-neutral-400">
            {new Date(w.created_at).toLocaleDateString('ko-KR')}
          </span>
        </span>
      </button>
    </li>
  )
}

/* ─────────── 공통 ─────────── */

/* 고른 상태를 뒤집는다. 뺄 때만 한 번 묻는다 —
   더하는 건 되돌리기 쉽지만, 빼는 건 어떤 구성이었는지 잊기 쉽다. */
function useToggle(w: FeaturedCandidate, onNotice: (n: Notice) => void) {
  const [pending, start] = useTransition()
  const router = useRouter()

  const toggle = () => {
    if (w.featured && !confirm('선택을 해제하시겠습니까?')) return

    onNotice(null)
    start(async () => {
      const r = await setWorkFeatured(w.id, !w.featured)
      if (!r.ok) {
        onNotice({ kind: 'error', text: r.error })
        return
      }
      router.refresh()
    })
  }

  return { pending, toggle }
}

/* 썸네일 위에 덮는 상태 표시 — 고른 것은 늘 보이고,
   고르지 않은 것은 올렸을 때만 '추가' 가 뜬다. */
function Overlay({ work: w, pending }: { work: FeaturedCandidate; pending: boolean }) {
  return (
    <>
      {!w.visible && (
        <span className="absolute left-2 top-2 rounded bg-neutral-900/80 px-1.5 py-0.5 text-[11px] text-white">
          숨김
        </span>
      )}

      {w.featured ? (
        <span className="absolute right-2 top-2 rounded bg-indigo-600 px-2 py-1 text-[11px] font-semibold text-white">
          {pending ? '…' : '선택됨'}
        </span>
      ) : (
        <span className="absolute right-2 top-2 rounded bg-white/90 px-2 py-1 text-[11px] font-semibold text-neutral-900 opacity-0 transition group-hover:opacity-100">
          {pending ? '…' : '추가'}
        </span>
      )}
    </>
  )
}
