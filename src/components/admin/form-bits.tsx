/* 어드민 폼이 공유하는 조각 — 등록·수정 화면이 같은 모양을 쓴다 */

export const input =
  'h-9 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm outline-none ring-indigo-500 focus:ring-2'

export const ghostButton =
  'rounded-md border border-neutral-300 px-2.5 py-1.5 text-xs font-medium text-neutral-700 transition hover:bg-neutral-100 disabled:opacity-50'

export function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string
  hint?: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-neutral-600">
        {label}
        {required && <span className="text-red-500"> *</span>}
        {hint && <span className="ml-1 font-normal text-neutral-400">({hint})</span>}
      </span>
      {children}
    </label>
  )
}
