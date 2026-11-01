'use client'

import Link from 'next/link'
import { MAX_TAGS } from '@/lib/specialty-shape'

/* 디자이너의 전문 분야를 어드민 목록에서 고른다(011_specialties.sql).

   자유 입력이면 'UX/UI' 와 'UI/UX' 처럼 같은 분야가 따로 서서
   탐색 필터가 금세 지저분해진다 — 스튜디오의 선택지와 같은 목록을 쓴다.

   목록에 없는 값(꺼 두었거나 이름이 바뀐 분야)도 켜진 채로 보여준다.
   어드민은 그 값을 지우지 않고 남겨둘 수도 있어야 한다 — 끄기만 하면 빠진다. */
export function SpecialtyPicker({
  options,
  value,
  onChange,
}: {
  /* 설정에서 켜 둔 분야 이름 — 화면 차례대로 */
  options: string[]
  value: string[]
  onChange: (next: string[]) => void
}) {
  const orphans = value.filter((t) => !options.includes(t))
  const toggle = (name: string, on: boolean) =>
    onChange(on ? value.filter((t) => t !== name) : [...value, name])

  return (
    <div>
      <span className="mb-1.5 flex items-center justify-between text-xs font-medium text-neutral-600">
        <span>
          전문 분야 <span className="font-normal text-neutral-400">(선택 · 최대 {MAX_TAGS}개)</span>
        </span>
        <Link
          href="/admin/settings"
          className="font-normal text-violet-600 transition hover:text-violet-800"
        >
          목록 관리
        </Link>
      </span>

      {options.length === 0 && orphans.length === 0 ? (
        <p className="rounded-lg border border-dashed border-neutral-300 px-3 py-4 text-xs text-neutral-500">
          등록된 분야가 없습니다. 설정에서 먼저 추가해 주세요.
        </p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {[...options, ...orphans].map((name) => {
            const on = value.includes(name)
            const orphan = !options.includes(name)
            /* 상한에 닿으면 켜져 있는 것만 끌 수 있다 */
            const blocked = !on && value.length >= MAX_TAGS
            return (
              <label
                key={name}
                title={orphan ? '설정 목록에 없는 분야입니다' : undefined}
                className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm transition ${
                  orphan
                    ? 'cursor-pointer border-amber-400 bg-amber-50 text-amber-800'
                    : on
                      ? 'cursor-pointer border-violet-600 bg-violet-50 font-medium text-violet-700'
                      : blocked
                        ? 'border-neutral-200 text-neutral-300'
                        : 'cursor-pointer border-neutral-300 hover:bg-neutral-50'
                }`}
              >
                <input
                  type="checkbox"
                  checked={on}
                  disabled={blocked}
                  onChange={() => toggle(name, on)}
                  className={orphan ? 'accent-amber-600' : 'accent-violet-600'}
                />
                {name}
              </label>
            )
          })}
        </div>
      )}

      {orphans.length > 0 && (
        <p className="mt-2 text-[11px] leading-relaxed text-amber-700">
          노란 항목은 설정 목록에 없거나 꺼 둔 분야입니다. 탐색 필터에는 나오지 않습니다.
        </p>
      )}
    </div>
  )
}
