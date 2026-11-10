import 'server-only'

/* 챗봇 호출 횟수 제한.

   공개로 켜면 로그인 없이 누구나 치는 입구가 된다 — 막지 않으면 모델 청구서로
   공격당한다. 서버 메모리에 세어 둔다: Vercel 은 인스턴스가 여러 개라 완벽한
   상한은 아니지만, 한 사람이 창을 잡고 수백 번 보내는 흔한 사고는 막는다.

   정확한 상한이 필요해지면 DB 나 Upstash 로 옮긴다 — 그때까지 표를 하나 더
   늘리지 않는다(쓰기가 대화마다 두 번씩 늘어난다). */

type Bucket = { count: number; resetAt: number }

const HOUR = 60 * 60 * 1000

/* ip → 이번 시간에 보낸 횟수 */
const byIp = new Map<string, Bucket>()
/* 대화 묶음 → 그 대화에서 주고받은 횟수. 창을 새로 열면 새 묶음이라 다시 센다 */
const bySession = new Map<string, Bucket>()

/* 한 ip 가 한 시간에 보낼 수 있는 횟수 */
const IP_PER_HOUR = 60

/* 지난 시간의 자취를 치운다 — Map 이 끝없이 자라지 않게.
   대화가 들어올 때만 돌린다(타이머를 두면 서버리스에서 깨어 있는 값만 먹는다). */
function sweep(map: Map<string, Bucket>, now: number) {
  if (map.size < 5000) return
  for (const [k, b] of map) if (b.resetAt <= now) map.delete(k)
}

function hit(map: Map<string, Bucket>, key: string, limit: number, windowMs: number): boolean {
  const now = Date.now()
  sweep(map, now)

  const cur = map.get(key)
  if (!cur || cur.resetAt <= now) {
    map.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }
  if (cur.count >= limit) return false
  cur.count += 1
  return true
}

/* ip 는 프록시가 적어 준다. 없으면 한 덩이로 묶어 센다 —
   그래도 전체 상한으로는 동작한다(막힌 쪽이 안전하다). */
export function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for')
  return fwd?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown'
}

/* 이 ip 가 더 보낼 수 있는지 */
export function allowIp(ip: string): boolean {
  return hit(byIp, ip, IP_PER_HOUR, HOUR)
}

/* 이 대화가 더 이어질 수 있는지 — 세션 상한은 대화가 끝날 때까지 유지돼야 하므로
   창(window)을 길게 둔다(6시간). */
export function allowSession(sessionId: string, maxTurns: number): boolean {
  return hit(bySession, sessionId, maxTurns, 6 * HOUR)
}
