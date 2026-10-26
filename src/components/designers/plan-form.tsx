'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { AdminDesigner } from '@/lib/designer-shape'
import {
  designPriceOptions,
  formatPrice,
  formatPriceRange,
  type PlanCopy,
} from '@/lib/plans'
import { SCOPES, SCOPE_LABELS, SCOPE_HINTS } from '@/lib/scopes'
import { updatePlans } from '@/app/studio/actions'

/* 디자이너가 플랜 금액을 고르는 화면.

   금액은 정해진 보기 중에서만 고른다 — 자유 입력이 아니다.
   이름·설명은 전역 설정이라 여기서 바꿀 수 없고, 보여주기만 한다. */
export function PlanForm({ designer: d, copy }: { designer: AdminDesigner; copy: PlanCopy }) {
  const [designPrice, setDesignPrice] = useState(d.design_price)
  /* 프리미엄은 화면에서 감췄다 — 값은 그대로 보내 서버가 덮어쓰지 않게 한다.
     되살릴 때 setter 를 다시 만들면 된다(아래 주석 처리한 구획). */
  const [premiumPrice] = useState(d.premium_price)
  const [premiumEnabled] = useState(d.premium_enabled)
  /* 받을 의뢰 유형 — 메인 시안·디자인 전체는 본인이 켜고 끈다.
     019 전 DB 에는 scope_sample 이 없어 undefined 로 온다 — 그때까지는
     모두가 받던 값이므로 켜짐으로 본다. */
  const initialSample = d.scope_sample ?? true
  const [sample, setSample] = useState(initialSample)
  const [fullDesign, setFullDesign] = useState(d.scope_full_design)
  /* 어드민이 정하는 값이라 상태로 들지 않는다 — 서버가 준 것을 그대로 보여준다 */
  const withDev = d.scope_with_dev
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [pending, start] = useTransition()
  const router = useRouter()

  /* 상한보다 높은 시작가는 고를 수 없다 — 범위가 뒤집힌다.
     어드민이 상한을 99,000 이상으로 올려 두면 99,000원도 보기에 들어온다. */
  const startOptions = designPriceOptions(d.price_max)

  const dirty =
    designPrice !== d.design_price ||
    premiumPrice !== d.premium_price ||
    premiumEnabled !== d.premium_enabled ||
    sample !== initialSample ||
    fullDesign !== d.scope_full_design

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setMsg(null)
    start(async () => {
      const r = await updatePlans({
        designPrice,
        premiumPrice,
        premiumEnabled,
        scopeSample: sample,
        scopeFullDesign: fullDesign,
      })
      if (!r.ok) {
        setMsg({ ok: false, text: r.error })
        return
      }
      setMsg({ ok: true, text: '저장했습니다.' })
      router.refresh()
    })
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      {msg && (
        <p
          className={`rounded-lg px-3 py-2.5 text-sm ${
            msg.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'
          }`}
        >
          {msg.text}
        </p>
      )}

      <div>
        <h2 className="text-sm font-semibold">가격 플랜</h2>
        <p className="mt-1 text-xs text-neutral-500">
          공개 프로필에 보이는 금액입니다. 플랜 이름과 설명은 모든 디자이너가 함께 쓰므로
          변경할 수 없습니다.
        </p>
      </div>

      {/* 디자인 플랜 — 필수라 끄는 스위치가 없다.

          공개 화면에는 "시작가 ~ 상한" 범위로 나간다. 시작가만 고르고
          상한은 어드민이 정한다(016_price_range.sql). */}
      <section>
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">{copy.design_plan_name}</h3>
          <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[11px] text-neutral-500">
            항상 노출
          </span>
        </div>
        <p className="mt-1 text-xs leading-relaxed text-neutral-500">{copy.design_plan_desc}</p>

        <div className="mt-3.5 flex flex-wrap items-end gap-3">
          <label className="min-w-0">
            <span className="mb-1.5 block text-xs font-medium text-neutral-600">시작가</span>
            <select
              value={designPrice}
              onChange={(e) => setDesignPrice(Number(e.target.value))}
              className="h-10 rounded-lg border border-neutral-300 bg-white px-3 text-sm outline-none ring-violet-500 focus:ring-2"
            >
              {startOptions.map((p) => (
                <option key={p} value={p}>
                  {formatPrice(p)}
                </option>
              ))}
            </select>
          </label>

          <span className="pb-2.5 text-neutral-400">~</span>

          <div className="min-w-0">
            <span className="mb-1.5 block text-xs font-medium text-neutral-600">
              상한 <span className="font-normal text-neutral-400">(관리자 설정)</span>
            </span>
            {/* 고칠 수 없는 값이라 입력칸처럼 보이되 눌리지 않게 둔다 */}
            <p className="flex h-10 items-center rounded-lg bg-neutral-100 px-3 text-sm font-medium text-neutral-500">
              {formatPrice(d.price_max)}
            </p>
          </div>
        </div>

        <p className="mt-2.5 text-xs leading-relaxed text-neutral-400">
          공개 프로필에는 <b className="font-medium text-neutral-600">
            {formatPriceRange(designPrice, d.price_max)}
          </b>{' '}
          으로 보입니다. 상한을 올리려면 관리자에게 문의해 주세요.
        </p>
      </section>

      <hr className="border-neutral-200" />

      {/* 받을 의뢰 유형 — 탐색 화면이 이 체크로 디자이너를 거른다.
          모두 꺼도 된다 — 탐색 목록에서만 빠지고 프로필 링크는 열린다. */}
      <section>
        <h3 className="text-sm font-semibold">받을 의뢰 유형</h3>
        <p className="mt-1 text-xs leading-relaxed text-neutral-500">
          체크한 유형의 의뢰만 연결됩니다. 맡기 어려운 유형은 꺼 두세요. 소액 의뢰 없이 본계약
          건만 받으려면 메인 시안 의뢰를 끄면 됩니다.
        </p>
        {!sample && !fullDesign && !withDev && (
          <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800">
            모든 유형을 끄면 탐색 목록에 노출되지 않습니다. 프로필 링크를 직접 받은 사람만 볼 수
            있습니다.
          </p>
        )}

        <div className="mt-3.5 space-y-2">
          {SCOPES.map((s) => {
            /* 세 유형의 주인이 다르다 —
                 sample      본인이 켜고 끈다. 기본 켜짐.
                 full_design 본인이 켜고 끈다.
                 with_dev    어드민이 열어 준다. 본인은 보기만 한다. */
            const locked = s === 'with_dev'
            const on = s === 'sample' ? sample : s === 'full_design' ? fullDesign : withDev

            return (
              <label
                key={s}
                className={[
                  'flex items-start gap-2.5 rounded-lg border p-3 transition',
                  on
                    ? 'border-violet-600 bg-violet-50'
                    : locked
                      ? 'border-neutral-200 bg-neutral-50'
                      : 'border-neutral-300 hover:bg-neutral-50',
                  /* 눌러서 무언가 일어나는 것만 손가락 커서를 준다 —
                     with_dev 는 어드민 몫이라 눌러도 아무 일이 없다 */
                  s === 'with_dev' ? '' : 'cursor-pointer',
                ].join(' ')}
              >
                {/* 켜진 채 잠긴 유형은 체크박스를 쓰지 않는다 —
                    disabled 가 걸리면 브라우저가 흐리게 칠해 accent 색이
                    먹지 않고, 꺼진 것처럼 보인다. 같은 자리에 같은 크기로
                    보라색 체크를 그려 "켜져 있다"가 분명해지게 한다. */}
                {locked && on ? (
                  <span
                    /* 보기만 하는 값이라 입력이 아니다 — 읽는 기기에는
                       '선택됨'으로 알리고, 조작할 수 없음을 함께 전한다 */
                    role="img"
                    aria-label="선택됨 (변경 불가)"
                    className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-[3px] bg-violet-600 text-[10px] font-bold text-white"
                  >
                    ✓
                  </span>
                ) : (
                  <input
                    type="checkbox"
                    checked={on}
                    disabled={locked}
                    onChange={(e) =>
                      (s === 'sample' ? setSample : setFullDesign)(e.target.checked)
                    }
                    className="mt-0.5 shrink-0 accent-violet-600"
                  />
                )}
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2">
                    <span
                      className={`text-sm font-medium ${
                        locked && !on ? 'text-neutral-500' : ''
                      }`}
                    >
                      {SCOPE_LABELS[s]}
                    </span>
                    {s === 'sample' && (
                      <span className="rounded bg-violet-600 px-1.5 py-0.5 text-[10px] font-medium text-white">
                        기본
                      </span>
                    )}
                    {s === 'with_dev' && (
                      <span className="rounded bg-neutral-200 px-1.5 py-0.5 text-[10px] font-medium text-neutral-600">
                        관리자 승인
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-neutral-500">
                    {SCOPE_HINTS[s]}
                  </span>
                  {/* 왜 못 바꾸는지 적어 둔다 — 비활성 체크박스만 두면
                      고장으로 읽힌다 */}
                </span>
              </label>
            )
          })}
        </div>
      </section>

      {/* 프리미엄 플랜은 화면에서 감췄다 — 금액 체계가 '시작가 ~ 상한'
          범위로 바뀌어 두 번째 플랜을 둘 자리가 마땅치 않다.
          DB 컬럼(premium_price·premium_enabled)과 공개 화면 표시는 그대로
          두었으므로 값은 보존된다. 다시 쓸 때는 git 이력에서 PlanSection 과
          이 구획을 꺼내 오면 된다. */}

      <div className="flex items-center gap-2">
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
