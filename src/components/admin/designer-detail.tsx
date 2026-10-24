'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { AdminDesigner } from '@/lib/designer-shape'
import { MAX_BIO } from '@/lib/portfolio-limits'
import { formatPrice } from '@/lib/plans'
import { displayName } from '@/lib/display-name'
import {
  updateDesigner,
  setDesignerVisible,
  resetPassword,
  deleteDesigner,
} from '@/app/admin/designers/actions'
import { Field, input, ghostButton } from './form-bits'

type Notice = { kind: 'ok' | 'warn' | 'error'; text: string } | null

export function DesignerDetail({ designer: d }: { designer: AdminDesigner }) {
  const [notice, setNotice] = useState<Notice>(null)

  return (
    <div className="min-w-0 space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">{displayName(d)}</h1>
          <p className="mt-1 text-sm text-neutral-500">{d.email}</p>

          {/* 공개 페이지로 — 숨겨져 있으면 열어도 404 라 이유를 대신 보여준다 */}
          {d.visible && d.profile_public ? (
            <Link
              href={`/designers/${d.id}`}
              target="_blank"
              rel="noopener"
              className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-indigo-600 transition hover:text-indigo-800"
            >
              공개 페이지 보기 ↗
            </Link>
          ) : (
            <p className="mt-2 text-xs text-neutral-400">
              {!d.visible
                ? '계정이 비활성이라 공개 페이지가 열리지 않습니다.'
                : '디자이너가 프로필을 숨겨 공개 페이지가 열리지 않습니다.'}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {/* 두 상태는 축이 다르다 — 계정은 관리자가, 프로필은 디자이너 본인이 정한다 */}
          <span
            className={`rounded px-2 py-1 text-[11px] font-medium ${
              d.visible ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
            }`}
          >
            계정 {d.visible ? '활성' : '비활성'}
          </span>
          <span
            className={`rounded px-2 py-1 text-[11px] font-medium ${
              d.profile_public
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-neutral-200 text-neutral-600'
            }`}
            title="디자이너 본인이 설정합니다"
          >
            프로필 {d.profile_public ? '노출' : '숨김'}
          </span>
          <VisibleButton designer={d} onNotice={setNotice} />
        </div>
      </header>

      {notice && (
        <p
          className={`rounded-lg px-3.5 py-3 text-sm ${
            notice.kind === 'ok'
              ? 'bg-emerald-50 text-emerald-800'
              : notice.kind === 'warn'
                ? 'bg-amber-50 text-amber-800'
                : 'bg-red-50 text-red-700'
          }`}
        >
          {notice.text}
        </p>
      )}

      <ProfileForm designer={d} onNotice={setNotice} />

      <PlanSummary designer={d} />

      <AccountSection designer={d} onNotice={setNotice} />
    </div>
  )
}

/* ─────────── 가격 ─────────── */

/* 금액은 디자이너 본인이 고른다 — 어드민은 확인만 한다.
   문구를 바꾸려면 설정 화면으로 간다. */
function PlanSummary({ designer: d }: { designer: AdminDesigner }) {
  return (
    <section className="rounded-xl bg-white p-5 ring-1 ring-neutral-200">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold">가격 플랜</h2>
        <Link
          href="/admin/settings"
          className="text-xs font-medium text-indigo-600 transition hover:text-indigo-800"
        >
          문구 수정 →
        </Link>
      </div>

      <dl className="mt-3 space-y-2 text-sm">
        <div className="flex items-baseline justify-between gap-2">
          <dt className="text-neutral-500">디자인</dt>
          <dd className="font-medium">{formatPrice(d.design_price)}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-2">
          <dt className="text-neutral-500">프리미엄</dt>
          <dd className="flex items-center gap-1.5">
            {!d.premium_enabled && (
              <span className="rounded bg-neutral-200 px-1.5 py-0.5 text-[11px] text-neutral-600">
                숨김
              </span>
            )}
            <span className={d.premium_enabled ? 'font-medium' : 'text-neutral-400'}>
              {formatPrice(d.premium_price)}
            </span>
          </dd>
        </div>
      </dl>

      <p className="mt-3 text-xs text-neutral-400">금액은 디자이너가 직접 설정합니다.</p>
    </section>
  )
}

/* ─────────── 프로필 수정 ─────────── */

function ProfileForm({
  designer: d,
  onNotice,
}: {
  designer: AdminDesigner
  onNotice: (n: Notice) => void
}) {
  const [email, setEmail] = useState(d.email)
  const [name, setName] = useState(d.name ?? '')
  const [oneLiner, setOneLiner] = useState(d.one_liner ?? '')
  const [bio, setBio] = useState(d.bio ?? '')
  const [tags, setTags] = useState(d.tags.join(', '))
  const [pending, start] = useTransition()
  const router = useRouter()

  /* 저장 버튼을 누를 수 있는지 — 바뀐 것이 없으면 누를 이유가 없다 */
  const dirty =
    email !== d.email ||
    name !== (d.name ?? '') ||
    oneLiner !== (d.one_liner ?? '') ||
    bio !== (d.bio ?? '') ||
    tags !== d.tags.join(', ')

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    onNotice(null)
    start(async () => {
      const r = await updateDesigner({ id: d.id, email, name, oneLiner, bio, tags })
      if (!r.ok) return onNotice({ kind: 'error', text: r.error })
      onNotice({ kind: 'ok', text: '저장했습니다.' })
      router.refresh()
    })
  }

  return (
    <form onSubmit={submit} className="rounded-xl bg-white p-5 ring-1 ring-neutral-200">
      <h2 className="text-sm font-semibold">프로필</h2>

      <div className="mt-4 grid gap-3">
        <Field label="이메일" required hint="로그인 아이디">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className={input}
          />
        </Field>
        <Field label="이름" hint="선택">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="비워두면 디자이너가 직접 입력"
            className={input}
          />
        </Field>
        <Field label="한 줄 소개" hint="선택">
          <input value={oneLiner} onChange={(e) => setOneLiner(e.target.value)} className={input} />
        </Field>
        <Field label="소개글" hint={`선택 · 상세 화면 문단 · ${bio.length}/${MAX_BIO}`}>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={5}
            maxLength={MAX_BIO}
            className="w-full resize-y rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm outline-none ring-indigo-500 focus:ring-2"
          />
        </Field>
        <Field label="전문 분야" hint="선택 · 쉼표로 구분">
          <input value={tags} onChange={(e) => setTags(e.target.value)} className={input} />
        </Field>
      </div>

      <div className="mt-5 flex items-center gap-2">
        <button
          type="submit"
          disabled={pending || !dirty}
          className="rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-600 disabled:opacity-40"
        >
          {pending ? '저장 중…' : '저장'}
        </button>
        {dirty && !pending && (
          <span className="text-xs text-neutral-400">저장하지 않은 변경이 있습니다</span>
        )}
      </div>
    </form>
  )
}

/* ─────────── 계정 ─────────── */

function AccountSection({
  designer: d,
  onNotice,
}: {
  designer: AdminDesigner
  onNotice: (n: Notice) => void
}) {
  const [pending, start] = useTransition()
  const router = useRouter()

  return (
    <section className="rounded-xl bg-white p-5 ring-1 ring-neutral-200">
      <h2 className="text-sm font-semibold">계정</h2>

      <dl className="mt-3.5 space-y-2.5 text-sm">
        <div className="flex gap-3">
          <dt className="w-28 shrink-0 text-neutral-500">비밀번호</dt>
          <dd>
            {d.temp_password ? (
              <span className="flex flex-wrap items-center gap-2">
                <code className="rounded bg-amber-100 px-2 py-0.5 text-[13px] tracking-wide text-amber-900">
                  {d.temp_password}
                </code>
                <span className="text-xs text-neutral-500">임시 — 아직 변경하지 않았습니다</span>
              </span>
            ) : (
              <span className="text-neutral-600">
                설정 완료
                {d.password_changed_at &&
                  ` · ${new Date(d.password_changed_at).toLocaleString('ko-KR')}`}
              </span>
            )}
          </dd>
        </div>
        <div className="flex gap-3">
          <dt className="w-28 shrink-0 text-neutral-500">마지막 로그인</dt>
          <dd className="text-neutral-600">
            {d.last_login_at ? new Date(d.last_login_at).toLocaleString('ko-KR') : '기록 없음'}
          </dd>
        </div>
        <div className="flex gap-3">
          <dt className="w-28 shrink-0 text-neutral-500">등록일</dt>
          <dd className="text-neutral-600">{new Date(d.created_at).toLocaleString('ko-KR')}</dd>
        </div>
      </dl>

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          onClick={() => {
            onNotice(null)
            start(async () => {
              const r = await resetPassword(d.id)
              if (!r.ok) return onNotice({ kind: 'error', text: r.error })
              onNotice(
                r.mailed
                  ? { kind: 'ok', text: `${d.email} 로 새 임시 비밀번호를 보냈습니다.` }
                  : {
                      kind: 'warn',
                      text: `임시 비밀번호 ${r.tempPassword} 를 발급했지만 메일 발송에 실패했습니다 (${r.mailError}).`,
                    },
              )
              router.refresh()
            })
          }}
          disabled={pending}
          className={ghostButton}
        >
          임시 비밀번호 재발급
        </button>

        <button
          onClick={() => {
            if (!confirm(`${displayName(d)}(${d.email}) 계정을 삭제할까요? 되돌릴 수 없습니다.`)) {
              return
            }
            onNotice(null)
            start(async () => {
              const r = await deleteDesigner(d.id)
              if (!r.ok) return onNotice({ kind: 'error', text: r.error })
              router.push('/admin/designers')
            })
          }}
          disabled={pending}
          className="rounded-md border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50"
        >
          계정 삭제
        </button>
      </div>
    </section>
  )
}

function VisibleButton({
  designer: d,
  onNotice,
}: {
  designer: AdminDesigner
  onNotice: (n: Notice) => void
}) {
  const [pending, start] = useTransition()
  const router = useRouter()

  return (
    <button
      onClick={() => {
        onNotice(null)
        start(async () => {
          const r = await setDesignerVisible(d.id, !d.visible)
          if (!r.ok) return onNotice({ kind: 'error', text: r.error })
          router.refresh()
        })
      }}
      disabled={pending}
      className={ghostButton}
    >
      {pending ? '…' : d.visible ? '계정 비활성화' : '계정 활성화'}
    </button>
  )
}
