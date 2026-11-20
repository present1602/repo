'use client'

import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
import { useActionTransition } from '@/lib/use-action-transition'
import { dateTime } from '@/lib/format-date'
import { shrinkAvatar, shrinkImage } from '@/lib/shrink-image'
import { shrinkPdf } from '@/lib/shrink-pdf'
import { normalizeUrl, splitCareer } from '@/lib/career-links'
import { CareerText } from '@/components/career-text'
import {
  DEFAULT_EXPIRE_DAYS,
  EXPIRE_DAYS,
  MAX_CAREER,
  MAX_MEMO,
  MAX_NAME,
  checkDesignerInput,
  linkState,
  remaining,
  type DesignerInput,
  type LinkState,
  type RosterDesignerRow,
  type RosterLinkRow,
  type RosterOpenRow,
  type RosterFileRow,
  FILE_ACCEPT,
  MAX_FILE_BYTES,
  MAX_FILES_PER_DESIGNER,
  ROSTER_FILES_BUCKET,
  checkFile,
  fileExt,
  fileSize,
} from '@/lib/roster-shape'
import {
  addRosterFile,
  createRosterDesigner,
  createRosterLink,
  deleteRosterDesigner,
  deleteRosterFile,
  deleteRosterLink,
  prepareRosterFileUpload,
  reorderRosterDesigners,
  setRosterLinkActive,
  updateRosterDesigner,
} from '@/app/admin/roster/actions'
import { Field, ghostButton, input } from './form-bits'
import { Flash } from '@/components/flash'
import { Img } from '@/components/img'

export type LinkRow = RosterLinkRow & { url: string; opens: RosterOpenRow[] }
export type DesignerOption = { id: string; label: string; isPublic: boolean }
type Notice = { kind: 'ok' | 'warn' | 'error'; text: string } | null

const primary =
  'h-9 rounded-lg bg-neutral-900 px-4 text-sm font-medium text-white transition hover:bg-violet-600 disabled:opacity-50'

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

export function RosterManager({
  designers,
  links,
  options,
  files,
  filesReady,
}: {
  designers: RosterDesignerRow[]
  links: LinkRow[]
  options: DesignerOption[]
  /* 디자이너 id → 포트폴리오 파일(0035) */
  files: Record<string, RosterFileRow[]>
  /* 0035 전이면 false — 파일 칸을 막고 까닭을 적는다 */
  filesReady: boolean
}) {
  return (
    <div className="space-y-8">
      <LinkSection links={links} designers={designers} />
      <FilesContext.Provider value={{ files, ready: filesReady }}>
        <DesignerSection designers={designers} options={options} />
      </FilesContext.Provider>
    </div>
  )
}

/* 디자이너 목록 깊숙이(DesignerSection → DesignerItem) 파일을 넘기려고 쓴다 — 중간 단계는 파일을 모른다 */
const FilesContext = createContext<{ files: Record<string, RosterFileRow[]>; ready: boolean }>({ files: {}, ready: false })

/* ═════════════ 링크 ═════════════ */

const STATE_LABEL: Record<LinkState, string> = { live: '사용 중', expired: '기한 만료', revoked: '비활성' }
const STATE_BADGE: Record<LinkState, string> = {
  live: 'bg-violet-600 text-white',
  expired: 'bg-amber-100 text-amber-800',
  revoked: 'bg-neutral-200 text-neutral-500',
}

function LinkSection({ links, designers }: { links: LinkRow[]; designers: RosterDesignerRow[] }) {
  const [creating, setCreating] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const nameOf = new Map(designers.map((d) => [d.id, d.name]))

  /* 만료 여부는 지금 시각에 달렸다 — 렌더 중에 Date.now() 를 읽으면 서버와 브라우저 값이
     달라 hydration 이 어긋난다. 그려진 뒤에 읽고, 1분마다 다시 센다. */
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => {
    const tick = () => setNow(Date.now())
    tick()
    const t = setInterval(tick, 60_000)
    return () => clearInterval(t)
  }, [])

  /* 기한 지난 링크는 쌓이기만 한다 — 기본은 쓰는 중인 것만 */
  const liveLinks = now == null ? links : links.filter((l) => linkState(l, now) === 'live')
  const shown = showAll ? links : liveLinks

  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">공유 링크</h2>
        {/* 디자이너가 없으면 보여 줄 사람이 없다 — 막고 까닭을 옆에 적는다 */}
        <div className="flex items-center gap-3">
          {designers.length === 0 && <span className="text-xs text-neutral-500">아래에서 디자이너를 먼저 추가해 주세요.</span>}
          <button type="button" onClick={() => setCreating(true)} disabled={designers.length === 0} className={primary}>
            링크 만들기
          </button>
        </div>
      </div>

      {creating && <CreateLinkDialog designers={designers} onClose={() => setCreating(false)} />}

      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-sm text-neutral-500">
          {showAll ? `전체 ${links.length}개` : `사용 중 ${liveLinks.length}개`}
        </p>
        {links.length > liveLinks.length && (
          <button type="button" onClick={() => setShowAll((s) => !s)} className="text-sm text-violet-600 hover:underline">
            {showAll ? '사용 중만 보기' : `만료·비활성 포함 전체 보기 (${links.length})`}
          </button>
        )}
      </div>

      {shown.length === 0 ? (
        <p className="mt-3 rounded-xl border border-dashed border-neutral-300 py-10 text-center text-sm text-neutral-500">
          {links.length === 0 ? '아직 만든 링크가 없습니다.' : '사용 중인 링크가 없습니다.'}
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-neutral-200 overflow-hidden rounded-xl ring-1 ring-neutral-200">
          {shown.map((l) => (
            <LinkItem key={l.id} l={l} now={now} nameOf={nameOf} total={designers.length} />
          ))}
        </ul>
      )}
    </section>
  )
}

