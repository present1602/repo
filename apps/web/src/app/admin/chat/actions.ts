'use server'

import { revalidatePath } from 'next/cache'
import { getAdminUser } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import {
  MAX_INTENT_INTRO,
  MAX_INTENT_LABEL,
  MAX_KNOWLEDGE_BODY,
  MAX_KNOWLEDGE_TITLE,
} from '@/lib/chat-shape'

/* 챗봇 지식 카드와 대화 기록(0023_chat.sql).

   어드민 설정의 FAQ 와 같은 짜임이다 — 카드를 더하고, 고치고, 끄고, 차례를 바꾼다.
   다른 것은 하나뿐이다: 대화 기록에서 '답변 필요' 줄을 골라 그 질문으로
   카드를 만들고 그 줄을 내린다(addFromLog). 그게 정확도를 올리는 고리다. */

/* 서버 액션은 누구나 호출할 수 있는 엔드포인트다.
   페이지에서 막았더라도 여기서 권한을 다시 확인해야 한다. */
async function guard() {
  const user = await getAdminUser()
  if (!user) throw new Error('권한이 없습니다.')
  if (!supabaseAdmin) throw new Error('서버 설정이 완료되지 않았습니다.')
  return supabaseAdmin
}

export type Result = { ok: true } | { ok: false; error: string }

function fail(error: string) {
  return { ok: false as const, error }
}

/* 표가 없을 때는 돌릴 파일 이름을 적어 준다 — AGENTS.md 의 방침 */
function dbFail(message: string, what: string) {
  console.error(`[chat] ${what} 실패:`, message)
  if (/chat_knowledge|chat_logs/i.test(message)) {
    return fail('챗봇 표가 아직 없습니다. 0023_chat.sql 을 실행해 주세요.')
  }
  return fail(`${what}에 실패했습니다.`)
}

function refresh() {
  revalidatePath('/admin/chat')
}

/* 적은 글을 다듬고 길이를 본다 — DB check 제약과 같은 값이라
   여기서 막지 않으면 뭉뚱그린 오류만 남는다 */
function clean(title: string, body: string): { title: string; body: string } | string {
  const t = title.trim()
  if (!t) return '제목을 입력해 주세요.'
  if (t.length > MAX_KNOWLEDGE_TITLE) {
    return `제목은 ${MAX_KNOWLEDGE_TITLE}자 이내로 입력해 주세요.`
  }
  if (body.length > MAX_KNOWLEDGE_BODY) {
    return `내용은 ${MAX_KNOWLEDGE_BODY}자 이내로 입력해 주세요.`
  }
  return { title: t, body }
}

/* 맨 뒤에 붙을 차례 — 지금 가장 큰 번호 다음 */
async function nextOrder(db: NonNullable<typeof supabaseAdmin>): Promise<number> {
  const { data } = await db
    .from('chat_knowledge')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()
  return ((data?.sort_order as number | undefined) ?? -1) + 1
}

export async function addKnowledge(title: string, body: string): Promise<Result> {
  const db = await guard()

  const ok = clean(title, body)
  if (typeof ok === 'string') return fail(ok)

  const { error } = await db
    .from('chat_knowledge')
    .insert({ title: ok.title, body: ok.body, sort_order: await nextOrder(db) })

  if (error) return dbFail(error.message, '지식 추가')

  refresh()
  return { ok: true }
}

