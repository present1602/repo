import 'server-only'
import { connection } from 'next/server'
import { supabaseAdmin } from './supabase-admin'
import {
  CODE_MAX,
  CODE_MIN,
  OPEN_STATUSES,
  isOpen,
  normalizeCode,
  type InviteRow,
  type InviteWithUser,
} from './invite-shape'

/* 초대코드 조회·확인(024_designer_invites.sql).

   RLS 로 전부 막아 둔 테이블이라 service_role 로만 닿는다. */

type Db = NonNullable<typeof supabaseAdmin>

/* 기간이 지난 사용 가능 코드를 만료로 돌린다.
   배치를 두지 않고 어드민 목록을 열 때 정리한다 — 가입 시도 때는
   그 코드 하나만 따로 바꾼다(checkInvite). */
async function expireOverdue(db: Db, nowIso: string) {
  const { error } = await db
    .from('designer_invites')
    .update({ status: 'expired', status_at: nowIso })
    .in('status', OPEN_STATUSES)
    .lte('expires_at', nowIso)
  if (error) console.error('[invite] 만료 처리 실패:', error.message)
}

export async function listInvites(): Promise<InviteWithUser[]> {
  if (!supabaseAdmin) return []
  const db = supabaseAdmin

  await connection()
  await expireOverdue(db, new Date().toISOString())

  const { data, error } = await db
    .from('designer_invites')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(300)

  if (error) {
    /* 024 전이면 테이블이 없다 — 화면은 비우고 넘어간다 */
    console.error('[invite] 목록 조회 실패:', error.message)
    return []
  }
  const rows = (data ?? []) as InviteRow[]

  /* 가입자 이름 — 가입 때는 이름을 받지 않으므로 디자이너가 프로필에
     적은 지금 이름을 붙인다. 아직 안 적었으면 null. */
  const ids = rows.flatMap((r) => (r.used_by ? [r.used_by] : []))
  const names = new Map<string, string | null>()
  if (ids.length > 0) {
    const { data: ds } = await db.from('designers').select('id, name').in('id', ids)
    for (const d of ds ?? []) names.set(d.id as string, (d.name as string | null) ?? null)
  }

  return rows.map((r) => ({ ...r, used_name: r.used_by ? (names.get(r.used_by) ?? null) : null }))
}

/* 가입에 쓸 수 있는 코드인지. 기간이 지난 사용 가능·인증함 코드는 이 자리에서 만료로 바꾼다.
   transient 는 코드 탓이 아닌 실패(조회 오류) — 틀린 횟수에 세지 않는다. */
export async function checkInvite(
  db: Db,
  raw: string,
): Promise<{ ok: true; invite: InviteRow } | { ok: false; error: string; transient?: true }> {
  const code = normalizeCode(raw)
  if (code.length < CODE_MIN || code.length > CODE_MAX) return { ok: false, error: '초대코드를 확인해 주세요.' }

  const { data, error } = await db.from('designer_invites').select('*').eq('code', code).maybeSingle()
  if (error) {
    console.error('[invite] 코드 조회 실패:', error.message)
    return { ok: false, error: '초대코드를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.', transient: true }
  }
  const invite = data as InviteRow | null
  if (!invite) return { ok: false, error: '초대코드가 올바르지 않습니다.' }

  if (isOpen(invite.status) && Date.parse(invite.expires_at) <= Date.now()) {
    await db
      .from('designer_invites')
      .update({ status: 'expired', status_at: new Date().toISOString() })
      .eq('id', invite.id)
      .in('status', OPEN_STATUSES)
    return { ok: false, error: '기간이 지난 초대코드입니다. 관리자에게 새 코드를 요청해 주세요.' }
  }

  if (invite.status === 'used') return { ok: false, error: '이미 사용된 초대코드입니다.' }
  if (invite.status === 'expired') return { ok: false, error: '기간이 지난 초대코드입니다. 관리자에게 새 코드를 요청해 주세요.' }
  if (invite.status === 'canceled') return { ok: false, error: '취소된 초대코드입니다.' }

  return { ok: true, invite }
}

/* 자동 발행 — 사람이 받아 적기 쉬운 8자리. 헷갈리는 글자(O/0, I/1, L)를 뺐다 */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

export function generateInviteCode(): string {
  const bytes = new Uint8Array(8)
  crypto.getRandomValues(bytes)
  let out = ''
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length]
  return out
}
