'use server'

import { createHash, randomInt } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { createSession } from '@/lib/designer-auth'
import { hashPassword } from '@/lib/password'
import { sendSignupCode } from '@/lib/designer-mail'
import { checkInvite } from '@/lib/invites-db'
import {
  EMAIL_RE,
  MAX_INVITE_FAILS,
  OPEN_STATUSES,
  PASSWORD_MIN,
  VERIFY_CODE_LEN,
} from '@/lib/invite-shape'
import type { DesignerRow } from '@/lib/designers-db'

/* 초대 디자이너 가입(024_designer_invites.sql).

   로그인 없이 누구나 부르는 액션이라 들어온 값을 하나도 믿지 않는다.
   순서: 초대코드 인증 → 이메일 인증코드 발송 → 인증 → 가입.
   인증코드 발송부터 유효한 초대코드를 요구한다 — 아무나 이 화면으로
   남의 메일함에 메일을 보내지 못하게. */

/* locked — 이 브라우저는 초대코드를 너무 많이 틀려 더 시도할 수 없다 */
export type Result = { ok: true } | { ok: false; error: string; locked?: true }

function fail(error: string) {
  return { ok: false as const, error }
}

/* ─────────── 초대코드 틀린 횟수 ───────────

   브라우저 쿠키로 센다. 쿠키를 지우면 다시 셀 수 있지만, 코드를 마구 넣어
   맞혀 보는 것을 늦추기에는 충분하다 — 코드가 맞아도 이메일 인증을
   한 번 더 거쳐야 가입된다. 맞혀도 횟수를 되돌리지 않는다. */

const FAIL_COOKIE = 'soom_invite_fails'
const LOCKED_MSG = '초대코드를 여러 번 잘못 입력해 이 브라우저에서는 더 시도할 수 없습니다. 관리자에게 문의해 주세요.'

async function inviteFails() {
  const jar = await cookies()
  return Number(jar.get(FAIL_COOKIE)?.value ?? 0) || 0
}

export async function isInviteLocked() {
  return (await inviteFails()) >= MAX_INVITE_FAILS
}

/* 잠금 여부를 먼저 보고, 틀리면 횟수를 하나 올린다 */
async function checkInviteCounted(raw: string) {
  const fails = await inviteFails()
  if (fails >= MAX_INVITE_FAILS) return { ok: false as const, error: LOCKED_MSG, locked: true as const }

  const r = await checkInvite(db(), raw)
  if (r.ok || r.transient) return r

  const next = fails + 1
  const jar = await cookies()
  jar.set(FAIL_COOKIE, String(next), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/studio',
    maxAge: 60 * 60 * 24 * 30,
  })
  if (next >= MAX_INVITE_FAILS) return { ok: false as const, error: LOCKED_MSG, locked: true as const }
  return { ok: false as const, error: `${r.error} (${MAX_INVITE_FAILS - next}번 남음)` }
}

const CODE_TTL_MIN = 10
/* 인증을 마친 뒤 가입 버튼을 누르기까지의 여유 */
const VERIFIED_TTL_MIN = 30
const RESEND_COOLDOWN_SEC = 60
const MAX_ATTEMPTS = 5

function db() {
  if (!supabaseAdmin) throw new Error('서버 설정이 완료되지 않았습니다.')
  return supabaseAdmin
}

function hashCode(email: string, code: string) {
  return createHash('sha256').update(`${email}:${code}`).digest('hex')
}

function cleanEmail(raw: string) {
  return String(raw ?? '').trim().toLowerCase()
}

/* ─────────── 0. 초대코드 인증 ───────────

   맞으면 코드를 '인증함'으로 표시한다 — 어드민이 "누군가 이 코드로 인증까지
   했다" 를 볼 수 있게. 가입 전이라 코드는 계속 쓸 수 있다. */

export async function verifyInviteCode(raw: string): Promise<Result> {
  const r = await checkInviteCounted(raw)
  if (!r.ok) return r

  if (r.invite.status === 'active') {
    const now = new Date().toISOString()
    const { error } = await db()
      .from('designer_invites')
      .update({ status: 'verified', status_at: now, verified_at: now })
      .eq('id', r.invite.id)
      .eq('status', 'active')
    /* 표시를 못 남겨도 가입은 막지 않는다 — 026 전이면 여기서 실패한다 */
    if (error) console.error('[signup] 인증함 표시 실패:', error.message)
  }
  return { ok: true }
}