export async function updateKnowledge(id: string, title: string, body: string): Promise<Result> {
  const db = await guard()

  const ok = clean(title, body)
  if (typeof ok === 'string') return fail(ok)

  const { error } = await db
    .from('chat_knowledge')
    .update({ title: ok.title, body: ok.body, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return dbFail(error.message, '지식 저장')

  refresh()
  return { ok: true }
}

export async function setKnowledgeEnabled(id: string, enabled: boolean): Promise<Result> {
  const db = await guard()

  const { error } = await db
    .from('chat_knowledge')
    .update({ enabled, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return dbFail(error.message, '지식 켜고 끄기')

  refresh()
  return { ok: true }
}

/* 차례 — 받은 순서대로 0번부터 다시 매긴다(FAQ·분야와 같은 방침) */
export async function reorderKnowledge(ids: string[]): Promise<Result> {
  const db = await guard()

  if (ids.length === 0) return { ok: true }

  const { data: all, error: readErr } = await db.from('chat_knowledge').select('id')
  if (readErr) return dbFail(readErr.message, '차례 저장')

  const known = new Set((all ?? []).map((k) => k.id as string))
  const list = ids.filter((id) => known.has(id))

  /* 화면이 가진 목록과 DB 가 어긋나면 섣불리 쓰지 않는다 —
     빠진 줄이 0번으로 몰려 차례가 뒤엉킨다(reorderFaqs 와 같은 방침) */
  if (list.length !== known.size) {
    return fail('목록이 바뀌었습니다. 새로고침 후 다시 시도해 주세요.')
  }

  const results = await Promise.all(
    list.map((id, i) => db.from('chat_knowledge').update({ sort_order: i }).eq('id', id)),
  )

  const failed = results.find((r) => r.error)
  if (failed?.error) return dbFail(failed.error.message, '차례 저장')

  refresh()
  return { ok: true }
}

export async function deleteKnowledge(id: string): Promise<Result> {
  const db = await guard()

  const { error } = await db.from('chat_knowledge').delete().eq('id', id)
  if (error) return dbFail(error.message, '지식 삭제')

  refresh()
  return { ok: true }
}

/* ─────────── 대화 기록 ───────────

   '답변 필요' 줄을 지식으로 바꾸는 고리. 카드를 만들고 그 줄을 내린다 —
   두 일이 한 번에 끝나야 운영자가 목록을 두 번 오가지 않는다. */
export async function addKnowledgeFromLog(
  logId: string,
  title: string,
  body: string,
): Promise<Result> {
  const db = await guard()

  const added = await addKnowledge(title, body)
  if (!added.ok) return added

  /* 카드는 이미 만들어졌다 — 줄을 내리는 데 실패해도 성공으로 돌려주되
     무엇이 남았는지 알려 준다. 카드를 지워 되돌리면 적은 글을 잃는다. */
  const { error } = await db.from('chat_logs').update({ resolved: true }).eq('id', logId)
  if (error) {
    console.error('[chat] 답변 필요 내리기 실패:', error.message)
    return fail('지식은 추가했지만 목록에서 내리지 못했습니다. 새로고침 후 확인해 주세요.')
  }

  refresh()
  return { ok: true }
}

/* 지식을 만들지 않고 목록에서만 내린다 — 장난글이나 주제와 먼 질문 */
export async function resolveLog(logId: string, resolved = true): Promise<Result> {
  const db = await guard()

  const { error } = await db.from('chat_logs').update({ resolved }).eq('id', logId)
  if (error) return dbFail(error.message, '목록에서 내리기')

  refresh()
  return { ok: true }
}

/* ─────────── 시작 메뉴 ───────────

   챗봇을 열면 깔리는 단추(0027_chat_intents.sql). 지식 카드와 짜임은 같고
   다른 것은 하나다: 단추가 단추를 품는다(parent_id). 그래서 더할 때 어느
   단추 아래인지 받고, 차례도 같은 부모 안에서만 매긴다. */

function intentFail(message: string, what: string) {
  console.error(`[chat] ${what} 실패:`, message)
  if (/chat_intents/i.test(message)) {
    return fail('시작 메뉴 표가 아직 없습니다. 0027_chat_intents.sql 을 실행해 주세요.')
  }
  return fail(`${what}에 실패했습니다.`)
}

/* 적은 글을 다듬고 길이를 본다 — DB check 제약과 같은 값 */
function cleanIntent(label: string, intro: string): { label: string; intro: string } | string {
  const l = label.trim()
  if (!l) return '단추에 적을 말을 입력해 주세요.'
  if (l.length > MAX_INTENT_LABEL) {
    return `단추 글자는 ${MAX_INTENT_LABEL}자 이내로 입력해 주세요.`
  }
  if (intro.length > MAX_INTENT_INTRO) {
    return `소개 멘트는 ${MAX_INTENT_INTRO}자 이내로 입력해 주세요.`
  }
  return { label: l, intro }
}

/* 같은 부모 안에서 맨 뒤에 붙을 차례 */
async function nextIntentOrder(
  db: NonNullable<typeof supabaseAdmin>,
  parentId: string | null,
): Promise<number> {
  let q = db.from('chat_intents').select('sort_order')
  /* is(null) 과 eq 는 다른 질의다 — 섞으면 첫 단계와 자식이 한 묶음이 된다 */
  q = parentId == null ? q.is('parent_id', null) : q.eq('parent_id', parentId)

  const { data } = await q.order('sort_order', { ascending: false }).limit(1).maybeSingle()
  return ((data?.sort_order as number | undefined) ?? -1) + 1
}

export async function addIntent(
  parentId: string | null,
  label: string,
  intro: string,
): Promise<Result> {
  const db = await guard()

  const ok = cleanIntent(label, intro)
  if (typeof ok === 'string') return fail(ok)

  const { error } = await db.from('chat_intents').insert({
    parent_id: parentId,
    label: ok.label,
    intro: ok.intro,
    sort_order: await nextIntentOrder(db, parentId),
  })

  if (error) return intentFail(error.message, '단추 추가')

  refresh()
  return { ok: true }
}

export async function updateIntent(id: string, label: string, intro: string): Promise<Result> {
  const db = await guard()

  const ok = cleanIntent(label, intro)
  if (typeof ok === 'string') return fail(ok)

  const { error } = await db
    .from('chat_intents')
    .update({ label: ok.label, intro: ok.intro, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return intentFail(error.message, '단추 저장')

  refresh()
  return { ok: true }
}

export async function setIntentEnabled(id: string, enabled: boolean): Promise<Result> {
  const db = await guard()

  const { error } = await db
    .from('chat_intents')
    .update({ enabled, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return intentFail(error.message, '단추 켜고 끄기')

  refresh()
  return { ok: true }
}

/* 차례 — 한 부모 안에서만 다시 매긴다.

   받은 목록이 그 부모의 자식 전부와 맞는지 본다. 어긋나면 쓰지 않는다 —
   빠진 줄이 0번으로 몰려 차례가 뒤엉킨다(reorderKnowledge 와 같은 방침). */
export async function reorderIntents(parentId: string | null, ids: string[]): Promise<Result> {
  const db = await guard()

  if (ids.length === 0) return { ok: true }

  let q = db.from('chat_intents').select('id')
  q = parentId == null ? q.is('parent_id', null) : q.eq('parent_id', parentId)

  const { data: all, error: readErr } = await q
  if (readErr) return intentFail(readErr.message, '차례 저장')

  const known = new Set((all ?? []).map((r) => r.id as string))
  const list = ids.filter((id) => known.has(id))

  if (list.length !== known.size) {
    return fail('목록이 바뀌었습니다. 새로고침 후 다시 시도해 주세요.')
  }

  const results = await Promise.all(
    list.map((id, i) => db.from('chat_intents').update({ sort_order: i }).eq('id', id)),
  )

  const failed = results.find((r) => r.error)
  if (failed?.error) return intentFail(failed.error.message, '차례 저장')

  refresh()
  return { ok: true }
}

/* 지우면 아래 단계도 함께 지워진다(0027 의 on delete cascade).
   화면에서 그 사실을 먼저 알린 뒤 부른다. */
export async function deleteIntent(id: string): Promise<Result> {
  const db = await guard()

  const { error } = await db.from('chat_intents').delete().eq('id', id)
  if (error) return intentFail(error.message, '단추 삭제')

  refresh()
  return { ok: true }
}

/* ─────────── 공개 스위치 ───────────

   켜면 손님에게도 우하단 단추가 보인다. 지식을 채운 뒤에 켠다. */
export async function setChatPublic(on: boolean): Promise<Result> {
  const db = await guard()

  const { error } = await db.from('site_settings').update({ chat_public: on }).eq('id', true)
  if (error) {
    console.error('[chat] 공개 스위치 변경 실패:', error.message)
    if (error.message.includes('chat_public')) {
      return fail('챗봇 공개 칸이 아직 없습니다. 0023_chat.sql 을 실행해 주세요.')
    }
    return fail('변경에 실패했습니다.')
  }

  refresh()
  /* 켜고 끄면 모든 화면의 우하단 단추가 달라진다 */
  revalidatePath('/', 'layout')
  return { ok: true }
}
