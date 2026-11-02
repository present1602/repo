'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import type { PublicDesignerCard, PublicWork } from '@/lib/designer-shape'
import { displayNameOf } from '@/lib/display-name'
import { Img } from './img'
import { WorkModal } from './work-modal'
import { ScopePrompt } from './scope-prompt'
import { InquiryButton } from './inquiry/inquiry-button'
import type { CategoryChoice, InquiryScope } from '@/lib/inquiry-choices'
import { isSearchable, searchHint } from '@/lib/search-term'

/* 기본 카드가 보여주는 작업 수 — 썸네일 줄과 다이얼로그 모두 이만큼만 */
const SPOTLIGHT_MAX = 4
import { SCOPES, SCOPE_LABELS, acceptsScope, type Scope } from '@/lib/scopes'
import type { SpecialtyScopeMode } from '@/lib/specialty-shape'

/* 제목 옆 의뢰 범위 필터 — 의뢰 폼에서 그 범위를 고를 수 있는 디자이너로 거른다.
   폼과 같은 선택지(designerChoices)를 보므로 탐색에 남은 디자이너는 폼에서도 그 범위가 열린다 */
const REACHES = [
  { key: 'all', label: '전체', scope: null },
  { key: 'design', label: '디자인', scope: 'design' },
  { key: 'design_dev', label: '디자인 + 개발', scope: 'design_dev' },
] as const satisfies readonly { key: string; label: string; scope: InquiryScope | null }[]
type Reach = (typeof REACHES)[number]['key']

