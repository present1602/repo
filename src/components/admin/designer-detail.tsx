'use client'

import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { AdminDesigner, PublicDesignerCard } from '@/lib/designer-shape'
import { DesignerCard } from '@/components/designer-list'
import { MAX_BIO, CARD_THUMBS } from '@/lib/portfolio-limits'
import {
  formatPrice,
  formatPriceRange,
  DEFAULT_PRICE_MAX,
  MIN_PRICE_MAX,
  MAX_PRICE_MAX,
} from '@/lib/plans'
import { displayName } from '@/lib/display-name'
import {
  updateDesigner,
  setDesignerVisible,
  resetPassword,
  deleteDesigner,
  setDesignerPriceMax,
  setDesignerWithDev,
} from '@/app/admin/designers/actions'
import { Field, input, ghostButton } from './form-bits'

type Notice = { kind: 'ok' | 'warn' | 'error'; text: string } | null

export function DesignerDetail({
  designer: d,
  cardPreview,
}: {
  designer: AdminDesigner
  /* 목록에 어떻게 실릴지 — 공개 전이라 아직 안 보이는 경우에도 받는다 */
  cardPreview: PublicDesignerCard | null
}) {
  const [notice, setNotice] = useState<Notice>(null)
  const [previewOpen, setPreviewOpen] = useState(false)

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
              className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-violet-600 transition hover:text-violet-800"
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

          {/* 목록에 어떻게 실릴지 — 공개 전에도 확인할 수 있어야 하므로
              위 조건(공개 여부) 바깥에 둔다. 공개 페이지는 숨기면 404 지만
              이것은 어드민 화면 안에서 그려 보이는 미리보기다. */}
          {cardPreview && (
            <button
              type="button"
              onClick={() => setPreviewOpen(true)}
              className="mt-1.5 block text-sm font-medium text-violet-600 transition hover:text-violet-800"
            >
              목록 페이지 미리보기
            </button>
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

      <PlanSummary designer={d} onNotice={setNotice} />

      <AccountSection designer={d} onNotice={setNotice} />

      {previewOpen && cardPreview && (
        <ListPreviewDialog designer={cardPreview} onClose={() => setPreviewOpen(false)} />
      )}
    </div>
  )
}

/* ─────────── 목록 미리보기 ───────────

   탐색 목록에서 이 디자이너만 걸러낸 모습을 그대로 보여준다.
   카드는 공개 화면과 같은 컴포넌트(DesignerCard)를 쓴다 — 베껴 두면
   한쪽만 고쳐져 "실제로 이렇게 보인다"가 거짓이 된다.

   좁은 좌측 칸이 아니라 넓은 모달에 띄운다. 실제 목록은 사이드바를 뺀
   폭을 쓰므로, 좁은 칸에 끼워 넣으면 썸네일이 몇 장 안 보여 미리보기
   구실을 못 한다. */
function ListPreviewDialog({
  designer: d,
  onClose,
}: {
  designer: PublicDesignerCard
  onClose: () => void
}) {
  /* Esc 로 닫고, 열려 있는 동안 뒤쪽이 스크롤되지 않게 한다 */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  const hidden = !d.works.length

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 md:p-8"
      onClick={onClose}
    >
      <div
        className="w-full max-w-5xl rounded-xl bg-white p-5 md:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">목록 페이지 미리보기</h3>
            <p className="mt-1 text-xs text-neutral-500">
              탐색 목록에서 이 디자이너만 검색했을 때의 한 줄입니다. 썸네일은 최대{' '}
              {CARD_THUMBS}장까지 실립니다.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="닫기"
            className="shrink-0 rounded p-1 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-900"
          >
            ✕
          </button>
        </div>

        {/* 실제 목록과 같은 바탕색 위에 올려야 카드가 같은 느낌으로 보인다 */}
        <div className="rounded-lg bg-neutral-100 p-4">
          <DesignerCard designer={d} />
        </div>

        <div className="mt-3 space-y-1">
          {hidden && (
            <p className="text-xs text-amber-700">
              공개된 작업이 없어 썸네일 줄이 비어 있습니다.
            </p>
          )}
          {d.works_total > CARD_THUMBS && (
            <p className="text-xs text-neutral-500">
              작업 {d.works_total}개 중 {CARD_THUMBS}장이 실리고, 나머지
              {d.works_total - CARD_THUMBS}개는 &lsquo;+더보기&rsquo;로 접힙니다.
            </p>
          )}
          <p className="text-xs text-neutral-400">
            포트폴리오 순서를 바꾸면 여기 실리는 썸네일도 함께 바뀝니다.
          </p>
        </div>
      </div>
    </div>
  )
}

/* ─────────── 가격 ─────────── */

/* 금액은 디자이너 본인이 고른다 — 어드민은 확인만 한다.
   문구를 바꾸려면 설정 화면으로 간다. */
