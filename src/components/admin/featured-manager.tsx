'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { FeaturedCandidate } from '@/lib/portfolio-limits'
import { displayName } from '@/lib/display-name'
import { isSearchable, searchHint, matches } from '@/lib/search-term'
import { setWorkFeatured } from '@/app/admin/designers/actions'
import { Img } from '@/components/img'

type Notice = { kind: 'ok' | 'error'; text: string } | null

export function FeaturedManager({ works }: { works: FeaturedCandidate[] }) {
  const [query, setQuery] = useState('')
  /* 디자이너 한 명으로 좁혀 보는 중인지 — 작업 위 '포트폴리오' 버튼으로 켠다.
     검색어와 함께 걸릴 수 있다(그 디자이너 안에서 제목 검색). */
  const [onlyDesigner, setOnlyDesigner] = useState<string | null>(null)
  const [notice, setNotice] = useState<Notice>(null)

  const hint = searchHint(query)
  const filtering = isSearchable(query)

  const shown = useMemo(() => {
    let list = works

    if (onlyDesigner) {
      list = list.filter((w) => w.designer.id === onlyDesigner)
    }

    /* 기준 글자 수에 못 미치면 거르지 않는다 — 한 글자마다 목록이
       요동치면 뭘 찾던 중이었는지 놓친다(search-term.ts). */
    if (filtering) {
      list = list.filter(
        (w) =>
          matches(w.title, query) ||
          matches(displayName(w.designer), query) ||
          matches(w.designer.email, query),
      )
    }

    return list
  }, [works, onlyDesigner, query, filtering])

  /* 디자이너별로 묶어 보여준다 — 프로필 줄 아래에 그 사람의 작업이 깔린다 */
  const groups = useMemo(() => groupByDesigner(shown), [shown])

  const picked = works.filter((w) => w.featured).length

  return (
    <section className="min-w-0">
      <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">메인 노출</h1>
          <p className="mt-1 text-sm text-neutral-500">
            메인 화면에 걸 작업을 고릅니다 · 고른 작업 {picked}개
          </p>
        </div>

        {/* 검색은 우측 상단 */}
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

      {notice && (
        <p
          className={`mb-4 rounded-lg px-3.5 py-3 text-sm ${
            notice.kind === 'ok' ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'
          }`}
        >
          {notice.text}
        </p>
      )}

      {/* 한 명으로 좁혀 둔 상태를 항상 보이게 — 왜 목록이 짧은지 모르면
          데이터가 없는 줄 알고 다시 올린다 */}
      {onlyDesigner && (
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-indigo-50 px-3.5 py-2.5 text-sm text-indigo-800">
          <span className="truncate">
            <b className="font-semibold">{groups[0]?.designer.name ?? '디자이너'}</b>의 포트폴리오만
            보는 중
          </span>
          <button
            onClick={() => setOnlyDesigner(null)}
            className="ml-auto shrink-0 rounded-md border border-indigo-200 bg-white px-2.5 py-1 text-xs font-medium transition hover:bg-indigo-100"
          >
            전체 보기
          </button>
        </div>
      )}

      {shown.length === 0 ? (
        <p className="rounded-xl border border-dashed border-neutral-300 py-16 text-center text-sm text-neutral-500">
          {filtering || onlyDesigner ? '검색 결과가 없습니다.' : '등록된 작업이 없습니다.'}
        </p>
      ) : (
        <div className="space-y-5">
          {groups.map((g) => (
            <DesignerGroup
              key={g.designer.id}
              group={g}
              /* 이미 한 명만 보고 있으면 좁히는 버튼은 의미가 없다 */
              filtered={Boolean(onlyDesigner)}
              onFilter={() => setOnlyDesigner(g.designer.id)}
              onNotice={setNotice}
            />
          ))}
        </div>
      )}
    </section>
  )
}

/* ─────────── 디자이너 한 묶음 ─────────── */

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

function DesignerGroup({
  group: g,
  filtered,
  onFilter,
  onNotice,
}: {
  group: Group
  filtered: boolean
  onFilter: () => void
  onNotice: (n: Notice) => void
}) {
  const name = displayName(g.designer)
  /* 디자이너 쪽이 닫혀 있으면 작업을 골라도 메인에 안 뜬다 —
     고르고 나서 "왜 안 보이지" 로 헤매지 않게 미리 알린다. */
  const hidden = !g.designer.visible || !g.designer.profile_public

  return (
    <section className="overflow-hidden rounded-xl bg-white ring-1 ring-neutral-200">
      {/* 프로필 줄 — 아바타·이름·이메일, 우측에 포트폴리오 버튼 */}
      <header className="flex items-center gap-3 border-b border-neutral-200 p-4">
        {g.designer.avatar_url ? (
          <Img src={g.designer.avatar_url} alt={name} className="size-10 shrink-0 rounded-full" />
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

        {!filtered && (
          <button
            onClick={onFilter}
            className="shrink-0 rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium transition hover:border-neutral-900"
          >
            포트폴리오
          </button>
        )}
      </header>

      <ul className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {g.works.map((w) => (
          <WorkCard key={w.id} work={w} onNotice={onNotice} />
        ))}
      </ul>
    </section>
  )
}

/* ─────────── 작업 한 장 ─────────── */

function WorkCard({ work: w, onNotice }: { work: FeaturedCandidate; onNotice: (n: Notice) => void }) {
  const [pending, start] = useTransition()
  const router = useRouter()

  const toggle = () => {
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

  return (
    <li>
      <button
        onClick={toggle}
        disabled={pending}
        aria-pressed={w.featured}
        className={`group relative block w-full overflow-hidden rounded-lg text-left ring-2 transition disabled:opacity-50 ${
          w.featured ? 'ring-indigo-600' : 'ring-transparent hover:ring-neutral-300'
        }`}
      >
        <Img
          src={w.image_url}
          alt={w.title ?? ''}
          ratio="aspect-[4/3]"
          className={w.visible ? '' : 'opacity-40'}
        />

        {/* 고른 표시 — 체크 뱃지 */}
        {w.featured && (
          <span className="absolute left-2 top-2 grid size-6 place-items-center rounded-full bg-indigo-600 text-xs font-bold text-white">
            ✓
          </span>
        )}

        {/* 디자이너가 내린 작업 — 골라도 메인에 안 뜬다 */}
        {!w.visible && (
          <span className="absolute right-2 top-2 rounded bg-neutral-900/80 px-1.5 py-0.5 text-[11px] text-white">
            숨김
          </span>
        )}

        <p className="truncate px-2 py-2 text-xs text-neutral-600">
          {w.title ?? <span className="text-neutral-400">제목 없음</span>}
        </p>
      </button>
    </li>
  )
}
