/* 디자이너 초대 링크(0006_invite_link.sql).

   디자이너가 직접 데려온 고객을 가린다 — 링크로 들어온 고객이 그 디자이너에게 의뢰하면
   어드민은 다른 디자이너에게 넘기지 않고, 본계약이 되면 섭외 보너스를 준다.
   가입용 초대코드(invite-shape.ts)와는 다른 것이라 코드에서는 ref 로 부른다.

   클라이언트 컴포넌트가 쓰므로 server-only 모듈에 두지 않는다. */

export const REF_PARAM = 'ref'

/* 링크로 들어온 뒤 이 기간 안에 의뢰하면 초대로 친다 — 둘러보다 나갔다 다시 와도 이어지게 */
const REF_TTL_MS = 30 * 24 * 60 * 60 * 1000

const keyOf = (designerId: string) => `soom-ref:${designerId}`

/* 디자이너가 건네는 짧은 주소 — /r/{코드} 가 상세 페이지(?ref=)로 넘긴다(app/r/[code]/route.ts) */
export function inviteUrl(code: string): string {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/+$/, '')
  return `${base}/r/${encodeURIComponent(code)}`
}

/* 코드 모양 — 0006 은 8자리를 만든다. 넉넉히 12자까지 받는다 */
export const isRefCode = (v: string) => /^[a-z0-9]{4,12}$/.test(v)

/* 링크의 코드를 브라우저에 남긴다. 맞는 코드인지는 의뢰를 받을 때 서버가 본다 */
export function rememberRef(designerId: string, code: string) {
  try {
    localStorage.setItem(keyOf(designerId), JSON.stringify({ code, at: Date.now() }))
  } catch {
    /* 저장이 막힌 브라우저 — 초대 표시만 빠지고 의뢰는 그대로 된다 */
  }
}

/* 기간 안에 남긴 코드 — 없거나 지났으면 null */
export function recalledRef(designerId: string): string | null {
  try {
    const raw = localStorage.getItem(keyOf(designerId))
    if (!raw) return null
    const { code, at } = JSON.parse(raw) as { code?: unknown; at?: unknown }
    if (typeof code !== 'string' || typeof at !== 'number' || Date.now() - at > REF_TTL_MS) return null
    return code
  } catch {
    return null
  }
}