function PlanSummary({
  designer: d,
  onNotice,
}: {
  designer: AdminDesigner
  onNotice: (n: Notice) => void
}) {
  /* 상한은 어드민이 직접 적는다 — 금액을 올려 줄 만한 디자이너를
     가려내는 일은 사람이 판단한다(016_price_range.sql). */
  const [priceMax, setPriceMax] = useState(String(d.price_max))
  const [pending, start] = useTransition()
  /* 의뢰 유형은 저장 버튼 없이 바로 반영된다 — 가격과 따로 둔다 */
  const [pendingScope, startScope] = useTransition()
  const router = useRouter()

  const dirty = priceMax !== String(d.price_max)

  const save = (e: React.FormEvent) => {
    e.preventDefault()
    onNotice(null)
    start(async () => {
      const r = await setDesignerPriceMax(d.id, Number(priceMax))
      if (!r.ok) {
        onNotice({ kind: 'error', text: r.error })
        return
      }
      router.refresh()
      onNotice({ kind: 'ok', text: '상한을 바꿨습니다.' })
    })
  }

  return (
    <section className="rounded-xl bg-white p-5 ring-1 ring-neutral-200">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold">가격 플랜</h2>
        <Link
          href="/admin/settings"
          className="text-xs font-medium text-violet-600 transition hover:text-violet-800"
        >
          문구 수정 →
        </Link>
      </div>

      <dl className="mt-3 space-y-2 text-sm">
        <div className="flex items-baseline justify-between gap-2">
          <dt className="text-neutral-500">디자인</dt>
          <dd className="font-medium">{formatPriceRange(d.design_price, d.price_max)}</dd>
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

      {/* 상한 — 여기만 어드민이 정한다. 시작가는 디자이너가 고른다. */}
      <form onSubmit={save} className="mt-4 border-t border-neutral-200 pt-4">
        <label className="block">
          <span className="mb-1.5 flex items-baseline justify-between text-xs font-medium text-neutral-600">
            시안 가격 상한
            <span className="font-normal text-neutral-400">어드민만 수정</span>
          </span>
          <div className="flex gap-2">
            <input
              type="number"
              inputMode="numeric"
              value={priceMax}
              onChange={(e) => setPriceMax(e.target.value)}
              min={MIN_PRICE_MAX}
              max={MAX_PRICE_MAX}
              step={1000}
              className="h-9 min-w-0 flex-1 rounded-lg border border-neutral-300 px-3 text-sm outline-none ring-violet-500 focus:ring-2"
            />
            <button
              type="submit"
              disabled={pending || !dirty}
              className="shrink-0 rounded-lg bg-neutral-900 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-violet-600 disabled:opacity-40"
            >
              {pending ? '저장 중…' : '저장'}
            </button>
          </div>
        </label>

        <p className="mt-2 text-xs leading-relaxed text-neutral-400">
          올려 두면 디자이너가 더 높은 시작가를 고를 수 있습니다. 기본{' '}
          {formatPrice(DEFAULT_PRICE_MAX)}.
        </p>
      </form>

      <p className="mt-3 text-xs text-neutral-400">시작가는 디자이너가 설정합니다.</p>

      {/* 받을 의뢰 유형 중 '디자인 + 개발'만 어드민이 연다 —
          오프라인 미팅·상주 근무 요청이 따를 수 있어 아무나 받을 수 없다.
          나머지 둘은 디자이너 몫이라 여기서 다루지 않는다. */}
      <div className="mt-5 border-t border-neutral-200 pt-4">
        <p className="text-xs font-medium text-neutral-600">의뢰 유형</p>

        <label className="mt-2.5 flex cursor-pointer items-start gap-2.5">
          <input
            type="checkbox"
            checked={d.scope_with_dev}
            disabled={pendingScope}
            onChange={(e) =>
              startScope(async () => {
                onNotice(null)
                const r = await setDesignerWithDev(d.id, e.target.checked)
                if (!r.ok) {
                  onNotice({ kind: 'error', text: r.error })
                  return
                }
                router.refresh()
                onNotice({
                  kind: 'ok',
                  text: e.target.checked
                    ? '프로젝트 의뢰(디자인 + 개발)를 받도록 열었습니다.'
                    : '프로젝트 의뢰(디자인 + 개발)를 닫았습니다.',
                })
              })
            }
            className="mt-0.5 shrink-0 accent-violet-600"
          />
          <span className="min-w-0">
            <span className="block text-sm font-medium">프로젝트 의뢰(디자인 + 개발)</span>
            <span className="mt-0.5 block text-xs leading-relaxed text-neutral-500">
              켜면 이 디자이너가 개발까지 포함한 의뢰를 받습니다. 디자이너 본인은 바꿀 수
              없습니다.
            </span>
          </span>
        </label>

        <p className="mt-2.5 text-xs text-neutral-400">
          메인 시안 우선과 디자인 의뢰는 디자이너가 직접 켜고 끕니다.
        </p>
      </div>
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
            className="w-full resize-y rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm outline-none ring-violet-500 focus:ring-2"
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
          className="rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-600 disabled:opacity-40"
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
