'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useActionTransition } from '@/lib/use-action-transition'
import { pricePairError } from '@/lib/plans'

export function PricePairEditor({ label, price, originalPrice, disabled, onSave }: {
  label: string
  price: number | null
  originalPrice?: number | null
  disabled?: boolean
  onSave: (price: number | null, original: number | null) => Promise<{ ok: true } | { ok: false; error: string }>
}) {
  const [sale, setSale] = useState(price == null ? '' : String(price))
  const [original, setOriginal] = useState(originalPrice == null ? '' : String(originalPrice))
  const [message, setMessage] = useState<{ error: boolean; text: string } | null>(null)
  const [pending, start] = useActionTransition()
  const router = useRouter()
  const next = sale === '' ? null : Number(sale)
  const before = original === '' ? null : Number(original)
  const invalid = pricePairError(next, before)
  const dirty = next !== price || before !== (originalPrice ?? null)
  return (
    <div className="min-w-0 flex-1 basis-full">
      <div className="flex flex-wrap items-end gap-2">
        {(['sale', 'original'] as const).map((field) => (
          <label key={field} className="min-w-0 text-[11px] text-neutral-600">
            {field === 'sale' ? '판매가 (시작가)' : '원래 가격 (할인 전)'}
            <input type="number" inputMode="numeric" min={10000} max={100000000} step={1}
              aria-label={`${label} ${field === 'sale' ? '판매가' : '원래 가격'}`}
              value={field === 'sale' ? sale : original}
              onChange={(e) => { (field === 'sale' ? setSale : setOriginal)(e.target.value); setMessage(null) }}
              disabled={disabled || pending} placeholder={field === 'sale' ? '기존 금액 사용' : '선택 입력'}
              className="mt-1 block h-8 w-36 max-w-full rounded-md border border-neutral-200 bg-white px-2 text-xs outline-none focus:ring-2 focus:ring-violet-500 disabled:opacity-50" />
          </label>
        ))}
        <button type="button" disabled={disabled || pending || !dirty || !!invalid}
          onClick={() => start(async () => {
            setMessage(null)
            const result = await onSave(next, before)
            if (!result.ok) { setMessage({ error: true, text: result.error }); return }
            setMessage({ error: false, text: `${label} 가격을 저장했습니다.` })
            router.refresh()
          })}
          className="h-8 rounded-md bg-neutral-900 px-3 text-xs font-semibold text-white disabled:opacity-40">
          {pending ? '저장 중…' : '가격 저장'}
        </button>
      </div>
      {invalid && <p role="alert" className="mt-1 text-xs text-red-600">{invalid}</p>}
      {message && <p role={message.error ? 'alert' : 'status'} className={`mt-1 text-xs ${message.error ? 'text-red-600' : 'text-violet-700'}`}>{message.text}</p>}
    </div>
  )
}
