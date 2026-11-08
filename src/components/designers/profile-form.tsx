'use client'

import { useEffect, useRef, useState } from 'react'
import { useActionTransition } from '@/lib/use-action-transition'
import { useRouter } from 'next/navigation'
import type { AdminDesigner } from '@/lib/designer-shape'
import {
  type WorkRow,
  MAX_BIO,
  MIN_PUBLIC_WORKS,
  checkPublicReady,
} from '@/lib/portfolio-limits'
import { NAME_MAX, nameError } from '@/lib/display-name'
import { updateProfile, updateAvatar, setProfilePublic } from '@/app/studio/actions'
import { shrinkAvatar } from '@/lib/shrink-image'
import { Img } from '@/components/img'
import { Flash } from '@/components/flash'
import { InviteLinkRow } from './invite-link-row'

export function ProfileForm({
  designer: d,
  works,
  onGoSettings,
}: {
  designer: AdminDesigner
  /* 분야는 설정 탭에서 고친다 — 그 탭으로 옮겨 준다 */
  onGoSettings: () => void
  /* 공개 조건을 재는 데 쓴다 — 작업 수와 AI 표기를 센다 */
  works: Pick<WorkRow, 'visible' | 'ai_used'>[]
}) {
  const [name, setName] = useState(d.name ?? '')
  const [oneLiner, setOneLiner] = useState(d.one_liner ?? '')
  const [bio, setBio] = useState(d.bio ?? '')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [pending, start] = useActionTransition()
  const router = useRouter()

  /* 관리자가 이름을 정해줬으면 잠겨 있다 — 변경은 관리자에게 요청한다 */
  const locked = d.name_locked

  const dirty =
    (!locked && name !== (d.name ?? '')) ||
    oneLiner !== (d.one_liner ?? '') ||
    bio !== (d.bio ?? '')

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setMsg(null)
    const bad = locked ? null : nameError(name)
    if (bad) return setMsg({ ok: false, text: bad })
    start(async () => {
      const r = await updateProfile({ name, oneLiner, bio })
      if (!r.ok) {
        setMsg({ ok: false, text: r.error })
        return
      }
      setMsg({ ok: true, text: '저장했습니다.' })
      router.refresh()
    }, '프로필 저장')
  }

  return (
    <div className="space-y-6">
      <PublicToggle designer={d} works={works} onMessage={setMsg} />

      <AvatarPicker designer={d} onMessage={setMsg} />

      <InviteLinkRow code={d.ref_code} />

      <form onSubmit={submit} className="space-y-3.5">
        <Flash msg={msg} onDone={() => setMsg(null)} />

        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-neutral-600">
            이름
            {locked && <span className="ml-1 font-normal text-neutral-400">(변경 불가)</span>}
          </span>
          <input
            value={locked ? (d.name ?? '') : name}
            onChange={(e) => setName(e.target.value)}
            disabled={locked}
            required={!locked}
            maxLength={NAME_MAX}
            placeholder="실명 (한글 2~6자)"
            className={`${input} disabled:bg-neutral-100 disabled:text-neutral-500`}
          />
          <span className="mt-1 block text-xs text-neutral-400">
            {locked
              ? '이름 변경이 필요하면 관리자에게 문의해 주세요.'
              : '공개 화면에는 가운데를 가려 김*연 처럼 보입니다. 한 번 저장하면 이후 변경은 관리자에게 요청해야 합니다.'}
          </span>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-neutral-600">한 줄 소개</span>
          <input
            value={oneLiner}
            onChange={(e) => setOneLiner(e.target.value)}
            placeholder="복잡한 서비스를 단정한 화면으로 정리합니다."
            className={input}
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-neutral-600">
            소개글 <span className="font-normal text-neutral-400">(선택)</span>
          </span>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={6}
            maxLength={MAX_BIO}
            placeholder={'어떤 작업을 해왔는지, 어떻게 일하는지 적어주세요.\n줄바꿈은 그대로 보입니다.'}
            className="w-full resize-y rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm outline-none ring-violet-500 focus:ring-2"
          />
          <span className="mt-1 flex justify-between text-xs text-neutral-400">
            <span>프로필 상세 화면에 문단으로 들어갑니다.</span>
            <span>
              {bio.length} / {MAX_BIO}
            </span>
          </span>
        </label>

        <div className="flex items-center gap-2 pt-1">
          <button
            type="submit"
            disabled={pending || !dirty}
            className="rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-600 disabled:opacity-40"
          >
            {pending ? '저장 중…' : '저장'}
          </button>
          {dirty && !pending && (
            <span className="text-xs text-neutral-400">저장하지 않은 변경이 있습니다</span>
          )}
        </div>
      </form>

      {/* 전문 분야(designers.tags) — 의뢰 받는 분야·프로필 태그는 같은 칸·같은 상한을 써서
          설정 탭의 가격 플랜에서 함께 고친다(plan-form.tsx). 여기서는 보여주기만 한다.
          폼 밖에 선을 긋고 둔다 — 저장 버튼 위에 있으면 여기서 고쳐 저장할 수 있는 칸으로 읽히지 않는다 */}
      <section className="border-t border-neutral-200 pt-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold">전문 분야 · 프로필 태그</h3>
            <p className="mt-1 text-xs text-neutral-500">
              의뢰 받는 분야와 함께 설정 탭의 가격 플랜에서 변경합니다.
            </p>
          </div>
          <button
            type="button"
            onClick={onGoSettings}
            className="shrink-0 rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 transition hover:bg-neutral-100"
          >
            설정에서 변경 →
          </button>
        </div>
        {d.tags.length > 0 ? (
          <p className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-sm text-violet-500">
            {d.tags.map((t) => (
              <span key={t}>#{t}</span>
            ))}
          </p>
        ) : (
          <p className="mt-3 rounded-lg border border-dashed border-neutral-300 px-3 py-3 text-xs text-neutral-500">
            아직 고른 분야가 없습니다. 설정 탭의 가격 플랜에서 의뢰 받는 분야와 프로필 태그를 골라 주세요.
          </p>
        )}
      </section>
    </div>
  )
}