/* 링크 만들기 다이얼로그 — 디자이너는 전원 체크된 채로 연다. 체크를 푼 사람은 이 링크로 보이지 않는다.

   실패 문구는 이 다이얼로그 안에 띄운다(뒤쪽 화면에 그리면 덮개에 가려 안 보인다).
   실패하면 닫지 않는다. 만들면 같은 자리에 주소와 복사 버튼을 보여 준다. */
function CreateLinkDialog({ designers, onClose }: { designers: RosterDesignerRow[]; onClose: () => void }) {
  const [days, setDays] = useState<number>(DEFAULT_EXPIRE_DAYS)
  const [memo, setMemo] = useState('')
  const [picked, setPicked] = useState<Set<string>>(() => new Set(designers.map((d) => d.id)))
  const [notice, setNotice] = useState<Notice>(null)
  const [made, setMade] = useState<{ url: string; expiresAt: string; count: number } | null>(null)
  const [copied, setCopied] = useState(false)
  const [pending, start] = useActionTransition()
  const router = useRouter()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !pending) onClose()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose, pending])

  const memoBad = memo.trim().length > MAX_MEMO
  const none = picked.size === 0
  const all = picked.size === designers.length

  const toggle = (id: string) =>
    setPicked((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const create = (e: React.FormEvent) => {
    e.preventDefault()
    setNotice(null)
    if (memoBad || none) return
    /* 목록 순서대로 보낸다 */
    const ids = designers.filter((d) => picked.has(d.id)).map((d) => d.id)
    start(async () => {
      const r = await createRosterLink(days, memo, ids)
      if (!r.ok) return setNotice({ kind: 'error', text: r.error })
      setMade({ url: r.url, expiresAt: r.expiresAt, count: ids.length })
      setCopied(false)
      router.refresh()
    }, '경력 페이지 링크 만들기')
  }

  const copyMade = async () => {
    if (!made) return
    if (await copyText(made.url)) {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } else setNotice({ kind: 'warn', text: '클립보드를 쓸 수 없는 브라우저입니다. 주소를 직접 선택해 복사해 주세요.' })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={() => !pending && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="roster-link-dialog-title"
    >
      <div onClick={(e) => e.stopPropagation()} className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-xl bg-white shadow-xl">
        <div className="flex items-start justify-between gap-2 border-b border-neutral-100 px-5 py-4">
          <h2 id="roster-link-dialog-title" className="font-semibold">
            {made ? '링크를 만들었습니다' : '공유 링크 만들기'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            aria-label="닫기"
            className="-mr-1 -mt-1 shrink-0 rounded p-1 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-900"
          >
            ✕
          </button>
        </div>

        {made ? (
          <div className="space-y-4 overflow-y-auto px-5 py-5">
            <div className="rounded-lg bg-violet-50 p-4">
              <p className="text-xs font-medium text-violet-700">
                디자이너 {made.count}명 · {dateTime(made.expiresAt)} 까지
              </p>
              <p className="mt-1.5 select-all break-all font-mono text-sm text-neutral-900">{made.url}</p>
            </div>
            <Flash msg={notice} onDone={() => setNotice(null)} />
            <div className="flex flex-wrap justify-end gap-1.5">
              <a href={made.url} target="_blank" rel="noopener noreferrer" className={ghostButton}>
                페이지 열기 ↗
              </a>
              <button type="button" onClick={copyMade} className={ghostButton}>
                {copied ? '복사됨' : '링크 복사'}
              </button>
              <button type="button" onClick={onClose} className={primary}>
                닫기
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={create} className="flex min-h-0 flex-col">
            <div className="space-y-4 overflow-y-auto px-5 py-5">
              <div className="grid gap-3 sm:grid-cols-[9rem_minmax(0,1fr)]">
                <Field label="유효기간">
                  <select value={days} onChange={(e) => setDays(Number(e.target.value))} className={input}>
                    {EXPIRE_DAYS.map((d) => (
                      <option key={d} value={d}>
                        {d === 1 ? '1일 (24시간)' : `${d}일`}
                      </option>
                    ))}
                  </select>
                </Field>
                <div>
                  <Field label="메모" hint="선택 · 페이지에는 보이지 않습니다">
                    <input
                      value={memo}
                      onChange={(e) => setMemo(e.target.value)}
                      maxLength={MAX_MEMO + 10}
                      placeholder="예: ○○기업 김팀장님"
                      className={input}
                    />
                  </Field>
                  {memoBad && <p className="mt-1 text-xs text-red-600">{MAX_MEMO}자 이내로 적어 주세요.</p>}
                </div>
              </div>

              <fieldset>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <legend className="text-sm font-medium">
                    보여 줄 디자이너 <span className="text-neutral-500">{picked.size}/{designers.length}명</span>
                  </legend>
                  <button
                    type="button"
                    onClick={() => setPicked(all ? new Set() : new Set(designers.map((d) => d.id)))}
                    className="text-xs text-violet-600 hover:underline"
                  >
                    {all ? '전체 해제' : '전체 선택'}
                  </button>
                </div>
                <ul className="max-h-72 divide-y divide-neutral-100 overflow-y-auto rounded-lg ring-1 ring-neutral-200">
                  {designers.map((d) => (
                    <li key={d.id}>
                      <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-neutral-50">
                        <input
                          type="checkbox"
                          checked={picked.has(d.id)}
                          onChange={() => toggle(d.id)}
                          className="size-4 accent-violet-600"
                        />
                        <Avatar src={d.avatar_url} name={d.name} size="size-8" />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium">{d.name}</span>
                          <span className="block truncate text-xs text-neutral-500">
                            {splitCareer(d.career.split('\n')[0] ?? '').map((p) => p.text).join('') || '경력 미입력'}
                          </span>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
                {none && <p className="mt-1.5 text-xs text-red-600">한 명 이상 골라 주세요.</p>}
                {!none && !all && (
                  <p className="mt-1.5 text-xs text-neutral-500">체크한 {picked.size}명만 이 링크로 보입니다.</p>
                )}
              </fieldset>

              <Flash msg={notice} onDone={() => setNotice(null)} />
            </div>

            <div className="flex justify-end gap-1.5 border-t border-neutral-100 px-5 py-3">
              <button type="button" onClick={onClose} disabled={pending} className={ghostButton}>
                취소
              </button>
              <button type="submit" disabled={pending || memoBad || none} className={primary}>
                {pending ? '만드는 중…' : '링크 만들기'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

function LinkItem({
  l,
  now,
  nameOf,
  total,
}: {
  l: LinkRow
  now: number | null
  nameOf: Map<string, string>
  total: number
}) {
  const [pending, start] = useActionTransition()
  const [notice, setNotice] = useState<Notice>(null)
  const [copied, setCopied] = useState(false)
  const router = useRouter()

  const [doing, setDoing] = useState<'off' | 'on' | 'delete' | null>(null)
  const [showOpens, setShowOpens] = useState(false)

  const state = now == null ? (l.revoked_at ? 'revoked' : 'live') : linkState(l, now)
  const live = state === 'live'
  /* 비활성이어도 기한이 남았으면 다시 켤 수 있다 */
  const canReactivate = state === 'revoked' && now != null && Date.parse(l.expires_at) > now

  const people = l.opens.filter((o) => !o.is_bot)
  const bots = l.opens.length - people.length

  const copy = async () => {
    if (await copyText(l.url)) {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } else setNotice({ kind: 'warn', text: `클립보드를 쓸 수 없습니다. 주소: ${l.url}` })
  }

  const setActive = (active: boolean) => {
    if (!active && !confirm('이 링크를 비활성할까요? 다시 켜기 전까지 받은 사람이 열 수 없습니다.')) return
    setNotice(null)
    setDoing(active ? 'on' : 'off')
    start(async () => {
      const r = await setRosterLinkActive(l.id, active)
      setDoing(null)
      if (!r.ok) return setNotice({ kind: 'error', text: r.error })
      setNotice({ kind: 'ok', text: active ? '링크를 다시 켰습니다.' : '링크를 비활성했습니다.' })
      router.refresh()
    }, active ? '링크 활성화' : '링크 비활성화')
  }

  const remove = () => {
    if (!confirm('이 링크를 삭제할까요? 열람 기록도 함께 지워지고 되돌릴 수 없습니다.')) return
    setNotice(null)
    setDoing('delete')
    start(async () => {
      const r = await deleteRosterLink(l.id)
      setDoing(null)
      /* 성공하면 목록에서 이 줄이 사라진다 — 알림은 실패했을 때만 이 자리에 띄운다 */
      if (!r.ok) return setNotice({ kind: 'error', text: r.error })
      router.refresh()
    }, '링크 삭제')
  }

  return (
    <li className={`p-4 ${live ? 'bg-white' : 'bg-neutral-50'}`}>
      <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
        <div className="w-full min-w-0 sm:w-auto sm:flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${STATE_BADGE[state]}`}>
              {STATE_LABEL[state]}
            </span>
            <span className="font-medium">{l.memo || <span className="text-neutral-400">메모 없음</span>}</span>
            {live && now != null && <span className="text-sm text-violet-600">{remaining(l.expires_at, now)}</span>}
          </div>
          <p className="mt-1 break-all font-mono text-xs text-neutral-500">{l.url}</p>
          <p className="mt-1 text-xs text-neutral-600">{whoLabel(l.designer_ids, nameOf, total)}</p>
          <p className="mt-1 text-[11px] text-neutral-400">
            생성 {dateTime(l.created_at)} · 기한 {dateTime(l.expires_at)}
            {l.revoked_at && ` · 비활성 ${dateTime(l.revoked_at)}`}
          </p>
          <p className="mt-1 text-xs text-neutral-600">
            {l.open_count > 0 ? (
              <>
                <b className="font-semibold text-neutral-900">열람 {l.open_count}회</b> · 최근 {dateTime(l.last_opened_at)}
              </>
            ) : (
              '아직 열람 안 함'
            )}
            {bots > 0 && <span className="text-neutral-400"> · 링크 미리보기 {bots}회(횟수에서 뺌)</span>}
            {l.opens.length > 0 && (
              <button
                type="button"
                onClick={() => setShowOpens((s) => !s)}
                aria-expanded={showOpens}
                className="ml-2 text-violet-600 hover:underline"
              >
                {showOpens ? '기록 접기' : `열람 기록 보기 (${l.opens.length})`}
              </button>
            )}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-1.5">
          {live && (
            <>
              <button type="button" onClick={copy} className={ghostButton}>
                {copied ? '복사됨' : '링크 복사'}
              </button>
              {/* 어드민이 로그인한 채로 열면 열람 기록에 남기지 않는다(roster-db.ts recordOpen) */}
              <a href={l.url} target="_blank" rel="noopener noreferrer" className={ghostButton}>
                열기 ↗
              </a>
              <button type="button" onClick={() => setActive(false)} disabled={pending} className={ghostButton}>
                {doing === 'off' ? '끄는 중…' : '비활성'}
              </button>
            </>
          )}
          {canReactivate && (
            <button type="button" onClick={() => setActive(true)} disabled={pending} className={ghostButton}>
              {doing === 'on' ? '켜는 중…' : '다시 활성'}
            </button>
          )}
          <button type="button" onClick={remove} disabled={pending} className={`${ghostButton} text-red-600`}>
            {doing === 'delete' ? '삭제 중…' : '삭제'}
          </button>
        </div>
      </div>
      <Flash msg={notice} onDone={() => setNotice(null)} className="mt-3" />
      {showOpens && <OpenLog opens={l.opens} />}
    </li>
  )
}

/* 이 링크로 보이는 사람 — '전원 (3명)' 또는 '김치연, 변혜선 (2명)'. 그사이 삭제된 사람은 빼고 센다 */
function whoLabel(ids: string[] | null | undefined, nameOf: Map<string, string>, total: number) {
  if (!ids) return `보이는 디자이너: 전원 (${total}명)`
  const names = ids.map((id) => nameOf.get(id)).filter((n): n is string => Boolean(n))
  if (names.length === 0) return '보이는 디자이너: 없음 (고른 사람이 모두 삭제됨)'
  return `보이는 디자이너: ${names.join(', ')} (${names.length}명)`
}

/* 열람 기록 표 — 최근 것부터. 미리보기 봇은 흐리게 두고 이름을 붙인다 */
function OpenLog({ opens }: { opens: RosterOpenRow[] }) {
  return (
    <div className="mt-3 overflow-x-auto rounded-lg ring-1 ring-neutral-200">
      <table className="w-full min-w-[36rem] text-left text-xs">
        <thead className="bg-neutral-50 text-neutral-500">
          <tr>
            <th className="px-3 py-2 font-medium">시각</th>
            <th className="px-3 py-2 font-medium">IP</th>
            <th className="px-3 py-2 font-medium">브라우저</th>
            <th className="px-3 py-2 font-medium">OS</th>
            <th className="px-3 py-2 font-medium">기기</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100 bg-white">
          {opens.map((o) => (
            <tr key={o.id} className={o.is_bot ? 'text-neutral-400' : 'text-neutral-800'} title={o.user_agent ?? undefined}>
              <td className="whitespace-nowrap px-3 py-2 tabular-nums">{dateTime(o.opened_at)}</td>
              <td className="whitespace-nowrap px-3 py-2 font-mono">{o.ip ?? '—'}</td>
              <td className="px-3 py-2">{o.browser ?? '—'}</td>
              <td className="whitespace-nowrap px-3 py-2">{o.os ?? '—'}</td>
              <td className="whitespace-nowrap px-3 py-2">{o.device ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ═════════════ 디자이너 ═════════════ */

function DesignerSection({ designers, options }: { designers: RosterDesignerRow[]; options: DesignerOption[] }) {
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [notice, setNotice] = useState<Notice>(null)
  const [pending, start] = useActionTransition()
  const router = useRouter()

  const labelOf = new Map(options.map((o) => [o.id, o]))

  const move = (index: number, dir: -1 | 1) => {
    const to = index + dir
    if (to < 0 || to >= designers.length) return
    const ids = designers.map((d) => d.id)
    ;[ids[index], ids[to]] = [ids[to]!, ids[index]!]
    setNotice(null)
    start(async () => {
      const r = await reorderRosterDesigners(ids)
      if (!r.ok) return setNotice({ kind: 'error', text: r.error })
      router.refresh()
    }, '순서 저장')
  }

  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">
          디자이너 <span className="text-neutral-400">{designers.length}</span>
        </h2>
        {!adding && (
          <button
            type="button"
            onClick={() => {
              setAdding(true)
              setEditing(null)
            }}
            className={primary}
          >
            + 디자이너 추가
          </button>
        )}
      </div>

      <Flash msg={notice} onDone={() => setNotice(null)} className="mb-3" />

      {adding && (
        <DesignerForm
          options={options}
          onClose={() => setAdding(false)}
          onSaved={() => {
            setAdding(false)
            setNotice({ kind: 'ok', text: '디자이너를 추가했습니다.' })
          }}
        />
      )}

      {designers.length === 0 && !adding ? (
        <p className="rounded-xl border border-dashed border-neutral-300 py-16 text-center text-sm text-neutral-500">
          아직 추가한 디자이너가 없습니다. 오른쪽 위 ‘디자이너 추가’를 눌러 주세요.
        </p>
      ) : (
        <ul className={`space-y-3 ${adding ? 'mt-4' : ''}`}>
          {designers.map((d, i) =>
            editing === d.id ? (
              <li key={d.id}>
                <DesignerForm
                  row={d}
                  options={options}
                  onClose={() => setEditing(null)}
                  onSaved={() => {
                    setEditing(null)
                    setNotice({ kind: 'ok', text: '저장했습니다.' })
                  }}
                />
              </li>
            ) : (
              <DesignerItem
                key={d.id}
                d={d}
                linked={d.designer_id ? labelOf.get(d.designer_id) : undefined}
                first={i === 0}
                last={i === designers.length - 1}
                busy={pending}
                onUp={() => move(i, -1)}
                onDown={() => move(i, 1)}
                onEdit={() => {
                  setEditing(d.id)
                  setAdding(false)
                }}
                onNotice={setNotice}
              />
            ),
          )}
        </ul>
      )}
    </section>
  )
}

function Avatar({ src, name, size }: { src: string | null; name: string; size: string }) {
  if (src) return <Img src={src} alt="" focus="center" className={`${size} shrink-0 rounded-full`} />
  return (
    <div className={`${size} grid shrink-0 place-items-center rounded-full bg-neutral-200 text-lg font-semibold text-neutral-500`}>
      {name.trim().slice(0, 1) || '?'}
    </div>
  )
}

function DesignerItem({
  d,
  linked,
  first,
  last,
  busy,
  onUp,
  onDown,
  onEdit,
  onNotice,
}: {
  d: RosterDesignerRow
  linked: DesignerOption | undefined
  first: boolean
  last: boolean
  busy: boolean
  onUp: () => void
  onDown: () => void
  onEdit: () => void
  onNotice: (n: Notice) => void
}) {
  const [pending, start] = useActionTransition()
  const router = useRouter()

  const remove = () => {
    if (!confirm(`${d.name} 디자이너를 경력 페이지에서 삭제할까요?`)) return
    onNotice(null)
    start(async () => {
      const r = await deleteRosterDesigner(d.id)
      if (!r.ok) return onNotice({ kind: 'error', text: r.error })
      onNotice({ kind: 'ok', text: `${d.name} 디자이너를 삭제했습니다.` })
      router.refresh()
    }, '디자이너 삭제')
  }

  return (
    <li className="flex gap-4 rounded-xl bg-white p-4 ring-1 ring-neutral-200">
      <Avatar src={d.avatar_url} name={d.name} size="size-14" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-semibold">{d.name}</span>
          {d.designer_id ? (
            linked ? (
              <span className={`text-xs ${linked.isPublic ? 'text-neutral-500' : 'text-amber-700'}`}>
                포트폴리오 · {linked.label}
                {!linked.isPublic && ' (비공개 프로필 — 버튼이 보이지 않습니다)'}
              </span>
            ) : (
              <span className="text-xs text-amber-700">연결한 디자이너를 찾을 수 없습니다</span>
            )
          ) : (
            <span className="text-xs text-neutral-400">포트폴리오 연결 없음</span>
          )}
        </div>
        {d.career ? (
          <p className="mt-1.5 line-clamp-3 whitespace-pre-wrap text-sm leading-relaxed text-neutral-600">
            <CareerText text={d.career} linkClassName="text-violet-700 underline underline-offset-2" />
          </p>
        ) : (
          <p className="mt-1.5 text-sm text-neutral-400">경력 내용이 비어 있습니다.</p>
        )}
        <div className="mt-3 flex flex-wrap gap-1.5">
          <button type="button" onClick={onEdit} className={ghostButton}>
            수정
          </button>
          <button type="button" onClick={onUp} disabled={first || busy} className={ghostButton} aria-label="위로">
            ↑
          </button>
          <button type="button" onClick={onDown} disabled={last || busy} className={ghostButton} aria-label="아래로">
            ↓
          </button>
          <button type="button" onClick={remove} disabled={pending} className={`${ghostButton} text-red-600`}>
            {pending ? '삭제 중…' : '삭제'}
          </button>
        </div>
        <FilePanel designerId={d.id} />
      </div>
    </li>
  )
}

/* 경력 입력 — 글자를 드래그로 고르고 '링크 걸기'를 누르면 주소를 받아 [글자](주소) 로 감싼다.
   공개 화면(CareerText)이 그 꼴을 링크로 그린다. 저장은 여전히 일반 텍스트다.

   주소 칸이 열려 있는 동안 고른 범위를 따로 들고 있는다 — 주소를 치려고 커서가 옮겨 가면
   textarea 의 선택이 풀린다. */
function CareerEditor({ value, onChange }: { value: string; onChange: (next: string) => void }) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const [range, setRange] = useState<{ start: number; end: number } | null>(null)
  const [url, setUrl] = useState('')
  const [hint, setHint] = useState<string | null>(null)

  const selected = range ? value.slice(range.start, range.end) : ''
  const fixed = normalizeUrl(url)
  const links = splitCareer(value).filter((p) => p.href)

  const begin = () => {
    const el = ref.current
    if (!el) return
    const { selectionStart: start, selectionEnd: end } = el
    const text = value.slice(start, end)
    if (start === end || !text.trim()) return setHint('링크를 걸 글자를 먼저 드래그해서 골라 주세요.')
    if (/[\[\]\n]/.test(text)) return setHint('한 줄 안의 글자만 고를 수 있습니다. ([ ] 기호는 빼고 골라 주세요)')
    if (text.length > 200) return setHint('링크 글자는 200자 이내로 골라 주세요.')
    setHint(null)
    setRange({ start, end })
    setUrl('')
  }

  const apply = () => {
    if (!range || !fixed) return
    const next = `${value.slice(0, range.start)}[${selected}](${fixed})${value.slice(range.end)}`
    onChange(next)
    setRange(null)
    setUrl('')
    /* 감싼 자리 뒤로 커서를 옮겨 이어서 쓸 수 있게 */
    const caret = range.start + selected.length + fixed.length + 4
    requestAnimationFrame(() => {
      ref.current?.focus()
      ref.current?.setSelectionRange(caret, caret)
    })
  }

  return (
    <div>
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={8}
        placeholder={'예:\n2019 – 2023  ○○스튜디오 시니어 디자이너\n2016 – 2019  △△에이전시 브랜드 디자이너\n\n주요 프로젝트 — ○○ 리브랜딩, △△ 앱 UI'}
        className={`${input} h-auto py-2 leading-relaxed`}
      />
      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        {/* 누르는 순간 textarea 의 선택이 풀리지 않게 mousedown 기본 동작을 막는다 */}
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={begin} className={ghostButton}>
          링크 걸기
        </button>
        {links.length > 0 && <span className="text-xs text-neutral-500">링크 {links.length}개 · [글자](주소) 꼴이 링크로 보입니다</span>}
        {hint && <span className="text-xs text-red-600">{hint}</span>}
      </div>

      {range && (
        <div className="mt-2 rounded-lg bg-violet-50 p-3">
          <p className="text-xs text-violet-800">
            <b className="font-semibold">“{selected}”</b> 에 걸 주소
          </p>
          <div className="mt-2 flex gap-1.5">
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => {
                /* 경력 폼 전체가 제출되지 않게 Enter 를 여기서 받는다 */
                if (e.key === 'Enter') {
                  e.preventDefault()
                  apply()
                }
                if (e.key === 'Escape') setRange(null)
              }}
              placeholder="https://"
              autoFocus
              className={`${input} min-w-0 flex-1 bg-white`}
            />
            <button type="button" onClick={apply} disabled={!fixed} className={primary}>
              적용
            </button>
            <button type="button" onClick={() => setRange(null)} className={`${ghostButton} bg-white`}>
              취소
            </button>
          </div>
          {url.trim() && !fixed && <p className="mt-1 text-xs text-red-600">주소를 확인해 주세요. 예: https://example.com</p>}
        </div>
      )}
    </div>
  )
}

/* 이미지 확장자 — 50MB 를 넘으면 브라우저에서 줄인다 */
const IMAGE_EXT = ['png', 'jpg', 'jpeg', 'webp', 'gif']

/* 50MB 를 넘는 파일을 한도 아래로 맞춘다. 이미지는 해상도·화질을, PDF 는 장마다 JPEG 로 그려
   다시 묶는다. 그 밖의 형식(zip·pptx·영상)은 줄일 방법이 없어 나눠 달라고 한다. */
async function fitFile(
  file: File,
  onStatus: (text: string) => void,
): Promise<{ ok: true; file: File; shrunk: boolean } | { ok: false; error: string }> {
  if (file.size <= MAX_FILE_BYTES) return { ok: true, file, shrunk: false }
  const ext = fileExt(file.name)

  if (IMAGE_EXT.includes(ext)) {
    onStatus(`${file.name} 용량을 줄이는 중…`)
    const out = await shrinkImage(file, MAX_FILE_BYTES)
    return out
      ? { ok: true, file: out, shrunk: true }
      : { ok: false, error: `${file.name}: 이미지를 50MB 아래로 줄이지 못했습니다.` }
  }
  if (ext === 'pdf') {
    onStatus(`${file.name} 용량을 줄이는 중…`)
    const out = await shrinkPdf(file, MAX_FILE_BYTES, (done, total) =>
      onStatus(`${file.name} 용량을 줄이는 중… (${done}/${total}쪽)`),
    )
    return out.ok ? { ok: true, file: out.file, shrunk: true } : out
  }
  return {
    ok: false,
    error: `${file.name}: 50MB를 넘는 ${ext.toUpperCase()} 파일은 줄일 수 없습니다. 나눠서 올려 주세요.`,
  }
}

/* 서명 주소로 저장소에 바로 올린다 — 서버 액션은 본문 크기 제한에 걸린다 */
async function uploadFile(designerId: string, file: File): Promise<string | null> {
  const prep = await prepareRosterFileUpload(designerId, file.name, file.size)
  if (!prep.ok) return prep.error

  const storage = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false },
  }).storage.from(ROSTER_FILES_BUCKET)
  const { error } = await storage.uploadToSignedUrl(prep.path, prep.token, file, {
    contentType: file.type || undefined,
  })
  if (error) {
    console.error('[roster] 파일 업로드 실패:', error.message)
    return `${file.name}: 올리지 못했습니다. 다시 시도해 주세요.`
  }

  const saved = await addRosterFile(designerId, prep.path, file.name, file.size)
  return saved.ok ? null : saved.error
}

/* 디자이너 한 명의 포트폴리오 파일 — 여러 개를 한꺼번에 골라 올리고, 하나씩 지운다.
   알림은 이 칸 안에 띄운다 — 목록 위쪽 알림 자리는 아래 디자이너에서는 화면 밖이다. */
function FilePanel({ designerId }: { designerId: string }) {
  const { files: all, ready } = useContext(FilesContext)
  const files = all[designerId] ?? []
  const [status, setStatus] = useState<string | null>(null)
  const [notice, setNotice] = useState<Notice>(null)
  const [removing, setRemoving] = useState<string | null>(null)
  const [, start] = useActionTransition()
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const busy = status != null || removing != null
  const room = MAX_FILES_PER_DESIGNER - files.length

  const pick = async (list: FileList | null) => {
    const chosen = Array.from(list ?? [])
    if (inputRef.current) inputRef.current.value = ''
    if (chosen.length === 0) return
    setNotice(null)

    if (chosen.length > room) {
      return setNotice({
        kind: 'error',
        text: `파일은 디자이너당 ${MAX_FILES_PER_DESIGNER}개까지입니다. 지금 ${room}개 더 올릴 수 있습니다.`,
      })
    }
    /* 형식은 올리기 전에 한 번에 거른다 — 몇 개 올린 뒤에 막히면 반쯤 올라간 상태가 된다 */
    const wrongType = chosen.map((f) => checkFile(f.name, Math.min(f.size, MAX_FILE_BYTES) || 1)).find(Boolean)
    if (wrongType) return setNotice({ kind: 'error', text: wrongType })

    const errors: string[] = []
    const shrunk: string[] = []
    let done = 0
    for (const [i, raw] of chosen.entries()) {
      const fit = await fitFile(raw, (t) => setStatus(t))
      if (!fit.ok) {
        errors.push(fit.error)
        continue
      }
      if (fit.shrunk) shrunk.push(`${raw.name} (${fileSize(raw.size)} → ${fileSize(fit.file.size)})`)
      setStatus(`올리는 중… ${i + 1}/${chosen.length}`)
      const err = await uploadFile(designerId, fit.file)
      if (err) errors.push(err)
      else done++
    }
    setStatus(null)
    router.refresh()

    if (errors.length > 0) {
      setNotice({
        kind: 'error',
        text: `${done > 0 ? `${done}개를 올렸고 ` : ''}${errors.length}개는 올리지 못했습니다. ${errors.join(' / ')}`,
      })
    } else {
      setNotice({
        kind: 'ok',
        text: `파일 ${done}개를 올렸습니다.${shrunk.length > 0 ? ` 50MB를 넘어 줄여서 올린 파일: ${shrunk.join(', ')}` : ''}`,
      })
    }
  }

  const remove = (f: RosterFileRow) => {
    if (!confirm(`${f.name} 파일을 삭제할까요? 링크를 받은 사람도 더는 내려받을 수 없습니다.`)) return
    setNotice(null)
    setRemoving(f.id)
    start(async () => {
      const r = await deleteRosterFile(f.id)
      setRemoving(null)
      if (!r.ok) return setNotice({ kind: 'error', text: r.error })
      router.refresh()
    }, '포트폴리오 파일 삭제')
  }

  return (
    <div className="mt-4 rounded-lg bg-neutral-50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium text-neutral-700">
          포트폴리오 파일 <span className="text-neutral-400">{files.length}/{MAX_FILES_PER_DESIGNER}</span>
        </p>
        <div className="flex items-center gap-2">
          {!ready && <span className="text-xs text-amber-700">0035_roster_files.sql 실행 후 올릴 수 있습니다</span>}
          {ready && room <= 0 && <span className="text-xs text-neutral-500">최대 개수입니다</span>}
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={FILE_ACCEPT}
            onChange={(e) => pick(e.target.files)}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={!ready || busy || room <= 0}
            className={`${ghostButton} bg-white`}
          >
            {status ?? '파일 추가'}
          </button>
        </div>
      </div>

      {files.length > 0 && (
        <ul className="mt-2 divide-y divide-neutral-200 rounded-md bg-white ring-1 ring-neutral-200">
          {files.map((f) => (
            <li key={f.id} className="flex items-center gap-3 px-3 py-2 text-sm">
              <span className="w-12 shrink-0 rounded bg-neutral-100 py-0.5 text-center text-[10px] font-semibold uppercase text-neutral-500">
                {fileExt(f.name) || 'file'}
              </span>
              <a
                href={`/admin/roster/file?id=${f.id}`}
                className="min-w-0 flex-1 truncate text-neutral-800 hover:text-violet-700 hover:underline"
                title={f.name}
              >
                {f.name}
              </a>
              <span className="shrink-0 text-xs tabular-nums text-neutral-400">{fileSize(f.size)}</span>
              <button
                type="button"
                onClick={() => remove(f)}
                disabled={busy}
                className="shrink-0 text-xs text-red-600 hover:underline disabled:opacity-50"
              >
                {removing === f.id ? '삭제 중…' : '삭제'}
              </button>
            </li>
          ))}
        </ul>
      )}
      {files.length === 0 && ready && (
        <p className="mt-1.5 text-xs text-neutral-500">
          PDF·이미지·MP4 최대 {MAX_FILES_PER_DESIGNER}개. 링크 페이지에서는 내려받기 없이 미리보기로만 보입니다. PPT·한글은
          PDF로 내보내 올려 주세요. 50MB를 넘는 이미지·PDF는 자동으로 줄여서 올립니다.
        </p>
      )}
      <Flash msg={notice} onDone={() => setNotice(null)} className="mt-2" />
    </div>
  )
}

/* 추가·수정이 같은 폼을 쓴다. 다이얼로그가 아니라 목록 자리에 펼친다 —
   실패 문구가 폼 바로 아래에 그대로 보이고, 적어 둔 내용도 남는다. */
function DesignerForm({
  row,
  options,
  onClose,
  onSaved,
}: {
  row?: RosterDesignerRow
  options: DesignerOption[]
  onClose: () => void
  onSaved: () => void
}) {
  const [v, setV] = useState<DesignerInput>({
    name: row?.name ?? '',
    career: row?.career ?? '',
    designerId: row?.designer_id ?? '',
  })
  const [touched, setTouched] = useState(false)
  const [image, setImage] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [dropImage, setDropImage] = useState(false)
  const [notice, setNotice] = useState<Notice>(null)
  const [pending, start] = useActionTransition()
  const fileRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  /* 미리보기 주소는 다 쓰면 놓아 준다 */
  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview)
  }, [preview])

  const bad = checkDesignerInput(v)
  const invalid = Object.keys(bad).length > 0
  const shownImage = preview ?? (dropImage ? null : (row?.avatar_url ?? null))
  const picked = options.find((o) => o.id === v.designerId)

  const set = <K extends keyof DesignerInput>(k: K, value: DesignerInput[K]) => setV((s) => ({ ...s, [k]: value }))

  const pick = async (f: File) => {
    setNotice(null)
    /* 서버 액션은 본문 1MB 를 넘으면 받지 못한다 — 고르는 순간 줄여 둔다 */
    const small = await shrinkAvatar(f)
    if (!small) return setNotice({ kind: 'error', text: '이미지를 읽지 못했습니다. 다른 이미지를 골라 주세요.' })
    setImage(small)
    setPreview(URL.createObjectURL(small))
    setDropImage(false)
  }

  const clearImage = () => {
    setImage(null)
    setPreview(null)
    setDropImage(true)
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setTouched(true)
    setNotice(null)
    if (invalid) return setNotice({ kind: 'error', text: Object.values(bad)[0]! })
    start(async () => {
      const form = new FormData()
      if (row) form.set('id', row.id)
      form.set('name', v.name)
      form.set('career', v.career)
      form.set('designerId', v.designerId)
      if (image) form.set('image', image)
      if (dropImage) form.set('dropImage', '1')
      const r = row ? await updateRosterDesigner(form) : await createRosterDesigner(form)
      /* 실패하면 폼을 닫지 않는다 — 적어 둔 내용과 까닭이 그대로 보이게 */
      if (!r.ok) return setNotice({ kind: 'error', text: r.error })
      onSaved()
      router.refresh()
    }, row ? '디자이너 수정' : '디자이너 추가')
  }

  return (
    <form onSubmit={submit} className="rounded-xl bg-white p-5 ring-2 ring-violet-500">
      <h3 className="text-sm font-semibold">{row ? `${row.name} 수정` : '새 디자이너'}</h3>

      <div className="mt-4 flex flex-col gap-5 sm:flex-row">
        <div className="flex shrink-0 flex-row items-center gap-3 sm:flex-col">
          <Avatar src={shownImage} name={v.name} size="size-24" />
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void pick(f)
              e.target.value = ''
            }}
          />
          <div className="flex gap-1.5">
            <button type="button" onClick={() => fileRef.current?.click()} disabled={pending} className={ghostButton}>
              {shownImage ? '사진 변경' : '프로필 사진'}
            </button>
            {shownImage && (
              <button type="button" onClick={clearImage} disabled={pending} className={`${ghostButton} text-red-600`}>
                빼기
              </button>
            )}
          </div>
        </div>

        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <Field label="이름" required hint="실명 그대로 보입니다">
              <input
                value={v.name}
                onChange={(e) => set('name', e.target.value)}
                maxLength={MAX_NAME + 5}
                placeholder="예: 김민연"
                className={input}
                autoFocus
              />
            </Field>
            {touched && bad.name && <p className="mt-1 text-xs text-red-600">{bad.name}</p>}
          </div>

          <div>
            <Field label="경력" hint="줄바꿈 그대로 보입니다 · 글자를 드래그한 뒤 ‘링크 걸기’">
              <CareerEditor value={v.career} onChange={(next) => set('career', next)} />
            </Field>
            <p className={`mt-1 text-right text-xs ${bad.career ? 'text-red-600' : 'text-neutral-400'}`}>
              {bad.career ?? `${v.career.trim().length.toLocaleString('ko-KR')} / ${MAX_CAREER.toLocaleString('ko-KR')}`}
            </p>
          </div>

          <div>
            <Field label="포트폴리오 연결" hint="선택 · ‘포트폴리오 보기’가 이 디자이너 상세로 갑니다">
              <select value={v.designerId} onChange={(e) => set('designerId', e.target.value)} className={input}>
                <option value="">연결 안 함 (버튼 숨김)</option>
                {options.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                    {o.isPublic ? '' : ' — 비공개 프로필'}
                  </option>
                ))}
              </select>
            </Field>
            {picked && !picked.isPublic && (
              <p className="mt-1 text-xs text-amber-700">
                비공개 프로필이라 상세 페이지가 열리지 않습니다. 공개로 바뀌기 전까지 버튼이 보이지 않습니다.
              </p>
            )}
            {bad.designerId && <p className="mt-1 text-xs text-red-600">{bad.designerId}</p>}
          </div>
        </div>
      </div>

      <Flash msg={notice} onDone={() => setNotice(null)} className="mt-4" />

      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onClose} disabled={pending} className="h-9 rounded-lg px-4 text-sm text-neutral-600 hover:bg-neutral-100">
          취소
        </button>
        <button type="submit" disabled={pending || (touched && invalid)} className={primary}>
          {pending ? (image ? '사진 올리는 중…' : '저장 중…') : row ? '저장' : '추가하기'}
        </button>
      </div>
    </form>
  )
}
