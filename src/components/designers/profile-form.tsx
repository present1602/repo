'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { AdminDesigner } from '@/lib/designer-shape'
import { MAX_BIO } from '@/lib/portfolio-limits'
import { MAX_TAGS } from '@/lib/specialty-shape'
import { updateProfile, updateAvatar, setProfilePublic } from '@/app/studio/actions'
import { Img } from '@/components/img'

export function ProfileForm({
  designer: d,
  options,
}: {
  designer: AdminDesigner
  /* 고를 수 있는 분야 — 어드민이 켜 둔 것만 온다(011_specialties.sql) */
  options: string[]
}) {
  const [name, setName] = useState(d.name ?? '')
  const [oneLiner, setOneLiner] = useState(d.one_liner ?? '')
  const [bio, setBio] = useState(d.bio ?? '')
  /* 서버에는 지금까지처럼 쉼표 문자열로 보낸다 — 화면만 체크박스로 바뀌었다 */
  const [tags, setTags] = useState(d.tags.join(', '))
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [pending, start] = useTransition()
  const router = useRouter()

  /* 지금 고른 분야. 목록에 없는 것(어드민이 바꾸거나 지운 이름)은
     체크박스로 끌 수 없으므로 따로 모아 알려준다. */
  const picked = tags
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const orphans = picked.filter((t) => !options.includes(t))

  /* 관리자가 이름을 정해줬으면 잠겨 있다 — 변경은 관리자에게 요청한다 */
  const locked = d.name_locked

  const dirty =
    (!locked && name !== (d.name ?? '')) ||
    oneLiner !== (d.one_liner ?? '') ||
    bio !== (d.bio ?? '') ||
    tags !== d.tags.join(', ')

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setMsg(null)
    start(async () => {
      const r = await updateProfile({ name, oneLiner, bio, tags })
      if (!r.ok) {
        setMsg({ ok: false, text: r.error })
        return
      }
      setMsg({ ok: true, text: '저장했습니다.' })
      router.refresh()
    })
  }

  return (
    <div className="space-y-6">
      <PublicToggle designer={d} onMessage={setMsg} />

      <AvatarPicker designer={d} onMessage={setMsg} />

      <form onSubmit={submit} className="space-y-3.5">
        {msg && (
          <p
            className={`rounded-lg px-3 py-2.5 text-sm ${
              msg.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'
            }`}
          >
            {msg.text}
          </p>
        )}

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
            placeholder="공개 페이지에 표시할 이름"
            className={`${input} disabled:bg-neutral-100 disabled:text-neutral-500`}
          />
          <span className="mt-1 block text-xs text-neutral-400">
            {locked
              ? '이름 변경이 필요하면 관리자에게 문의해 주세요.'
              : '한 번 저장하면 이후 변경은 관리자에게 요청해야 합니다.'}
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

        {/* 전문 분야 — 어드민이 정한 목록에서 고른다(011_specialties.sql).
            자유 입력을 두면 같은 분야가 조금씩 다른 이름으로 서서
            탐색 필터가 금세 지저분해진다. */}
        <div>
          <span className="mb-1.5 block text-xs font-medium text-neutral-600">
            전문 분야{' '}
            <span className="font-normal text-neutral-400">(최대 {MAX_TAGS}개)</span>
          </span>

          {options.length === 0 ? (
            <p className="rounded-lg border border-dashed border-neutral-300 px-3 py-4 text-xs text-neutral-500">
              아직 고를 수 있는 분야가 없습니다. 관리자에게 문의해 주세요.
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {options.map((name) => {
                const on = picked.includes(name)
                /* 상한에 닿으면 켜져 있는 것만 끌 수 있다 */
                const blocked = !on && picked.length >= MAX_TAGS
                return (
                  <label
                    key={name}
                    className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm transition ${
                      on
                        ? 'border-violet-600 bg-violet-50 font-medium text-violet-700'
                        : blocked
                          ? 'border-neutral-200 text-neutral-300'
                          : 'cursor-pointer border-neutral-300 hover:bg-neutral-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      disabled={blocked}
                      onChange={() =>
                        setTags(
                          (on ? picked.filter((t) => t !== name) : [...picked, name]).join(', '),
                        )
                      }
                      className="accent-violet-600"
                    />
                    {name}
                  </label>
                )
              })}
            </div>
          )}

          {/* 목록에서 빠진 분야를 쓰고 있으면 알려준다 — 어드민이 이름을
              바꾸거나 지운 경우다. 저장하면 사라지므로 미리 보여준다. */}
          {orphans.length > 0 && (
            <p className="mt-2 text-[11px] leading-relaxed text-amber-700">
              {orphans.join(', ')} — 지금은 고를 수 없는 분야입니다. 저장하면 빠집니다.
            </p>
          )}
        </div>

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
    </div>
  )
}

/* 프로필 노출 / 숨김 — 본인이 켜고 끈다.

   관리자가 계정을 정지(visible=false)한 경우에는 이 스위치를 켜도
   탐색 화면에 나오지 않는다. 켜 두었는데 안 보이면 혼란스러우므로
   그 상태를 따로 알려준다. */
function PublicToggle({
  designer: d,
  onMessage,
}: {
  designer: AdminDesigner
  onMessage: (m: { ok: boolean; text: string } | null) => void
}) {
  const [pending, start] = useTransition()
  const router = useRouter()

  const on = d.profile_public
  const suspended = !d.visible

  const toggle = () => {
    onMessage(null)
    start(async () => {
      const r = await setProfilePublic(!on)
      if (!r.ok) {
        onMessage({ ok: false, text: r.error })
        return
      }
      router.refresh()
    })
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
              : '아직 공개되지 않았습니다. 프로필과 포트폴리오를 채운 뒤 켜 주세요.'}
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
  const [pending, start] = useTransition()
  const router = useRouter()

  const pick = (file: File) => {
    onMessage(null)
    const form = new FormData()
    form.set('image', file)
    start(async () => {
      const r = await updateAvatar(form)
      if (!r.ok) {
        onMessage({ ok: false, text: r.error })
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="flex items-center gap-4">
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