export function DesignerList({
  designers,
  tags: allTags,
  scopeModes = {},
  descriptions = {},
  allDesc = '',
  featureIds = [],
  scopePrompt = true,
  choices,
  hiddenScopes = [],
}: {
  designers: PublicDesignerCard[]
  tags: string[]
  /* 분야 이름 → 의뢰 범위(039_specialty_scope_mode.sql). 없는 분야는 choice 로 본다 */
  scopeModes?: Record<string, SpecialtyScopeMode>
  /* 제목 아래 문구 — 분야 이름 → 문구, '전체'는 allDesc(0002_specialty_description.sql).
     비어 있으면 아무것도 보여주지 않는다 */
  descriptions?: Record<string, string>
  allDesc?: string
  /* 어드민이 위쪽에 썸네일 줄 카드(feature1)로 올린 디자이너, 차례대로.
     나머지는 기본 카드(대표 작업 한 장)로 그 아래에 선다(032_explore_features.sql). */
  featureIds?: string[]
  /* 의뢰유형을 묻는지 — 어드민 설정에서 끄면 묻는 창도, 제목 옆 표시도
     나오지 않는다(034_scope_prompt_toggle.sql) */
  scopePrompt?: boolean
  /* 디자이너 id → 의뢰 폼의 분야·범위·금액(designerChoices). 프리미엄까지 담으려고 서버에서 만들어 온다 */
  choices?: Record<string, CategoryChoice[]>
  /* 사이트에서 숨긴 플랜(038_plan_visibility.sql) — 팝업·필터에서 빼고, 이것만 받는 디자이너는 목록에서 뺀다 */
  hiddenScopes?: Scope[]
}) {
  const visibleScopes = useMemo(
    () => SCOPES.filter((s) => !hiddenScopes.includes(s)),
    [hiddenScopes],
  )
  const featureRank = useMemo(
    () => new Map(featureIds.map((id, i) => [id, i])),
    [featureIds],
  )
  const [tag, setTag] = useState<string | null>(null)
  const [q, setQ] = useState('')

  /* 한글 두 글자, 영문·숫자 네 글자부터 거른다(search-term.ts) — 그 전에는 전체를 둔다 */
  const term = q.trim()
  const searching = isSearchable(term)

  /* 이메일 @ 앞부분으로 찾은 디자이너 — 이메일은 목록에 없어 서버가 맞춰 id 만 준다
     (/api/designers/search). 어느 검색어의 결과인지 함께 둔다 — 입력이 바뀌면
     앞 검색어의 결과는 쓰지 않는다. 타자가 멈춘 뒤에 묻는다. */
  const [emailHits, setEmailHits] = useState<{ q: string; ids: Set<string> }>({
    q: '',
    ids: new Set(),
  })
  useEffect(() => {
    if (!searching) return
    const ctrl = new AbortController()
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/designers/search?q=${encodeURIComponent(term)}`, {
          signal: ctrl.signal,
        })
        const data = (await res.json()) as { ids?: string[] }
        setEmailHits({ q: term, ids: new Set(data.ids ?? []) })
      } catch {
        /* 끊기거나 취소되면 이름·소개 검색만으로 둔다 */
      }
    }, 250)
    return () => {
      clearTimeout(t)
      ctrl.abort()
    }
  }, [term, searching])

  /* 들어오자마자 어떤 의뢰인지 묻고, 그 유형을 받는 디자이너만 남긴다.
     null 이면 거르지 않는다 — 고르지 않고 닫은 경우다. */
  const [scope, setScope] = useState<Scope | null>(null)
  const [asked, setAsked] = useState(false)

  /* 의뢰유형까지 거른 목록 — 사이드바의 분야별 숫자도 이것으로 센다.
     전체에서 세면 아래 목록과 숫자가 어긋난다(유형을 고르면 2명인데 '전체 51'). */
  const shown = useMemo(
    () =>
      designers.filter((d) => {
        /* 받을 유형을 모두 끈 디자이너는 거르지 않을 때도 뺀다 — 탐색에는
           나오지 않고 프로필 링크로만 열리게 하려고 끈 것이다(plan-form.tsx) */
        if (!visibleScopes.some((s) => acceptsScope(d, s))) return false
        return !scope || acceptsScope(d, scope)
      }),
    [designers, scope, visibleScopes],
  )

  /* 의뢰 범위 필터 — 전체 또는 '고객이 선택'(choice) 분야에서만 보인다.
     디자인만·디자인 + 개발로 정해 둔 분야에서는 숨기고 거르지 않는다. 고른 값은
     남겨 두어 choice 분야로 돌아오면 그대로 걸린다. */
  const [reach, setReach] = useState<Reach>('all')
  const showReach = !tag || (scopeModes[tag] ?? 'choice') === 'choice'
  const reachScope = showReach ? REACHES.find((r) => r.key === reach)!.scope : null

  /* 이 디자이너의 의뢰 폼에 그 범위가 있는지 — 분야를 골랐으면 그 분야 안에서만 본다.
     선택지가 없으면(어드민 미리보기) 예전 스위치로 본다 */
  const offersScope = useCallback(
    (d: PublicDesignerCard, s: InquiryScope) => {
      const mine = choices?.[d.id]
      if (!mine) return acceptsScope(d, s === 'design_dev' ? 'with_dev' : 'full_design')
      return mine.some((c) => (!tag || c.name === tag) && c.options.some((o) => o.key === s))
    },
    [choices, tag],
  )

  const list = useMemo(() => {
    const needle = searching ? term.toLowerCase() : ''
    const byEmail = emailHits.q === term ? emailHits.ids : null
    const hit = shown.filter((d) => {
      if (tag && !d.tags.includes(tag)) return false
      if (reachScope && !offersScope(d, reachScope)) return false
      if (!needle) return true
      /* 이름·한 줄 소개·분야까지 함께 본다. 이름이 비어 있는 계정도 있으므로
         표시명으로 맞춘다 — 화면에 보이는 글자로 검색되는 게 자연스럽다.
         이메일로 찾은 디자이너도 더한다. */
      const hay = [displayNameOf(d), d.one_liner ?? '', ...d.tags].join(' ').toLowerCase()
      return hay.includes(needle) || (byEmail?.has(d.id) ?? false)
    })
    /* 올린 디자이너를 어드민이 정한 차례대로 앞에 세운다. 거르기는 똑같이 받는다 —
       분야를 골랐는데 상관없는 사람이 위에 남으면 필터가 고장 난 것처럼 보인다. */
    const up = hit
      .filter((d) => featureRank.has(d.id))
      .sort((a, b) => featureRank.get(a.id)! - featureRank.get(b.id)!)
    return [...up, ...hit.filter((d) => !featureRank.has(d.id))]
  }, [shown, tag, reachScope, offersScope, term, searching, emailHits, featureRank])

  /* 썸네일 다이얼로그는 목록 순서대로 디자이너들의 작업을 한 줄로 잇는다 —
     한 사람의 끝에서 넘기면 그 사람의 처음이 아니라 다음 디자이너의 첫 작업이 나온다.
     맨 처음과 맨 끝에서는 더 넘어가지 않는다(loop={false}).
     카드에 보이는 장만 잇는다 — 기본 카드는 SPOTLIGHT_MAX 장, feature1 은 담겨 온 전부. */
  const { flat, starts } = useMemo(() => {
    const flat: (PublicWork & { designer: PublicDesignerCard; nth: number; of: number })[] = []
    const starts = new Map<string, number>()
    for (const d of list) {
      starts.set(d.id, flat.length)
      const works = featureRank.has(d.id) ? d.works : d.works.slice(0, SPOTLIGHT_MAX)
      works.forEach((w, i) => flat.push({ ...w, designer: d, nth: i + 1, of: works.length }))
    }
    return { flat, starts }
  }, [list, featureRank])
  const [openAt, setOpenAt] = useState<number | null>(null)

  /* 분야를 바꾸면 목록이 통째로 바뀐다 — 내려가 있던 자리에 남으면
     새 목록의 중간부터 보이므로 맨 위로 올린다 */
  const pickTag = (t: string | null) => {
    setTag(t)
    window.scrollTo({ top: 0, behavior: 'instant' })
  }

  return (
    <div className="flex min-h-full bg-neutral-100 text-neutral-900">
      <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-60 shrink-0 overflow-y-auto border-r border-neutral-200 bg-white p-6 lg:block">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">전문 분야</p>
        <ul className="mt-3 space-y-0.5 text-sm">
          {[null, ...allTags].map((t) => {
            const n = t ? shown.filter((d) => d.tags.includes(t)).length : shown.length
            return (
              <li key={t ?? 'all'}>
                <button
                  onClick={() => pickTag(t)}
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

      {/* 본문 폭은 네비바와 같다(max-w-7xl, 좌우 안쪽 여백 md:px-8) — 카드의
          왼쪽 끝이 SOOM 로고에, 오른쪽 끝이 '의뢰하기' 버튼에 맞는다. 더 넓히면
          카드가 늘어나 글 오른쪽이 빈 바탕으로 남는다. */}
      {/* 가운데 맞춤은 사이드바를 뺀 나머지가 아니라 화면 전체 기준이다 — 네비바와
          같은 줄에 서려면. 왼쪽 여백 = (전체 폭 - 본문 폭) / 2 - 사이드바 폭.
          100vw 가 아니라 100% 로 잰다 — 스크롤바 폭이 들어가면 네비바와 어긋난다.
          화면이 좁아 음수가 되면 0 으로 — 사이드바 바로 옆에 붙어 남는 폭을 다 쓴다. */}
      <main className="mx-auto min-w-0 max-w-7xl flex-1 px-2 py-6 sm:px-4 md:px-8 md:py-8 lg:mx-0 lg:ml-[max(0px,calc((100%_-_80rem)_/_2_-_15rem))]">
        {/* 타이틀 영역 우측 끝에 키워드 검색 */}
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div className="flex items-start gap-3">
            <div>
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
                  {tag ?? 'Designers'}
                </h1>
                {showReach && (
                  <div
                    role="radiogroup"
                    aria-label="의뢰 범위"
                    className="inline-flex self-center rounded-full bg-neutral-200/70 p-0.5 text-xs"
                  >
                    {REACHES.map((r) => (
                      <button
                        key={r.key}
                        type="button"
                        role="radio"
                        aria-checked={reach === r.key}
                        onClick={() => setReach(r.key)}
                        className={`rounded-full px-2.5 py-1 transition ${
                          reach === r.key
                            ? 'bg-white font-semibold text-violet-700 shadow-sm'
                            : 'text-neutral-600 hover:text-neutral-900'
                        }`}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                )}
                {/* 고른 유형을 제목 옆에 늘 보이게 — 왜 목록이 짧은지 모르면
                    디자이너가 없는 줄 알고 되돌아간다. '모르겠어요'로 닫았으면
                    '전체'로 띄운다 — 유형을 고르는 자리가 있다는 걸 알려야 한다.
                    제목을 가리지 않게 테두리 없는 작은 글자로 두고, 눌러서 처음의
                    물음을 다시 연다 — 바꿀 수 있다는 걸 꺾쇠로 알린다. */}
                {scopePrompt && asked && (
                  <button
                    type="button"
                    onClick={() => setAsked(false)}
                    aria-label={`의뢰유형 변경 (지금: ${scope ? SCOPE_LABELS[scope] : '전체'})`}
                    className="inline-flex max-w-full items-center gap-1 text-xs text-violet-800 transition hover:text-violet-600"
                  >
                    <span className="shrink-0 text-violet-500">의뢰유형 :</span>
                    <span className="truncate font-semibold">
                      {scope ? SCOPE_LABELS[scope] : '전체'}
                    </span>
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
              {(tag ? descriptions[tag] : allDesc) && (
                <p className="mt-1 text-sm text-neutral-500">{tag ? descriptions[tag] : allDesc}</p>
              )}
            </div>
          </div>

          <div className="w-full min-w-0 sm:w-64">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="디자이너 이메일, 키워드 검색"
              aria-describedby="designer-search-hint"
              className="h-9 w-full min-w-0 rounded-lg border border-neutral-300 bg-white px-3 text-sm outline-none ring-violet-500 focus:ring-2"
            />
            {/* 기준에 못 미치면 왜 목록이 그대로인지 알린다 — 고장으로 보이지 않게.
                영문 안내('4글자부터')는 띄우지 않는다 — 한글 안내만 */}
            <p id="designer-search-hint" className="mt-1 min-h-4 text-[11px] text-neutral-400">
              {/[가-힣ㄱ-ㅣ]/.test(q) && searchHint(q)}
            </p>
          </div>
        </div>

        {allTags.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-3 lg:hidden">
            <Chip on={!tag} onClick={() => pickTag(null)}>
              전체
            </Chip>
            {allTags.map((t) => (
              <Chip key={t} on={tag === t} onClick={() => pickTag(t)}>
                {t}
              </Chip>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4">
          {list.map((d) =>
            featureRank.has(d.id) ? (
              <DesignerCard
                key={d.id}
                designer={d}
                choices={choices?.[d.id]}
                onOpenWork={(i) => setOpenAt(starts.get(d.id)! + i)}
              />
            ) : (
              <DesignerSpotlight
                key={d.id}
                designer={d}
                choices={choices?.[d.id]}
                onOpenWork={(i) => setOpenAt(starts.get(d.id)! + i)}
              />
            ),
          )}
        </div>

        {list.length === 0 && (
          <p className="py-20 text-center text-sm text-neutral-500">
            {designers.length === 0
              ? '아직 공개된 디자이너가 없습니다.'
              : '조건에 맞는 디자이너가 없습니다.'}
          </p>
        )}
      </main>

      {openAt !== null && (
        <WorkModal
          works={flat}
          index={openAt}
          setIndex={setOpenAt}
          onClose={() => setOpenAt(null)}
          nameOf={(w) => displayNameOf(w.designer)}
          hrefOf={(w) => `/designers/${w.designer.id}`}
          counterOf={(w) => [w.nth, w.of]}
          loop={false}
        />
      )}

      {/* 목록 위에 덮는다 — 뒤가 비쳐야 무엇을 고르는 자리인지 읽힌다 */}
      {scopePrompt && !asked && (
        <ScopePrompt
          current={scope}
          scopes={visibleScopes}
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
export function DesignerCard({
  designer: d,
  choices,
  onOpenWork,
}: {
  designer: PublicDesignerCard
  /* 의뢰 폼의 분야·범위·금액 — 없으면(어드민 미리보기) 폼이 일반 선택지를 받아 온다 */
  choices?: CategoryChoice[]
  /* 넘겨 주면 다이얼로그를 목록이 띄운다 — 다음 디자이너까지 이어 넘기려면
     모달이 카드 하나보다 위에 있어야 한다. 없으면(어드민 미리보기) 카드가 띄운다. */
  onOpenWork?: (i: number) => void
}) {
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
        {/* 프로필로 넘어가지 않고 이 자리에서 바로 의뢰할 수 있게 */}
        <div className="flex shrink-0 gap-2">
          <Link
            href={href}
            className="rounded-lg border border-neutral-300 px-4 py-2 text-xs font-semibold text-neutral-800 transition hover:border-neutral-900"
          >
            프로필 보기
          </Link>
          <InquiryButton
            designerId={d.id}
            designerName={name}
            choices={choices}
            className="rounded-lg bg-neutral-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-violet-600"
          />
        </div>
      </div>

      {/* 작업이 없는 디자이너도 있다 — 그때는 썸네일 줄을 아예 비운다 */}
      {d.works.length > 0 && (
        /* 태블릿 이상 — 높이를 고정하고 너비는 비율대로. 가로/세로 썸네일이 한 줄에
           자연스럽게 섞인다. 디자이너가 아직 많지 않아 카드 하나를 크게 보여 준다.
           스마트폰 — 폭이 좁아 여러 장을 늘어놓으면 하나하나가 너무 작다.
           첫 작업 한 장만 카드 폭에 꽉 채우고, 나머지는 상세에서 본다. */
        <div className="flex gap-2 overflow-x-auto px-4 pb-4 sm:h-64 md:h-80 md:px-5 md:pb-5">
          {d.works.map((w, i) => (
            <button
              key={w.id}
              onClick={() => (onOpenWork ? onOpenWork(i) : setOpenIndex(i))}
              aria-label={w.title ? `${w.title} 크게 보기` : '작업 크게 보기'}
              className={`group relative w-full shrink-0 overflow-hidden rounded-lg sm:h-full sm:w-auto ${
                i > 0 ? 'hidden sm:block' : ''
              }`}
            >
              <Img
                src={w.thumb_url}
                alt={w.title ?? ''}
                className="w-full transition duration-500 group-hover:scale-[1.03] sm:h-full sm:w-auto"
                style={{ aspectRatio: cardRatio(w) }}
                focus="center"
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
              className="hidden h-full w-24 shrink-0 place-items-center rounded-lg border border-dashed border-neutral-300 text-center text-xs text-neutral-500 hover:border-violet-400 hover:text-violet-600 sm:grid"
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
          nameOf={() => displayNameOf(d)}
        />
      )}
    </article>
  )
}

/* 기본 카드 — 대표 작업 한 장을 크게, 오른쪽에 프로필과 버튼.

   작업을 한두 개만 올린 디자이너가 많다. 썸네일을 한 줄로 늘어놓는 카드
   (DesignerCard, feature1)는 네 장은 있어야 줄이 차서, 적으면 휑해 보였다.
   한 장을 크게 두면 한 장뿐이어도 카드가 꽉 찬다.

   그림 아래 작은 썸네일(최대 SPOTLIGHT_MAX 장)로 이 디자이너의 다른 작업을
   골라 보고, 큰 그림을 누르면 상세 다이얼로그가 그 작업부터 열린다.
   그보다 많으면 끝에 "+N" 을 두어 프로필에서 마저 보게 한다. */
function DesignerSpotlight({
  designer: d,
  choices,
  onOpenWork,
}: {
  designer: PublicDesignerCard
  choices?: CategoryChoice[]
  onOpenWork: (i: number) => void
}) {
  const href = `/designers/${d.id}`
  const name = displayNameOf(d)
  const [cur, setCur] = useState(0)
  const works = d.works.slice(0, SPOTLIGHT_MAX)
  const n = works.length
  const w = works[cur]
  /* 카드에 담겨 온 장수가 아니라 전체 장수로 센다 */
  const more = d.works_total - n

  return (
    <article className="overflow-hidden rounded-2xl bg-white p-3 shadow-sm ring-1 ring-neutral-200/70 md:p-4">
      {/* 그림 칸은 넓은 화면에서 680px 까지만 — 더 키우면 크게 보기(작업 모달)보다
          목록의 그림이 커져 눌러 볼 이유가 없어진다 */}
      <div className="grid gap-5 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] md:items-center md:gap-10 xl:grid-cols-[minmax(0,680px)_minmax(0,1fr)]">
        <div className="min-w-0">
          <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-neutral-100">
            {w ? (
              <button
                type="button"
                onClick={() => onOpenWork(cur)}
                aria-label={w.title ? `${w.title} 크게 보기` : '작업 크게 보기'}
                className="group block size-full"
              >
                {/* 긴 화면 캡처도 첫 화면(위쪽)이 보이게 위를 맞춘다 */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={w.thumb_url}
                  alt={w.title ?? ''}
                  loading="lazy"
                  className="size-full object-cover object-top transition duration-500 group-hover:scale-[1.02]"
                />
              </button>
            ) : (
              <p className="grid size-full place-items-center text-sm text-neutral-400">
                아직 공개된 작업이 없습니다.
              </p>
            )}

          </div>

          {/* 다른 작업 — 그림 아래에 작은 네모로 왼쪽부터. 한 장뿐이면 고를 게 없으니
              띄우지 않는다. 그림 위에 겹쳐 두면 좁은 화면에서 그림을 가린다. */}
          {n > 1 && (
            <div className="mt-2.5 flex gap-2">
              {works.map((t, i) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setCur(i)}
                  aria-label={`${i + 1}번째 작업`}
                  aria-current={i === cur}
                  className={`size-12 shrink-0 overflow-hidden rounded-md transition md:size-14 ${
                    i === cur
                      ? 'ring-2 ring-violet-500 ring-offset-1'
                      : 'opacity-70 ring-1 ring-neutral-200 hover:opacity-100'
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={t.thumb_url} alt="" loading="lazy" className="size-full object-cover" />
                </button>
              ))}
              {more > 0 && (
                <Link
                  href={href}
                  aria-label={`작업 ${more}개 더 보기`}
                  className="grid size-12 shrink-0 place-items-center rounded-md bg-neutral-100 text-xs font-semibold text-neutral-500 transition hover:bg-neutral-200 hover:text-neutral-800 md:size-14"
                >
                  +{more}
                </Link>
              )}
            </div>
          )}
        </div>

        <div className="px-2 pb-3 md:px-0 md:py-4 md:pr-6">
          <Link href={href} className="group/name flex items-center gap-3">
            <Avatar designer={d} size="size-14" />
            <span className="min-w-0 truncate text-2xl font-bold tracking-tight transition group-hover/name:text-violet-600 md:text-3xl">
              {name}
            </span>
          </Link>

          {d.one_liner && (
            <p className="mt-4 text-base leading-relaxed text-neutral-800 md:text-lg">
              {d.one_liner}
            </p>
          )}

          {d.tags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {d.tags.map((t) => (
                <span key={t} className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs text-neutral-600">
                  {t}
                </span>
              ))}
            </div>
          )}

          {/* 지금 보고 있는 작업 — 제목·클라이언트는 선택 입력이라 없으면 줄을 비운다 */}
          {w?.title && (
            <p className="mt-4 truncate text-xs text-neutral-500">
              현재 작업 · {w.title}
              {w.client && ` — ${w.client}`}
            </p>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-2">
            <Link
              href={href}
              className="rounded-full border border-neutral-300 px-5 py-2.5 text-sm font-semibold text-neutral-800 transition hover:border-neutral-900"
            >
              프로필 보기
            </Link>
            <InquiryButton
              designerId={d.id}
              designerName={name}
              choices={choices}
              className="rounded-full bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-700"
            />
          </div>
        </div>
      </div>
    </article>
  )
}