async function emailTaken(email: string) {
  const { data } = await db().from('designers').select('id').eq('email', email).maybeSingle()
  return Boolean(data)
}

/* ─────────── 1. 인증코드 받기 ─────────── */

export async function requestSignupCode(rawEmail: string, inviteCode: string): Promise<Result> {
  const email = cleanEmail(rawEmail)
  if (!EMAIL_RE.test(email) || email.length > 200) return fail('이메일 주소를 확인해 주세요.')

  const invite = await checkInviteCounted(inviteCode)
  if (!invite.ok) return invite
  if (await emailTaken(email)) return fail('이미 가입된 이메일입니다. 로그인해 주세요.')

  /* 연달아 누르면 메일이 쌓인다 — 마지막 발송 뒤 잠깐은 막는다 */
  const { data: last } = await db()
    .from('email_verifications')
    .select('created_at')
    .eq('email', email)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (last) {
    const wait = RESEND_COOLDOWN_SEC - Math.floor((Date.now() - Date.parse(last.created_at as string)) / 1000)
    if (wait > 0) return fail(`${wait}초 뒤에 다시 받을 수 있습니다.`)
  }

  const code = String(randomInt(0, 10 ** VERIFY_CODE_LEN)).padStart(VERIFY_CODE_LEN, '0')
  const { data: row, error } = await db()
    .from('email_verifications')
    .insert({
      email,
      code_hash: hashCode(email, code),
      expires_at: new Date(Date.now() + CODE_TTL_MIN * 60_000).toISOString(),
    })
    .select('id')
    .single()

  if (error) {
    console.error('[signup] 인증코드 저장 실패:', error.message)
    return fail('인증코드를 만들지 못했습니다. 잠시 후 다시 시도해 주세요.')
  }

  const mail = await sendSignupCode(email, code, CODE_TTL_MIN)
  if (!mail.ok) {
    /* 안 간 코드는 지운다 — 남겨 두면 쿨다운에 걸려 바로 다시 받을 수 없다 */
    await db().from('email_verifications').delete().eq('id', row.id)
    return fail('인증 메일을 보내지 못했습니다. 이메일 주소를 확인하고 다시 시도해 주세요.')
  }
  return { ok: true }
}

/* ─────────── 2. 인증 ─────────── */

export async function verifySignupCode(rawEmail: string, rawCode: string): Promise<Result> {
  const email = cleanEmail(rawEmail)
  const code = String(rawCode ?? '').replace(/\D/g, '')
  if (code.length !== VERIFY_CODE_LEN) return fail(`인증코드 ${VERIFY_CODE_LEN}자리를 입력해 주세요.`)

  /* 가장 최근에 받은 코드만 본다 — 다시 받았으면 이전 코드는 쓸 수 없다 */
  const { data: v } = await db()
    .from('email_verifications')
    .select('id, code_hash, expires_at, attempts, verified_at, consumed_at')
    .eq('email', email)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!v || v.consumed_at) return fail('인증코드를 먼저 받아 주세요.')
  if (v.verified_at) return { ok: true }
  if (Date.parse(v.expires_at as string) <= Date.now()) return fail('인증코드가 만료됐습니다. 다시 받아 주세요.')
  if ((v.attempts as number) >= MAX_ATTEMPTS) return fail('입력 횟수를 넘었습니다. 인증코드를 다시 받아 주세요.')

  if (v.code_hash !== hashCode(email, code)) {
    await db().from('email_verifications').update({ attempts: (v.attempts as number) + 1 }).eq('id', v.id)
    const left = MAX_ATTEMPTS - (v.attempts as number) - 1
    return fail(left > 0 ? `인증코드가 맞지 않습니다. (${left}번 남음)` : '입력 횟수를 넘었습니다. 인증코드를 다시 받아 주세요.')
  }

  await db().from('email_verifications').update({ verified_at: new Date().toISOString() }).eq('id', v.id)
  return { ok: true }
}

