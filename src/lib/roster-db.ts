import 'server-only'
import { headers } from 'next/headers'
import { connection } from 'next/server'
import { supabaseAdmin } from './supabase-admin'
import { SITE_URL } from './site-url'
import { getAdminUser } from './admin-auth'
import { parseUserAgent } from './user-agent'
import { withDownloadName } from './download-name'
import {
  MISSING_FILES_MSG,
  MISSING_OPENS_MSG,
  MISSING_TABLE_MSG,
  ROSTER_FILES_BUCKET,
  linkState,
  type RosterDesignerRow,
  type RosterFileRow,
  type RosterLinkRow,
  type RosterOpenRow,
} from './roster-shape'

/* 비공개 경력 페이지 조회(0032_designer_roster.sql). RLS 로 막힌 표라 service_role 로만 닿는다. */

export function rosterUrl(token: string) {
  return `${SITE_URL}/roster/${token}`
}

/* 0032 전이면 표가 없다 — PostgREST 는 PGRST205, Postgres 는 42P01 */
export function isMissingTable(err: { code?: string; message?: string } | null | undefined) {
  if (!err) return false
  return err.code === 'PGRST205' || err.code === '42P01' || /roster_/.test(err.message ?? '')
}

/* URL 에 넣어도 안전한 난수 */
export function randomToken(bytes = 18) {
  const b = new Uint8Array(bytes)
  crypto.getRandomValues(b)
  return Buffer.from(b).toString('base64url')
}

export async function listRosterDesigners(): Promise<{ rows: RosterDesignerRow[]; error: string | null }> {
  if (!supabaseAdmin) return { rows: [], error: null }
  await connection()
  const { data, error } = await supabaseAdmin
    .from('roster_designers')
    .select('id, created_at, name, career, avatar_url, designer_id, sort_order')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(300)
  if (error) {
    console.error('[roster] 디자이너 목록 조회 실패:', error.message)
    return { rows: [], error: isMissingTable(error) ? MISSING_TABLE_MSG : '경력 페이지 디자이너를 불러오지 못했습니다.' }
  }
  return { rows: (data ?? []) as RosterDesignerRow[], error: null }
}

export async function listRosterLinks(): Promise<{ rows: RosterLinkRow[]; error: string | null }> {
  if (!supabaseAdmin) return { rows: [], error: null }
  await connection()
  const { data, error } = await supabaseAdmin
    .from('roster_links')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) {
    console.error('[roster] 링크 목록 조회 실패:', error.message)
    return { rows: [], error: isMissingTable(error) ? MISSING_TABLE_MSG : '경력 페이지 링크를 불러오지 못했습니다.' }
  }
  return { rows: (data ?? []) as RosterLinkRow[], error: null }
}

export type RosterOpen =
  | { kind: 'ok'; link: RosterLinkRow }
  | { kind: 'expired' | 'revoked'; link: RosterLinkRow }
  | { kind: 'missing' }
  | { kind: 'error'; error: string }

/* 토큰으로 링크를 찾고 지금 열 수 있는지 판단한다. 열면 연 횟수를 남긴다(실패해도 화면은 연다). */
export async function openRosterLink(token: string): Promise<RosterOpen> {
  const r = await findRosterLink(token)
  if (r.kind === 'ok') await recordOpen(r.link)
  return r
}

/* 기록 없이 확인만 — 파일 내려받기처럼 페이지를 연 뒤 이어지는 요청에 쓴다 */
export async function findRosterLink(token: string): Promise<RosterOpen> {
  if (!supabaseAdmin) return { kind: 'error', error: '서버 설정이 완료되지 않았습니다.' }
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) return { kind: 'missing' }

  const { data, error } = await supabaseAdmin.from('roster_links').select('*').eq('token', token).maybeSingle()
  if (error) {
    console.error('[roster] 링크 조회 실패:', error.message)
    return { kind: 'error', error: isMissingTable(error) ? MISSING_TABLE_MSG : '링크를 확인하지 못했습니다.' }
  }
  if (!data) return { kind: 'missing' }
  const link = data as RosterLinkRow

  const state = linkState(link)
  if (state !== 'live') return { kind: state, link }
  return { kind: 'ok', link }
}

/* 디자이너별 포트폴리오 파일(0035). 0035 전이면 빈 목록과 안내 문구 */
export async function listRosterFiles(
  designerIds: string[],
): Promise<{ byDesigner: Map<string, RosterFileRow[]>; error: string | null }> {
  const byDesigner = new Map<string, RosterFileRow[]>()
  if (!supabaseAdmin || designerIds.length === 0) return { byDesigner, error: null }

  const { data, error } = await supabaseAdmin
    .from('roster_designer_files')
    .select('id, designer_id, path, name, size, sort_order')
    .in('designer_id', designerIds)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) {
    if (isMissingTable(error)) return { byDesigner, error: MISSING_FILES_MSG }
    console.error('[roster] 파일 목록 조회 실패:', error.message)
    return { byDesigner, error: '포트폴리오 파일 목록을 불러오지 못했습니다.' }
  }
  for (const row of (data ?? []) as RosterFileRow[]) {
    const list = byDesigner.get(row.designer_id) ?? []
    list.push(row)
    byDesigner.set(row.designer_id, list)
  }
  return { byDesigner, error: null }
}

