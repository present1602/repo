'use client'

import { useEffect, useState } from 'react'
import { publicUrl, type PublicPopup } from '@/lib/popup-shape'

/* 홈에 뜨는 팝업(023_popups.sql).

   여러 개면 한 번에 하나씩 — 닫으면 다음 것이 뜬다. 겹쳐 띄우면 뒤의 것은
   앞의 것을 닫기 전까지 읽을 수 없다.
   "오늘 하루 / 일주일 간 보지 않기"는 이 브라우저에만 남긴다(localStorage).
   막혀 있으면 매번 뜰 뿐이다. */

const HIDE_KEY = (id: string) => `popup-hide:${id}`

const DAY = 24 * 60 * 60 * 1000
const KST = 9 * 60 * 60 * 1000

/* 숨김이 끝나는 시각. 오늘 하루는 한국 시간 자정까지, 일주일은 7일 뒤 자정까지.
   24시간으로 재면 저녁에 누른 사람이 다음 날 저녁까지 못 본다. */
function hideUntil(days: number) {
  const midnightKst = Math.floor((Date.now() + KST) / DAY) * DAY - KST
  return midnightKst + days * DAY
}

function isHidden(id: string) {
  try {
    return Number(localStorage.getItem(HIDE_KEY(id))) > Date.now()
  } catch {
    return false
  }
}

function hideFor(id: string, days: number) {
  try {
    localStorage.setItem(HIDE_KEY(id), String(hideUntil(days)))
  } catch {
    /* 저장이 막힌 브라우저 — 이번에만 닫힌다 */
  }
}

/* 이미지 하나가 끝나기를 기다린다. 깨진 이미지도 끝난 것으로 보고,
   너무 오래 걸리면 그냥 띄운다 — 느린 이미지 하나 때문에 팝업이 영영
   안 뜨는 것보다 늦게 채워지는 편이 낫다. */
const PRELOAD_TIMEOUT = 4000

function preload(p: PublicPopup): Promise<void> {
  const urls = p.body.flatMap((b) => (b.type === 'image' ? [publicUrl(b.path)] : []))
  if (urls.length === 0) return Promise.resolve()

  const all = Promise.all(
    urls.map(
      (src) =>
        new Promise<void>((done) => {
          const img = new Image()
          img.onload = img.onerror = () => done()
          img.src = src
        }),
    ),
  ).then(() => undefined)

  return Promise.race([all, new Promise<void>((done) => setTimeout(done, PRELOAD_TIMEOUT))])
}

