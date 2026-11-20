'use client'

import { useState } from 'react'
import { inviteUrl } from '@/lib/invite-link'

/* 내 초대 링크 — 디자이너가 직접 고객에게 건넨다(0006_invite_link.sql).
   이 링크로 들어온 고객의 의뢰는 다른 디자이너에게 넘기지 않고, 본계약이 되면 섭외 보너스가 붙는다. */
export function InviteLinkRow({ code }: { code?: string }) {
  const [copied, setCopied] = useState(false)
  const url = code ? inviteUrl(code) : null

  const copy = () => {
    if (!url) return
    navigator.clipboard.writeText(url).then(
      () => {
        setCopied(true)
        window.setTimeout(() => setCopied(false), 1500)
      },
      () => setCopied(false),
    )
  }

  return (
    <section>
      <h3 className="text-sm font-semibold">내 초대 링크</h3>
      <p className="mt-1 text-xs text-neutral-500">
        이 링크로 들어온 고객의 의뢰는 바로 나에게 전달되고, 본계약으로 이어지면 섭외 보너스를 드립니다.
      </p>
      {url ? (
        <div className="mt-2.5 flex items-center gap-2 rounded-lg bg-neutral-50 px-3 py-2 ring-1 ring-neutral-200">
          <code className="min-w-0 flex-1 truncate text-xs text-neutral-700">{url}</code>
          <button
            type="button"
            onClick={copy}
            className="shrink-0 rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-xs font-medium transition hover:bg-neutral-100"
          >
            {copied ? '복사됨' : '복사'}
          </button>
        </div>
      ) : (
        <p className="mt-2.5 rounded-lg border border-dashed border-neutral-300 px-3 py-2.5 text-xs text-neutral-500">
          초대 링크를 준비 중입니다. 관리자에게 0006_invite_link.sql 적용을 요청해 주세요.
        </p>
      )}
    </section>
  )
}