/* ─────────── 3. 가입 ─────────── */

export type SignupInput = {
  email: string
  password: string
  passwordConfirm: string
  inviteCode: string
}

export async function signUpWithInvite(input: SignupInput): Promise<Result> {
  const email = cleanEmail(input.email)
  const password = String(input.password ?? '')

  if (!EMAIL_RE.test(email)) return fail('이메일 주소를 확인해 주세요.')
  if (password.length < PASSWORD_MIN) return fail(`비밀번호는 ${PASSWORD_MIN}자 이상이어야 합니다.`)
  if (password.length > 72) return fail('비밀번호가 너무 깁니다.')
  if (password !== input.passwordConfirm) return fail('비밀번호 확인이 일치하지 않습니다.')

  /* 이메일 인증 — 최근 인증을 마쳤고 아직 가입에 쓰지 않은 것 */
  const { data: v } = await db()
    .from('email_verifications')
    .select('id, verified_at, consumed_at')
    .eq('email', email)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (
    !v ||
    !v.verified_at ||
    v.consumed_at ||
    Date.now() - Date.parse(v.verified_at as string) > VERIFIED_TTL_MIN * 60_000
  ) {
    return fail('이메일 인증을 먼저 완료해 주세요.')
  }

  const invite = await checkInviteCounted(input.inviteCode)
  if (!invite.ok) return invite
  if (await emailTaken(email)) return fail('이미 가입된 이메일입니다. 로그인해 주세요.')

  /* 코드를 먼저 차지한다. 조건을 update 에 걸어 두 사람이 동시에 같은 코드로
     가입해도 한 명만 통과한다. */
  const now = new Date().toISOString()
  const { data: claimed, error: claimErr } = await db()
    .from('designer_invites')
    .update({ status: 'used', status_at: now, used_at: now, used_email: email })
    .eq('id', invite.invite.id)
    .in('status', OPEN_STATUSES)
    .gt('expires_at', now)
    .select('id')

  if (claimErr) {
    console.error('[signup] 초대코드 사용 처리 실패:', claimErr.message)
    return fail('가입 처리에 실패했습니다. 잠시 후 다시 시도해 주세요.')
  }
  if (!claimed || claimed.length === 0) return fail('이미 사용됐거나 만료된 초대코드입니다.')

  const { data: created, error } = await db()
    .from('designers')
    .insert({
      email,
      password_hash: hashPassword(password),
      /* 본인이 정한 비밀번호라 임시 비밀번호 단계를 건너뛴다 */
      password_changed_at: now,
      /* 이름은 스튜디오 프로필에서 본인이 한 번 정한다 */
      name: null,
      name_locked: false,
      /* 처음엔 비공개 — 이름·작업이 비어 있는 채로 탐색에 뜨지 않게.
         프로필을 채운 뒤 스튜디오의 공개 토글로 본인이 연다. */
      profile_public: false,
    })
    .select('*')
    .single()

  if (error || !created) {
    /* 계정을 못 만들었으면 코드를 돌려놓는다 — 그대로 두면 아무도 못 쓴다.
       인증함이었으면 인증함으로 */
    await db()
      .from('designer_invites')
      .update({ status: invite.invite.status, status_at: now, used_at: null, used_email: null })
      .eq('id', invite.invite.id)
    if (error?.code === '23505') return fail('이미 가입된 이메일입니다. 로그인해 주세요.')
    console.error('[signup] 계정 생성 실패:', error?.message)
    return fail('가입 처리에 실패했습니다. 잠시 후 다시 시도해 주세요.')
  }

  const designer = created as DesignerRow
  /* 뒷정리는 실패해도 가입을 되돌리지 않는다 — 계정은 이미 만들어졌다 */
  await Promise.all([
    db().from('designer_invites').update({ used_by: designer.id }).eq('id', invite.invite.id),
    db().from('email_verifications').update({ consumed_at: now }).eq('id', v.id),
  ])

  await createSession(designer)
  revalidatePath('/admin/invites')
  revalidatePath('/admin/designers')
  return { ok: true }
}
