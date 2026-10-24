'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import type { AdminDesignerListRow, DesignerActivity } from '@/lib/designer-shape'
import { displayName } from '@/lib/display-name'
import { shortDate, relativeDay } from '@/lib/format-date'
import { setDesignerVisible } from '@/app/admin/designers/actions'

export function DesignerTable({ designers }: { designers: AdminDesignerListRow[] }) {
  const [error, setError] = useState<string | null>(null)

  if (designers.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-neutral-300 py-16 text-center text-sm text-neutral-500">
        아직 등록된 디자이너가 없습니다.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      {error && <p className="rounded-lg bg-red-50 px-3.5 py-3 text-sm text-red-700">{error}</p>}

      <ul className="divide-y divide-neutral-200 overflow-hidden rounded-xl ring-1 ring-neutral-200">
        {designers.map((d) => (
          <li key={d.id} className="flex items-center gap-3 bg-white px-4 py-3.5 hover:bg-neutral-50">
            {/* 행 전체가 상세로 가는 링크 — 토글 버튼만 예외로 빠져 있다 */}
            <Link href={`/admin/designers/${d.id}`} className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="font-semibold">{displayName(d)}</span>
                {!d.name && (
                  <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[11px] text-neutral-500">
                    이름 미입력
                  </span>
                )}
                <span className="text-xs text-neutral-500">{d.email}</span>
                {!d.visible && (
                  <span className="rounded bg-red-100 px-1.5 py-0.5 text-[11px] text-red-800">
                    계정 비활성
                  </span>
                )}
                {/* 디자이너 본인이 정한 공개 여부 — 계정 비활성과 다른 축이다.
                    비활성 계정은 어차피 안 보이므로 그때는 겹쳐 쓰지 않는다. */}
                {d.visible && (
                  <span
                    className={`rounded px-1.5 py-0.5 text-[11px] ${
                      d.profile_public
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-neutral-200 text-neutral-600'
                    }`}
                  >
                    프로필 {d.profile_public ? '노출' : '숨김'}
                  </span>
                )}
                {d.temp_password ? (
                  <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] text-amber-800">
                    임시 비밀번호 사용 중
                  </span>
                ) : (
                  <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[11px] text-emerald-800">
                    비밀번호 설정 완료
                  </span>
                )}
              </div>

              {d.one_liner && (
                <p className="mt-1 truncate text-sm text-neutral-600">{d.one_liner}</p>
              )}

              {d.tags.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {d.tags.map((t) => (
                    <span
                      key={t}
                      className="rounded bg-neutral-100 px-1.5 py-0.5 text-[11px] text-neutral-600"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              )}

              <Metrics activity={d.activity} />
            </Link>

            {/* 공개 페이지 미리보기 — 행 전체 링크 안에 중첩하면 안 되므로 밖에 둔다.
                숨겨진 프로필은 열어도 404 라 아예 버튼을 만들지 않는다. */}
            {d.visible && d.profile_public && (
              <Link
                href={`/designers/${d.id}`}
                target="_blank"
                rel="noopener"
                title="공개 페이지 보기 (새 탭)"
                aria-label={`${displayName(d)} 공개 페이지 (새 탭)`}
                className="shrink-0 rounded-md border border-neutral-300 px-2.5 py-1.5 text-xs font-medium text-neutral-700 transition hover:bg-neutral-100"
              >
                공개 ↗
              </Link>
            )}

            <VisibleToggle designer={d} onError={setError} />

            <Link
              href={`/admin/designers/${d.id}`}
              aria-label={`${displayName(d)} 상세`}
              className="shrink-0 text-neutral-400 transition hover:text-neutral-900"
            >
              →
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

/* 활동 지표 넷 — 마지막 로그인 · 최근 30일 로그인 · 최근 업로드 · 포트폴리오 수 */
function Metrics({ activity: a }: { activity: DesignerActivity }) {
  return (
    <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-neutral-500">
      <Metric label="마지막 로그인" value={relativeDay(a.last_login_at)} />
      <Metric label="30일 로그인" value={`${a.logins_30d}회`} dim={a.logins_30d === 0} />
      <Metric label="최근 업로드" value={shortDate(a.last_work_at)} />
      <Metric
        label="포트폴리오"
        value={`${a.works_visible}/${a.works_total}`}
        /* 숫자만 보면 무엇의 비율인지 알기 어렵다 */
        title="노출 중 / 전체"
      />
    </dl>
  )
}

function Metric({
  label,
  value,
  dim,
  title,
}: {
  label: string
  value: string
  dim?: boolean
  title?: string
}) {
  return (
    <div className="flex items-baseline gap-1" title={title}>
      <dt className="text-neutral-400">{label}</dt>
      <dd className={dim ? 'text-neutral-400' : 'font-medium text-neutral-700'}>{value}</dd>
    </div>
  )
}

function VisibleToggle({
  designer: d,
  onError,
}: {
  designer: AdminDesignerListRow
  onError: (s: string | null) => void
}) {
  const [pending, start] = useTransition()

  return (
    <button
      onClick={() => {
        onError(null)
        start(async () => {
          const r = await setDesignerVisible(d.id, !d.visible)
          if (!r.ok) onError(r.error)
        })
      }}
      disabled={pending}
      /* 계정 자체를 막는 버튼이다 — 프로필 노출(디자이너 설정)과 구분해 둔다 */
      title={d.visible ? '계정을 비활성화하면 로그인도 막힙니다' : '계정을 다시 활성화합니다'}
      className="shrink-0 rounded-md border border-neutral-300 px-2.5 py-1.5 text-xs font-medium text-neutral-700 transition hover:bg-neutral-100 disabled:opacity-50"
    >
      {pending ? '…' : d.visible ? '비활성화' : '활성화'}
    </button>
  )
}
