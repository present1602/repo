/* 이름이 비어 있는 동안 쓸 표시명 — 이메일 앞부분.
   화면마다 다르게 처리하면 같은 계정이 서로 다른 이름으로 보인다.
   서버·클라이언트 양쪽에서 쓰므로 server-only 모듈에 두지 않는다. */
export function displayName(d: { name: string | null; email: string }): string {
  return d.name?.trim() || d.email.split('@')[0]
}

/* 공개 화면용 — 이메일을 모르는 자리에서 쓴다.

   탐색·상세는 로그인 없이 보이므로 이메일을 내려보내지 않는다.
   이름이 비어 있으면 이메일 앞부분조차 쓸 수 없으니 '이름 미입력' 대신
   중립적인 표시를 쓴다 — 공개 화면에 디버그용 문구가 보이면 안 된다. */
export function displayNameOf(d: { name: string | null }): string {
  const name = d.name?.trim()
  return name ? maskName(name) : '이름 미입력 디자이너'
}

/* ─────────── 실명 규칙 ───────────

   디자이너 이름은 실명(한글 2~6자)으로 받고, 공개 화면에서는 가운데를 가린다.
   DB 에는 제약을 걸지 않는다 — 규칙 이전에 들어온 이름(영문·닉네임)도
   그대로 남아 있어야 해서, 입력하는 화면에서만 막는다. */

export const NAME_MAX = 6

export function nameError(name: string): string | null {
  const n = name.trim()
  if (!n) return null
  return /^[가-힣]{2,6}$/.test(n) ? null : '이름은 한글 실명 2~6자로 입력해 주세요.'
}

/* 김민 → 김*, 김민연 → 김*연, 남궁민연 → 남*연.
   가운데가 몇 글자든 * 하나로 줄인다 — 별 개수로 이름 길이가 드러나지 않게.
   이미 가린 이름을 다시 넣어도 모양이 그대로다(김*연 → 김*연). */
export function maskName(name: string): string {
  const chars = Array.from(name.trim())
  if (chars.length <= 1) return chars.join('')
  if (chars.length === 2) return `${chars[0]}*`
  return `${chars[0]}*${chars[chars.length - 1]}`
}
