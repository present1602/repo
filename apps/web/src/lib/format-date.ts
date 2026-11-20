/* 목록에 쓰는 짧은 날짜 표기.

   클라이언트 컴포넌트가 쓰므로 server-only 모듈에 두지 않는다. */

/* 서버와 클라이언트의 표기가 갈리면 hydration 경고가 난다 —
   타임존·로케일을 고정해 양쪽이 같은 문자열을 만들게 한다. */
const fmt = new Intl.DateTimeFormat('ko-KR', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  timeZone: 'Asia/Seoul',
})

/* 2026. 10. 22. — 값이 없으면 '—' */
export function shortDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return '—'
  return fmt.format(new Date(t))
}

/* 시각까지 — 같은 날 여러 건이 들어오는 목록(지원서 등)에 쓴다 */
const fmtTime = new Intl.DateTimeFormat('ko-KR', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  timeZone: 'Asia/Seoul',
})

/* 2026. 10. 27. 23:35 — 값이 없으면 '—' */
export function dateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return '—'
  return fmtTime.format(new Date(t))
}

/* 오늘 / 3일 전 / 그보다 오래되면 날짜.
   "마지막 로그인"처럼 최근 여부가 중요한 값에 쓴다. */
export function relativeDay(iso: string | null | undefined): string {
  if (!iso) return '—'
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return '—'

  const days = Math.floor((Date.now() - t) / 86_400_000)
  if (days < 0) return shortDate(iso)
  if (days === 0) return '오늘'
  if (days === 1) return '어제'
  if (days < 30) return `${days}일 전`
  return shortDate(iso)
}