/* 프로필 노출 / 숨김 — 본인이 켜고 끈다.

   관리자가 계정을 정지(visible=false)한 경우에는 이 스위치를 켜도
   탐색 화면에 나오지 않는다. 켜 두었는데 안 보이면 혼란스러우므로
   그 상태를 따로 알려준다. */
function PublicToggle({
  designer: d,
  works,
  onMessage,
}: {
  designer: AdminDesigner
  works: Pick<WorkRow, 'visible' | 'ai_used'>[]
  onMessage: (m: { ok: boolean; text: string } | null) => void
}) {
  const [pending, start] = useActionTransition()
  const router = useRouter()

  const on = d.profile_public
  const suspended = !d.visible

  /* 공개 조건 — 서버 액션과 같은 기준을 쓴다(portfolio-limits.ts).
     한쪽만 고치면 켤 수 있다고 해 놓고 서버가 거절하게 된다. */
  const ready = checkPublicReady(works)
  const blocked = !on && !ready.ok

  const toggle = () => {
    onMessage(null)

    /* 켤 수 없는 상태면 서버까지 가지 않고 무엇이 모자란지 알린다 */
    if (blocked) {
      onMessage({ ok: false, text: `공개하려면 ${ready.reasons.join(', ')}가 필요합니다.` })
      return
    }

    start(async () => {
      const r = await setProfilePublic(!on)
      if (!r.ok) {
        onMessage({ ok: false, text: r.error })
        return
      }
      router.refresh()
    }, '공개 설정 변경')
  }

  return (
    <div className="rounded-xl border border-neutral-200 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">프로필 상태</span>
            <span
              className={`rounded px-2 py-0.5 text-[11px] font-medium ${
                on ? 'bg-emerald-100 text-emerald-800' : 'bg-neutral-200 text-neutral-600'
              }`}
            >
              {on ? '노출' : '숨김'}
            </span>
          </div>
          <p className="mt-1 text-xs text-neutral-500">
            {on
              ? '탐색 화면에 프로필과 포트폴리오가 보입니다.'
              : ready.ok
                ? '공개 조건을 갖췄습니다. 오른쪽 스위치로 켜 주세요.'
                : '아직 공개되지 않았습니다.'}
          </p>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label="프로필 노출"
          onClick={toggle}
          disabled={pending}
          className={`relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-50 ${
            on ? 'bg-emerald-500' : 'bg-neutral-300'
          }`}
        >
          <span
            className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-all ${
              on ? 'left-[22px]' : 'left-0.5'
            }`}
          />
        </button>
      </div>

      {/* 공개 조건 — 켜져 있을 때는 숨긴다. 이미 지난 관문이다.
          무엇이 남았는지 눈에 보여야 "왜 안 켜지지"로 멈추지 않는다. */}
      {!on && ready.shown === 0 && (
        <p className="mt-3 rounded-lg bg-neutral-100 px-3 py-2.5 text-xs text-neutral-700">
          <span className="font-semibold">공개된 작업 0개:</span> 공개된 작업이{' '}
          {MIN_PUBLIC_WORKS}개 이상이어야 프로필 노출 가능합니다.
        </p>
      )}

      {suspended && (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
          관리자가 계정을 비활성화했습니다. 이 설정과 무관하게 탐색 화면에 노출되지 않습니다 —
          관리자에게 문의해 주세요.
        </p>
      )}
    </div>
  )
}

function AvatarPicker({
  designer: d,
  onMessage,
}: {
  designer: AdminDesigner
  onMessage: (m: { ok: boolean; text: string } | null) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [pending, start] = useActionTransition()
  const router = useRouter()
  const [toast, setToast] = useState(false)

  /* 잠깐 보여주고 스스로 사라진다(settings-panel.tsx 의 비밀번호 변경 알림과 같은 모양) */
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(false), 2500)
    return () => clearTimeout(t)
  }, [toast])

  const pick = (picked: File) => {
    onMessage(null)
    start(async () => {
      /* 1MB 를 넘으면 서버 액션이 받지 못한다 — 브라우저에서 먼저 줄인다 */
      const file = await shrinkAvatar(picked)
      if (!file) {
        onMessage({ ok: false, text: '이미지를 줄이지 못했습니다. 다른 이미지를 골라 주세요.' })
        return
      }
      const form = new FormData()
      form.set('image', file)
      const r = await updateAvatar(form)
      if (!r.ok) {
        onMessage({ ok: false, text: r.error })
        return
      }
      setToast(true)
      router.refresh()
    }, '프로필 이미지 저장')
  }

  return (
    <div className="flex items-center gap-4">
      {toast && (
        <div
          role="status"
          className="pointer-events-none fixed inset-x-0 top-6 z-[60] flex justify-center px-4"
        >
          <p className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg">
            프로필 이미지를 변경했습니다.
          </p>
        </div>
      )}
      {d.avatar_url ? (
        <Img src={d.avatar_url} alt="" className="size-16 shrink-0 rounded-full" />
      ) : (
        <div className="grid size-16 shrink-0 place-items-center rounded-full bg-neutral-200 text-xs text-neutral-500">
          없음
        </div>
      )}

      <div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) pick(f)
            /* 같은 파일을 다시 고를 수 있게 비운다 */
            e.target.value = ''
          }}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={pending}
          className="rounded-md border border-neutral-300 px-2.5 py-1.5 text-xs font-medium text-neutral-700 transition hover:bg-neutral-100 disabled:opacity-50"
        >
          {pending ? '올리는 중…' : '프로필 이미지 변경'}
        </button>
        <p className="mt-1.5 text-xs text-neutral-400">정사각형 이미지를 권장합니다</p>
      </div>
    </div>
  )
}

const input =
  'h-10 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm outline-none ring-violet-500 focus:ring-2'