export function SitePopups({ popups }: { popups: PublicPopup[] }) {
  /* 서버에서는 무엇을 숨겼는지 알 수 없다 — 붙은 뒤에 고른다 */
  const [queue, setQueue] = useState<PublicPopup[] | null>(null)

  /* 본문 이미지를 다 받은 팝업만 띄운다. 먼저 띄우면 이미지가 들어오면서
     높이가 늘어나 팝업이 한 번 튄다. 대기 중인 것까지 한꺼번에 받아 두어
     닫고 다음 팝업이 뜰 때도 기다리지 않게 한다. */
  const [ready, setReady] = useState<Set<string>>(() => new Set())

  useEffect(() => {
    const list = popups.filter((p) => !isHidden(p.id))
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage 는 붙은 뒤에만 읽을 수 있다
    setQueue(list)

    let alive = true
    for (const p of list) {
      preload(p).then(() => {
        if (alive) setReady((r) => (r.has(p.id) ? r : new Set(r).add(p.id)))
      })
    }
    return () => {
      alive = false
    }
  }, [popups])

  const current = queue?.[0]

  useEffect(() => {
    if (!current) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setQueue((q) => q?.slice(1) ?? null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [current])

  if (!current || !ready.has(current.id)) return null

  const close = (days = 0) => {
    if (days > 0) hideFor(current.id, days)
    setQueue((q) => q?.slice(1) ?? null)
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"
      onClick={(e) => e.target === e.currentTarget && close()}
    >
      <div role="dialog" aria-modal="true" aria-label={current.title ?? '알림'}>
        <PopupCard
          popup={current}
          onClose={() => close()}
          footer={<PopupFooter more={(queue?.length ?? 1) - 1} onHide={close} />}
        />
      </div>
    </div>
  )
}

/* 하단 — 보지 않기 두 개를 오른쪽에 모은다. 닫기는 우상단 X 가 맡는다. */
export function PopupFooter({ more = 0, onHide }: { more?: number; onHide?: (days: number) => void }) {
  return (
    <div className="flex items-center gap-3 border-t border-neutral-200 px-5 py-2.5 text-xs">
      {/* 뒤에 더 있으면 알린다 — 닫았는데 또 떠서 놀라지 않게 */}
      {more > 0 && <span className="text-neutral-400">{more}개 더 있음</span>}
      <div className="ml-auto flex items-center gap-2 text-neutral-700">
        <button type="button" onClick={() => onHide?.(1)} className="transition hover:text-neutral-950">
          오늘 하루 보지 않기
        </button>
        <span aria-hidden className="text-neutral-300">
          |
        </span>
        <button type="button" onClick={() => onHide?.(7)} className="transition hover:text-neutral-950">
          일주일간 보지 않기
        </button>
      </div>
    </div>
  )
}

/* 팝업 한 장 — 어드민 미리보기도 같은 것을 그린다 */
export function PopupCard({
  popup,
  footer,
  onClose,
}: {
  popup: PublicPopup
  footer?: React.ReactNode
  onClose?: () => void
}) {
  return (
    <div className="relative flex max-h-[90vh] w-[min(32rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
      {/* 본문이 이미지로 시작하면 그 위에 얹힌다 — 흰 원판을 깔아 어느 배경에서도 보이게 */}
      {onClose && (
        <button
          onClick={onClose}
          aria-label="닫기"
          /* 자동 포커스는 두지 않는다 — 뜨자마자 포커스 테두리가 동그랗게 그려진다.
             키보드로 넘어왔을 때만 테두리를 보인다(focus-visible). ESC 로도 닫힌다. */
          className="absolute right-3 top-3 z-10 grid size-10 place-items-center rounded-full bg-white/80 text-neutral-400 outline-none transition hover:bg-white hover:text-neutral-600 focus-visible:ring-2 focus-visible:ring-violet-500"
        >
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinecap="round" aria-hidden>
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      )}

      <div className="min-h-0 overflow-y-auto">
        {/* 오른쪽은 닫기 버튼 자리만큼 비운다 */}
        {popup.title && (
          <h2 className="pb-1 pl-6 pr-16 pt-6 text-xl font-bold tracking-tight">{popup.title}</h2>
        )}

        {/* 제목 없이 글로 시작하면 첫 줄이 닫기 버튼 밑에 깔린다 — 그만큼 내린다.
            이미지로 시작하면 버튼이 이미지 위에 얹히는 편이 자연스럽다. */}
        <div className={onClose && !popup.title && popup.body[0]?.type === 'text' ? 'pt-12' : ''}>
          {popup.body.map((b, i) =>
            b.type === 'image' ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={publicUrl(b.path)} alt="" className="block w-full" />
            ) : (
              <p key={i} className="whitespace-pre-wrap break-words px-6 py-3 text-[15px] leading-relaxed text-neutral-700">
                {b.text}
              </p>
            ),
          )}
        </div>

        {popup.files.length > 0 && (
          <ul className="space-y-1.5 px-6 pb-5 pt-2">
            {popup.files.map((f) => (
              <li key={f.path}>
                <a
                  href={publicUrl(f.path, f.name)}
                  className="flex items-center gap-2 rounded-lg bg-neutral-100 px-3.5 py-2.5 text-sm text-neutral-700 transition hover:bg-violet-50 hover:text-violet-700"
                >
                  <span aria-hidden>📎</span>
                  <span className="min-w-0 flex-1 truncate">{f.name}</span>
                  <span className="shrink-0 text-neutral-400">내려받기</span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>

      {footer}
    </div>
  )
}
