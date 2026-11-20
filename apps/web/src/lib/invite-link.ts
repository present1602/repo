/* 디자이너 초대 링크(0006_invite_link.sql).

   디자이너가 직접 데려온 고객을 가린다 — 링크로 들어온 고객이 그 디자이너에게 의뢰하면
   어드민은 다른 디자이너에게 넘기지 않고, 본계약이 되면 섭외 보너스를 준다.
   가입용 초대코드(invite-shape.ts)와는 다른 것이라 코드에서는 ref 로 부른다.

   클라이언트 컴포넌트가 쓰므로 server-only 모듈에 두지 않는다. */

export const REF_PARAM = 'ref'

const keyOf = (designerId: string) => `soom-ref:${designerId}`

/* 디자이너가 건네는 짧은 주소 — /r/{코드} 가 상세 페이지(?ref=)로 넘긴다(app/r/[code]/route.ts) */
export function inviteUrl(code: string): string {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/+$/, '')
  return `${base}/r/${encodeURIComponent(code)}`
}

/* 코드 모양 — 0006 은 8자리를 만든다. 넉넉히 12자까지 받는다 */
export const isRefCode = (v: string) => /^[a-z0-9]{4,12}$/.test(v)

/* 링크의 코드를 그 방문(탭) 동안만 남긴다. 맞는 코드인지는 의뢰를 받을 때 서버가 본다.

   초대로 치는 것은 링크로 연 그 방문 안에서 의뢰했을 때뿐이다 — 탭을 닫았다가
   나중에 상세 페이지로 직접 들어와 의뢰하면 그 디자이너를 지정한 의뢰다.
   예전에는 localStorage 에 30일 남겨 두어, 한 번 링크로 들어온 브라우저의 의뢰가
   한 달 내내 초대로 잡혔다. sessionStorage 는 탭이 닫히면 사라진다. */
export function rememberRef(designerId: string, code: string) {
  try {
    sessionStorage.setItem(keyOf(designerId), code)
  } catch {
    /* 저장이 막힌 브라우저 — 초대 표시만 빠지고 의뢰는 그대로 된다 */
  }
}

/* 이 방문에서 남긴 코드 — 없으면 null */
export function recalledRef(designerId: string): string | null {
  try {
    /* 예전 방식(localStorage 30일)으로 남은 기록은 버린다 — 남겨 두면 그 브라우저의
       다음 의뢰가 계속 초대로 잡힌다 */
    localStorage.removeItem(keyOf(designerId))
    return sessionStorage.getItem(keyOf(designerId)) || null
  } catch {
    return null
  }
}
