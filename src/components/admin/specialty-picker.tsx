'use client'

import Link from 'next/link'
import { MAX_TAGS, type SpecialtyOption } from '@/lib/specialty-shape'

/* 디자이너의 전문 분야를 어드민 목록에서 고른다(011_specialties.sql).

   자유 입력이면 'UX/UI' 와 'UI/UX' 처럼 같은 분야가 따로 서서
   탐색 필터가 금세 지저분해진다 — 스튜디오의 선택지와 같은 목록을 쓴다.

   목록에 없는 값(지웠거나 DB 에서 이름이 바뀐 분야)도 켜진 채로 보여준다.
   어드민은 그 값을 지우지 않고 남겨둘 수도 있어야 한다 — 끄기만 하면 빠진다.
   메뉴(탐색 사이드바)에 나오는 분야는 앞에 서고 옅은 보라 테두리로 가른다. */
export function SpecialtyPicker({
  options,
  value,
  onChange,
}: {
  /* 분야 — 숨긴 것까지 전부, 메뉴 노출 분야가 앞 */
  options: SpecialtyOption[]
  value: string[]
  onChange: (next: string[]) => void
}) {
  const names = options.map((o) => o.name)
  const shown = new Set(options.filter((o) => o.visible).map((o) => o.name))
  const orphans = value.filter((t) => !names.includes(t))
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
          {[...names, ...orphans].map((name) => {
            const on = value.includes(name)
            const orphan = !names.includes(name)
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
                        : shown.has(name)
                          ? 'cursor-pointer border-violet-300 hover:bg-violet-50/60'
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

      {shown.size > 0 && (
        <p className="mt-2 text-[11px] leading-relaxed text-neutral-500">
          <span className="mr-1 inline-block size-2 rounded-sm border border-violet-400 align-middle" />
          보라 테두리는 탐색 메뉴에 나오는 분야입니다. 숨긴 분야도 고를 수 있고 프로필에 표시됩니다.
        </p>
      )}

      {orphans.length > 0 && (
        <p className="mt-2 text-[11px] leading-relaxed text-amber-700">
          노란 항목은 설정 목록에 없는 분야입니다. 공개 화면에 나오지 않습니다.
        </p>
      )}
    </div>
  )
}