/* 프로필 이미지가 없으면 이름 첫 글자로 채운다 — 빈 회색 원이 줄줄이 늘어서지 않게 */
function Avatar({ designer: d, size = 'size-11' }: { designer: PublicDesignerCard; size?: string }) {
  const name = displayNameOf(d)

  if (d.avatar_url) {
    return <Img src={d.avatar_url} alt={name} className={`${size} shrink-0 rounded-full`} />
  }
  return (
    <div
      className={`grid ${size} shrink-0 place-items-center rounded-full bg-neutral-200 text-sm font-medium text-neutral-500`}
    >
      {name.slice(0, 1)}
    </div>
  )
}

/* 원본 비율로 가로형을 가른다. 목업은 제목에 '웹·랜딩·대시보드'가 들어가면
   가로형으로 쳤지만, 실제 데이터는 업로드 때 받아 둔 width·height 가 있다.
   비율을 모르면 세로형으로 둔다 — 포트폴리오는 대개 세로로 길다. */
/* 목록 카드 썸네일 칸의 비율(가로/세로).

   가로형은 16:10 으로 맞춘다. 세로형은 자기 비율대로 두되 3:4 보다 길면
   3:4 에서 끊고 가운데를 보여 준다 — 긴 페이지 스크린샷이 칸을 길쭉하게
   만들지 않게. 크기를 모르면 3:4 로 둔다. */
const CARD_LANDSCAPE = 16 / 10
const CARD_MAX_TALL = 3 / 4

function cardRatio(w: PublicWork): number {
  if (!w.width || !w.height) return CARD_MAX_TALL
  const r = w.width / w.height
  if (r > 1) return CARD_LANDSCAPE
  return Math.max(r, CARD_MAX_TALL)
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
