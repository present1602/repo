/* 포트폴리오 작업에 붙이는 이동 링크(0025_work_link.sql).

   화면(입력 칸)과 서버 액션이 같이 쓴다 — 한쪽만 고치면 입력은 받아 놓고
   서버가 거절하거나, 거르지 않은 값이 저장된다(youtube.ts 와 같은 방침).

   http(s) 만 받는다. javascript: 같은 주소가 링크의 href 에 그대로 박히면
   누른 사람의 화면에서 그 코드가 돈다 — DB 도 같은 모양을 제약으로 막는다. */

/* 0025 의 check 제약과 같은 길이 — 함께 고쳐야 한다 */
export const MAX_LINK_URL = 500

/* 주소를 받아들일 수 있는 모양으로 다듬는다 — 못 읽으면 null.

   'soom.it/work' 처럼 앞을 빼고 적는 사람이 많아 https:// 를 붙여 준다
   (popup-form.tsx 의 normalizeHref 와 같은 배려).

   빈 문자열은 null 이다 — "링크 없음"과 "주소가 틀렸다"를 부르는 쪽이
   가려야 하므로, 비었는지는 부르는 쪽에서 먼저 본다. */
export function workLinkUrl(input: string): string | null {
  const s = input.trim()
  if (!s || /\s/.test(s)) return null

  /* 사이트 안 경로(/…)는 받지 않는다 — 바깥 사이트로 보내는 버튼이다 */
  const withScheme = /^https?:\/\//i.test(s)
    ? s
    : /^[a-z][a-z0-9+.-]*:/i.test(s)
      ? /* http(s) 가 아닌 다른 스킴(javascript:, data: …)은 거절한다 */
        ''
      : `https://${s}`

  if (!withScheme) return null
  if (withScheme.length > MAX_LINK_URL) return null

  /* 호스트가 말이 되는지까지 본다 — 'https://' 만 적어도 통과하지 않게 */
  try {
    const u = new URL(withScheme)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    if (!u.hostname.includes('.')) return null
    return u.toString()
  } catch {
    return null
  }
}

/* 주소를 잘못 적었을 때 보여줄 말 — 스튜디오와 어드민이 같은 말을 쓴다 */
export const BAD_LINK = '주소를 확인해 주세요. 예: https://example.com'

/* 허용되지 않은 디자이너가 링크를 보냈을 때.

   화면에는 칸이 없으므로 정상적으로 쓰면 볼 일이 없는 말이다 — 액션을
   직접 부른 경우에만 닿는다. 그래도 "왜 안 되는지"를 적어 둔다. */
export const LINK_NOT_ALLOWED = '이 계정은 포트폴리오 링크를 쓸 수 없습니다. 관리자에게 문의해 주세요.'

/* 폼에서 링크 주소를 읽는다 — 스튜디오·어드민 액션이 같이 쓴다.

   readVideoId(youtube.ts)와 같은 셋을 가린다. 키가 없으면 undefined
   ("링크 칸을 다루지 않는 호출"), 비워 보냈으면 null("링크 없음" — 붙였던
   것을 떼는 경우), 주소를 읽지 못하면 false(거절).

   떼는 것과 다루지 않는 것을 섞으면, 링크 칸이 없는 화면(허용되지 않은
   디자이너)에서 저장할 때마다 붙여 둔 링크가 조용히 사라진다. */
export function readLinkUrl(form: {
  get(key: string): unknown
}): string | null | undefined | false {
  const raw = form.get('linkUrl')
  if (raw == null) return undefined
  const s = String(raw).trim()
  if (!s) return null
  return workLinkUrl(s) ?? false
}

/* 버튼에 보일 짧은 주소 — 'https://www.' 를 떼고 뒤 슬래시도 뗀다.
   지금은 버튼 글이 고정이라 쓰지 않지만, 주소를 함께 보일 때를 위해 둔다. */
export function linkLabel(url: string): string {
  return url.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/+$/, '')
}
