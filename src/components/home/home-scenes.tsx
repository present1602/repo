'use client'

import { Fragment, useState } from 'react'
import type { FeedWork } from '@/lib/designer-shape'
import { displayNameOf } from '@/lib/display-name'
import { ExploreLink } from '@/components/explore-gate'
import { WorkModal } from '@/components/work-modal'

/* 분야별 장면 — 한 분야가 한 화면을 차지하고, 스크롤하면 다음 분야가 아래에서
   올라와 앞 장면을 덮는다(sticky 로 쌓인다). 덮이는 장면은 뒤로 물러나며 어두워진다.

   움직임은 CSS 변수(--e·--c, home-scroll.tsx)에 걸려 있다 — 이 컴포넌트는 자리만 잡는다.
   그림을 누르면 피드와 같은 작업 모달이 뜬다. */

export type Scene = {
  id: string
  name: string
  description: string | null
  works: FeedWork[]
}

/* 장면마다 번지는 색 — 차례대로 돌려 쓴다. 첫 장면은 사이트 기본색 */
const HUES = ['#4f3dff', '#ff5a36', '#00b89f', '#ff3d9a', '#e0a800', '#2f9bff']

/* 그림 자리 — [위치·크기, 늦게 올라오는 정도(px)]. 장수(1~3)에 따라 다르게 놓는다 */
const FRAMES: Record<number, [string, number][]> = {
  1: [['lg:left-[8%] lg:top-[6%] lg:w-[78%] lg:aspect-[4/3]', 160]],
  2: [
    ['lg:left-0 lg:top-[14%] lg:w-[52%] lg:aspect-[3/4]', 120],
    ['lg:right-0 lg:top-0 lg:w-[42%] lg:aspect-[4/5]', 300],
  ],
  3: [
    ['lg:left-0 lg:top-[16%] lg:w-[48%] lg:aspect-[3/4]', 110],
    ['lg:right-0 lg:top-0 lg:w-[46%] lg:aspect-[4/3]', 240],
    ['lg:right-[6%] lg:bottom-0 lg:w-[36%] lg:aspect-square', 420],
  ],
}

export function HomeScenes({ scenes }: { scenes: Scene[] }) {
  const all = scenes.flatMap((s) => s.works)
  const [index, setIndex] = useState<number | null>(null)

  if (scenes.length === 0) return null

  return (
    <div className="relative">
      {scenes.map((s, i) => {
        const hue = HUES[i % HUES.length]
        const frames = FRAMES[Math.min(3, s.works.length)] ?? []
        return (
          <Fragment key={s.id}>
            {/* 위치 표식 — sticky 인 장면 대신 좌측 메뉴가 이 자리를 잰다(home-rail.tsx) */}
            <div data-spy={s.id} className="h-0" />
            <section
              data-scene
              /* home-scroll.tsx 가 하이드레이션 전에 style(--e·--c)을 적어 둘 수 있다 */
              suppressHydrationWarning
              aria-label={s.name}
              className="sticky top-0 h-[100svh] overflow-hidden"
            >
              <div className="home-scene-inner absolute inset-0 overflow-hidden rounded-t-[1.75rem] border-t border-white/10 bg-[#08080c] text-white md:rounded-t-[2.5rem]">
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0"
                  style={{
                    background: `radial-gradient(ellipse 70% 60% at 85% 90%, ${hue}55, transparent 70%), radial-gradient(ellipse 40% 40% at 10% 0%, ${hue}22, transparent 70%)`,
                  }}
                />

                <div className="relative flex h-full flex-col gap-6 px-5 pb-20 pt-20 md:px-10 lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-12 lg:pb-12 lg:pl-60 lg:pr-12 lg:pt-28">
                  <div className="flex min-w-0 flex-col lg:justify-between">
                    <div className="home-scene-title">
                      <p className="flex items-center gap-3 font-mono text-xs tracking-widest text-white/50">
                        <span className="size-1.5 rounded-full" style={{ background: hue }} />
                        {String(i + 1).padStart(2, '0')} / {String(scenes.length).padStart(2, '0')}
                      </p>
                      <h2 className="mt-4 font-display text-[clamp(3.25rem,8.5vw,8.5rem)] font-light leading-[1.02] tracking-[-0.03em]">
                        {s.name}
                      </h2>
                    </div>

                    <div className="mt-4 max-w-sm lg:mt-0">
                      {s.description && (
                        <p className="text-sm leading-relaxed text-white/70 md:text-base">{s.description}</p>
                      )}
                      <p className="mt-3 text-xs text-white/40">
                        by {Array.from(new Set(s.works.map((w) => displayNameOf(w.designer)))).join(' · ')}
                      </p>
                      <ExploreLink className="group mt-5 inline-flex h-10 items-center gap-2 rounded-full bg-white/10 px-5 text-sm text-white backdrop-blur transition hover:bg-white hover:text-black">
                        {s.name} 디자이너 보기
                        <span aria-hidden className="transition-transform group-hover:translate-x-1">→</span>
                      </ExploreLink>
                    </div>
                  </div>

                  {/* 그림 — 넓은 화면은 엇갈려 겹치고, 좁은 화면은 남은 높이를 둘로 나눠 쓴다 */}
                  <div className="relative min-h-0 flex-1 max-lg:grid max-lg:grid-cols-2 max-lg:gap-3">
                    {s.works.slice(0, 3).map((w, k) => {
                      const [place, delay] = frames[k]
                      return (
                        <button
                          key={w.id}
                          type="button"
                          onClick={() => setIndex(all.indexOf(w))}
                          aria-label={w.title ?? `${s.name} 작업 보기`}
                          style={{ '--k': `${delay}px` } as React.CSSProperties}
                          className={`home-float group overflow-hidden rounded-xl bg-white/5 shadow-2xl shadow-black/60 ring-1 ring-white/10 relative max-lg:h-full lg:absolute lg:rounded-2xl ${place} ${k === 2 ? 'max-lg:hidden' : ''} ${s.works.length === 1 ? 'max-lg:col-span-2' : ''}`}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element -- 버킷의 썸네일을 그대로 쓴다(img.tsx 와 같은 방침) */}
                          <img
                            src={w.thumb_url}
                            alt={w.title ?? ''}
                            loading="lazy"
                            className="size-full object-cover object-top transition-transform duration-700 ease-out group-hover:scale-[1.05]"
                          />
                          <span className="pointer-events-none absolute inset-x-0 bottom-0 flex translate-y-2 items-end justify-between gap-3 bg-gradient-to-t from-black/75 to-transparent p-4 pt-10 text-left text-sm opacity-0 transition duration-300 group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100">
                            <span className="line-clamp-1 font-medium">{w.title ?? displayNameOf(w.designer)}</span>
                            <span className="shrink-0 rounded-full bg-white px-3 py-1 text-xs font-medium text-black">보기</span>
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            </section>
          </Fragment>
        )
      })}

      {index !== null && (
        <WorkModal
          works={all}
          index={index}
          setIndex={setIndex}
          onClose={() => setIndex(null)}
          nameOf={(w) => displayNameOf(w.designer)}
          hrefOf={(w) => `/designers/${w.designer.id}`}
        />
      )}
    </div>
  )
}