/* 파일 한 개를 내려받을 1분짜리 서명 주소 — 원래 이름으로 받게 한다 */
export async function signRosterFile(file: Pick<RosterFileRow, 'path' | 'name'>): Promise<string | null> {
  if (!supabaseAdmin) return null
  const { data, error } = await supabaseAdmin.storage.from(ROSTER_FILES_BUCKET).createSignedUrl(file.path, 60)
  if (error || !data) {
    console.error('[roster] 파일 서명 실패:', file.path, error?.message)
    return null
  }
  return withDownloadName(data.signedUrl, file.name)
}

/* 링크 페이지 미리보기용 서명 주소 — 내려받기 지정 없이.
   PDF·이미지는 화면이 곧바로 받아 그리므로 1분이면 된다. 영상은 재생하는 동안 조금씩
   이어 받으므로(Range 요청) 10분을 준다. */
export async function previewRosterFile(
  file: Pick<RosterFileRow, 'path'>,
  kind: 'pdf' | 'image' | 'video',
): Promise<string | null> {
  if (!supabaseAdmin) return null
  const ttl = kind === 'video' ? 600 : 60
  const { data, error } = await supabaseAdmin.storage.from(ROSTER_FILES_BUCKET).createSignedUrl(file.path, ttl)
  if (error || !data) {
    console.error('[roster] 미리보기 서명 실패:', file.path, error?.message)
    return null
  }
  return data.signedUrl
}

export async function getRosterFile(id: string): Promise<RosterFileRow | null> {
  if (!supabaseAdmin || !/^[0-9a-f-]{36}$/i.test(id)) return null
  const { data, error } = await supabaseAdmin
    .from('roster_designer_files')
    .select('id, designer_id, path, name, size, sort_order')
    .eq('id', id)
    .maybeSingle()
  if (error) console.error('[roster] 파일 조회 실패:', error.message)
  return (data as RosterFileRow | null) ?? null
}

/* 연 사람의 IP·브라우저·OS 를 남긴다. 기록에 실패해도 페이지는 연다.

   - 어드민이 관리 화면의 '열기'로 확인한 것은 남기지 않는다 — 받은 사람의 열람과 섞인다.
   - 카카오톡·슬랙의 링크 미리보기는 봇으로 따로 적고, 사람이 연 횟수(open_count)에는 넣지 않는다.
     메신저에 링크를 붙이기만 해도 미리보기가 한 번 열기 때문이다. */
async function recordOpen(link: RosterLinkRow) {
  if (!supabaseAdmin) return
  const db = supabaseAdmin

  if (await getAdminUser().catch(() => null)) return

  const h = await headers()
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || null
  const ua = h.get('user-agent')?.slice(0, 500) ?? null
  const agent = parseUserAgent(ua)

  const { error: logErr } = await db.from('roster_link_opens').insert({
    link_id: link.id,
    ip,
    user_agent: ua,
    browser: agent.browser,
    os: agent.os,
    device: agent.device,
    is_bot: agent.isBot,
  })
  /* 0033 전이면 표가 없다 — 횟수만이라도 아래에서 센다 */
  if (logErr && !isMissingTable(logErr)) console.error('[roster] 열람 상세 기록 실패:', logErr.message)

  if (agent.isBot) return
  const { error: upErr } = await db
    .from('roster_links')
    .update({ open_count: link.open_count + 1, last_opened_at: new Date().toISOString() })
    .eq('id', link.id)
  if (upErr) console.error('[roster] 열람 횟수 기록 실패:', upErr.message)
}

/* 관리 화면에 붙일 열람 기록 — 링크마다 최근 것부터. 0033 전이면 빈 목록과 안내 문구 */
export async function listRosterOpens(
  linkIds: string[],
): Promise<{ byLink: Map<string, RosterOpenRow[]>; error: string | null }> {
  const byLink = new Map<string, RosterOpenRow[]>()
  if (!supabaseAdmin || linkIds.length === 0) return { byLink, error: null }

  const { data, error } = await supabaseAdmin
    .from('roster_link_opens')
    .select('id, link_id, opened_at, ip, user_agent, browser, os, device, is_bot')
    .in('link_id', linkIds)
    .order('opened_at', { ascending: false })
    .limit(3000)
  if (error) {
    if (isMissingTable(error)) return { byLink, error: MISSING_OPENS_MSG }
    console.error('[roster] 열람 기록 조회 실패:', error.message)
    return { byLink, error: '열람 기록을 불러오지 못했습니다.' }
  }
  for (const row of (data ?? []) as RosterOpenRow[]) {
    const list = byLink.get(row.link_id) ?? []
    list.push(row)
    byLink.set(row.link_id, list)
  }
  return { byLink, error: null }
}

/* 공개 상세(/designers/{id})가 실제로 열리는 디자이너만 — 숨긴 계정·비공개 프로필은 404 가 난다.
   public-designers.ts 의 getPublicDesigner 와 같은 조건이다. */
export async function publicDesignerIds(ids: string[]): Promise<Set<string>> {
  if (!supabaseAdmin || ids.length === 0) return new Set()
  const { data, error } = await supabaseAdmin
    .from('designers')
    .select('id')
    .in('id', ids)
    .eq('visible', true)
    .eq('profile_public', true)
  if (error) {
    console.error('[roster] 공개 디자이너 확인 실패:', error.message)
    return new Set()
  }
  return new Set((data ?? []).map((d) => d.id as string))
}
