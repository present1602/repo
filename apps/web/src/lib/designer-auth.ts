import 'server-only'
import { cookies } from 'next/headers'
import { SignJWT, jwtVerify } from 'jose'
import { hashPassword, verifyPassword } from './password'
import { supabaseAdmin } from './supabase-admin'
import { getDesignerByEmail, type DesignerRow } from './designers-db'

/* 디자이너 로그인은 구글(Supabase Auth)을 쓰지 않는다.
   이메일 + 비밀번호를 받아 우리가 직접 확인하고, 서명한 쿠키로 세션을 유지한다. */

const COOKIE = 'soom_designer'
const MAX_AGE = 60 * 60 * 24 * 14 // 2주

/* 세션 서명 키. 전용 키가 없으면 service_role 키에서 파생시킨다 —
   그 키는 이미 서버 전용이고 유출되면 어차피 DB가 열리므로 추가 위험이 없다. */
function secret(): Uint8Array {
  const raw =
    process.env.DESIGNER_SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  if (!raw) throw new Error('세션 서명 키가 없습니다.')
  return new TextEncoder().encode(raw)
}

export type DesignerSession = { id: string; email: string }

export async function createSession(d: DesignerRow) {
  const token = await new SignJWT({ email: d.email })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(d.id)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret())

  const jar = await cookies()
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: MAX_AGE,
  })
}

export async function destroySession() {
  const jar = await cookies()
  jar.delete(COOKIE)
}

/* 쿠키의 서명만 확인한다 — DB까지 보려면 getDesignerUser() 를 쓴다 */
export async function readSession(): Promise<DesignerSession | null> {
  try {
    const jar = await cookies()
    const token = jar.get(COOKIE)?.value
    if (!token) return null

    const { payload } = await jwtVerify(token, secret())
    if (!payload.sub) return null

    return { id: payload.sub, email: String(payload.email ?? '') }
  } catch {
    /* 만료·위조·키 없음 — 모두 로그인 안 된 것으로 본다 */
    return null
  }
}

/* 로그인한 디자이너의 현재 정보.
   세션이 남아 있어도 계정이 지워졌거나 숨겨졌으면 null. */
export async function getDesignerUser(): Promise<DesignerRow | null> {
  const session = await readSession()
  if (!session || !supabaseAdmin) return null

  const { data, error } = await supabaseAdmin
    .from('designers')
    .select('*')
    .eq('id', session.id)
    .maybeSingle()

  if (error || !data) return null

  const d = data as DesignerRow
  if (!d.visible) return null
  return d
}

/* 비밀번호 해싱·임시 비밀번호는 password.ts 에 있다 — bcryptjs 를 페이지 그래프에
   끌어들이지 않기 위해 떼어두었다. */

/* 로그인 시도 — 성공하면 세션을 만들고 마지막 로그인 시각을 남긴다 */
export async function signIn(
  email: string,
  password: string,
): Promise<{ ok: true; designer: DesignerRow } | { ok: false; error: string }> {
  const d = await getDesignerByEmail(email)

  /* 계정이 없을 때와 비밀번호가 틀릴 때의 메시지를 같게 둔다 —
     다르면 어떤 이메일이 등록돼 있는지 확인하는 통로가 된다. */
  const FAIL = '이메일 또는 비밀번호가 올바르지 않습니다.'

  if (!d || !verifyPassword(password, d.password_hash ?? null)) {
    return { ok: false, error: FAIL }
  }
  if (!d.visible) {
    return { ok: false, error: '비활성화된 계정입니다. 관리자에게 문의해 주세요.' }
  }

  await createSession(d)

  if (supabaseAdmin) {
    /* 마지막 시각은 designers 에 덮어쓰고, 횟수를 세기 위해 이력도 한 줄 남긴다.
       둘 중 하나가 실패해도 로그인은 이미 성공한 것으로 둔다 —
       기록 때문에 사용자를 막지 않는다. */
    await Promise.all([
      supabaseAdmin
        .from('designers')
        .update({ last_login_at: new Date().toISOString() })
        .eq('id', d.id),
      supabaseAdmin.from('designer_logins').insert({ designer_id: d.id }),
    ])
  }

  return { ok: true, designer: d }
}

/* 비밀번호 변경 — 바꾸는 순간 임시 비밀번호를 지워 어드민도 볼 수 없게 한다 */
export async function changePassword(
  id: string,
  current: string,
  next: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!supabaseAdmin) return { ok: false, error: '서버 설정이 완료되지 않았습니다.' }
  if (next.length < 8) return { ok: false, error: '새 비밀번호는 8자 이상이어야 합니다.' }

  const { data } = await supabaseAdmin
    .from('designers')
    .select('password_hash')
    .eq('id', id)
    .maybeSingle()

  if (!data) return { ok: false, error: '계정을 찾을 수 없습니다.' }
  if (!verifyPassword(current, (data as { password_hash: string | null }).password_hash)) {
    return { ok: false, error: '현재 비밀번호가 올바르지 않습니다.' }
  }

  const { error } = await supabaseAdmin
    .from('designers')
    .update({
      password_hash: hashPassword(next),
      temp_password: null,
      password_changed_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) {
    console.error('[designers] 비밀번호 변경 실패:', error.message)
    return { ok: false, error: '변경에 실패했습니다.' }
  }
  return { ok: true }
}
