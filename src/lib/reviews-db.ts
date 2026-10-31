import 'server-only'
import { supabaseAdmin } from './supabase-admin'
import { maskName } from './display-name'
import {
  MIN_REVIEW_BODY,
  MAX_REVIEW_BODY,
  REVIEW_TOKEN_DAYS,
  type PublicReview,
  type ReviewLinkState,
  type ReviewRow,
  type ReviewTokenRow,
} from './review-shape'

/* 후기 조회·저장(028_reviews.sql).

   RLS 로 전부 막아 둔 테이블이라 service_role 로만 닿는다.
   공개 화면도 이 모듈을 거친다 — 승인된 것만 골라야 하고,
   author_email 은 절대 브라우저로 내려가면 안 되기 때문이다. */

/* 공개 화면으로 내보낼 모양으로 깎는다. 이메일·상태·연결정보를 전부 뗀다. */
function strip(r: ReviewRow): PublicReview {
  return {
    id: r.id,
    created_at: r.created_at,
    author: maskName(r.author_name),
    body: r.body,
    rating: r.rating,
  }
}

/* ─────────── 링크 ─────────── */

/* 링크를 열었을 때 쓸 수 있는 것인지 확인한다.

   왜 못 쓰는지를 구분해 돌려준다 — 기간이 지난 것과 이미 쓴 것은
   안내 문구가 달라야 한다. */
export async function checkReviewToken(token: string): Promise<ReviewLinkState> {
  if (!supabaseAdmin) return { ok: false, reason: 'notfound' }
  if (!isUuid(token)) return { ok: false, reason: 'notfound' }

  const { data, error } = await supabaseAdmin
    .from('review_tokens')
    .select(
      'token, inquiry_id, expires_at, used_at, designer_id, designer_name, author_name, author_email',
    )
    .eq('token', token)
    .maybeSingle()

  if (error) {
    console.error('[review] 토큰 조회 실패:', error.message)
    return { ok: false, reason: 'notfound' }
  }
  if (!data) return { ok: false, reason: 'notfound' }

  const t = data as TokenRow
  if (t.used_at) return { ok: false, reason: 'used' }
  if (new Date(t.expires_at).getTime() < Date.now()) return { ok: false, reason: 'expired' }

  /* 누구의 작업에 대한 후기인지 화면에 보여 줘야 한다 —
     "○○ 디자이너와의 작업은 어떠셨나요" 를 띄우기 위해서다.

     신원은 한곳에서만 읽는다. 문의에 매인 링크면 의뢰를 따르고(의뢰 쪽이
     고쳐지면 그대로 따라간다), 직접 만든 링크면 토큰에 적어 둔 값을 쓴다. */
  const who = await whoFor(t)

  return {
    ok: true,
    inquiryId: t.inquiry_id,
    designerName: who.designerName,
    authorName: who.authorName,
  }
}

type TokenRow = {
  token: string
  inquiry_id: string | null
  expires_at: string
  used_at: string | null
  designer_id: string | null
  designer_name: string | null
  author_name: string | null
  author_email: string | null
}

/* 링크가 가리키는 신원 — 문의에 매였으면 의뢰에서, 아니면 토큰에서. */
async function whoFor(t: TokenRow): Promise<{
  designerId: string | null
  designerName: string | null
  authorName: string
  authorEmail: string
}> {
  if (t.inquiry_id && supabaseAdmin) {
    const { data } = await supabaseAdmin
      .from('inquiries')
      .select('name, email, designer_id, designer_name')
      .eq('id', t.inquiry_id)
      .maybeSingle()

    const i = (data ?? {}) as {
      name?: string
      email?: string
      designer_id?: string | null
      designer_name?: string | null
    }
    return {
      designerId: i.designer_id ?? null,
      designerName: i.designer_name ?? null,
      authorName: i.name ?? '',
      authorEmail: i.email ?? '',
    }
  }

  return {
    designerId: t.designer_id,
    designerName: t.designer_name,
    authorName: t.author_name ?? '',
    /* 직접 만든 링크는 이메일을 안 받았을 수 있다. 나중에 계정과 잇는
       열쇠가 비는 셈이지만, 후기를 못 받는 것보다는 낫다. */
    authorEmail: t.author_email ?? '',
  }
}

/* 의뢰에 붙은 작성 링크를 가져오거나 없으면 만든다.

   한 의뢰에는 링크 하나만 둔다 — 보낼 때마다 새로 만들면 먼저 받은
   링크가 조용히 죽어 "눌렀더니 안 돼요" 가 된다. 다시 보낼 때도
   같은 토큰을 보낸다. */
export async function ensureReviewToken(
  inquiryId: string,
  /* 의뢰에 디자이너가 비어 있을 때 어드민이 골라 준 값.
     고르면 의뢰에도 함께 적어 둔다 — 한곳에서만 읽기 위해서다. */
  designer?: { id: string; name: string | null } | null,
): Promise<{ ok: true; token: string } | { ok: false; error: string }> {
  if (!supabaseAdmin) return { ok: false, error: '서버 설정이 완료되지 않았습니다.' }
  if (!isUuid(inquiryId)) return { ok: false, error: '잘못된 의뢰입니다.' }

  /* 디자이너를 골랐으면 의뢰에 먼저 반영한다. 링크가 가리키는 신원은
     의뢰에서 읽으므로, 여기에 적어야 작성 화면과 저장이 같은 값을 본다. */
  if (designer?.id) {
    const { error } = await supabaseAdmin
      .from('inquiries')
      .update({ designer_id: designer.id, designer_name: designer.name })
      .eq('id', inquiryId)
    if (error) {
      console.error('[review] 의뢰 디자이너 지정 실패:', error.message)
      return { ok: false, error: '디자이너를 지정하지 못했습니다.' }
    }
  }

  const { data: found } = await supabaseAdmin
    .from('review_tokens')
    .select('token, expires_at, used_at')
    .eq('inquiry_id', inquiryId)
    .maybeSingle()

  if (found) {
    const f = found as { token: string; expires_at: string; used_at: string | null }
    if (f.used_at) return { ok: false, error: '이미 후기를 작성한 의뢰입니다.' }

    /* 기간만 지났으면 되살린다 — 토큰을 바꾸면 먼저 보낸 링크가 죽는다 */
    if (new Date(f.expires_at).getTime() < Date.now()) {
      const { error } = await supabaseAdmin
        .from('review_tokens')
        .update({ expires_at: expiresAt() })
        .eq('token', f.token)
      if (error) {
        console.error('[review] 토큰 기간 연장 실패:', error.message)
        return { ok: false, error: '링크를 준비하지 못했습니다.' }
      }
    }
    return { ok: true, token: f.token }
  }

  const { data, error } = await supabaseAdmin
    .from('review_tokens')
    .insert({ inquiry_id: inquiryId, expires_at: expiresAt() })
    .select('token')
    .maybeSingle()

  if (error || !data) {
    console.error('[review] 토큰 발급 실패:', error?.message)
    return { ok: false, error: '링크를 준비하지 못했습니다.' }
  }
  return { ok: true, token: (data as { token: string }).token }
}

/* 문의 없이 링크를 만든다 — 전화·메신저로 직접 받은 의뢰용.

   플랫폼을 거치지 않은 일도 후기는 받아야 한다. 이때는 가져올 의뢰가
   없으므로 어드민이 적은 값을 토큰에 담아 둔다.
   디자이너는 선택이다 — 안 고르면 어느 디자이너에도 붙지 않는 후기가
   되지만, 그래도 받아 두는 편이 낫다(나중에 어드민이 이어 붙일 수 있다). */
export async function createStandaloneToken(input: {
  authorName: string
  authorEmail?: string
  designer?: { id: string; name: string | null } | null
  memo?: string
}): Promise<{ ok: true; token: string } | { ok: false; error: string }> {
  if (!supabaseAdmin) return { ok: false, error: '서버 설정이 완료되지 않았습니다.' }

  const name = input.authorName.trim()
  if (!name) return { ok: false, error: '작성자 이름을 적어 주세요.' }

  const email = input.authorEmail?.trim() ?? ''
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: '이메일 형식이 올바르지 않습니다.' }
  }

  const { data, error } = await supabaseAdmin
    .from('review_tokens')
    .insert({
      inquiry_id: null,
      expires_at: expiresAt(),
      designer_id: input.designer?.id ?? null,
      designer_name: input.designer?.name ?? null,
      author_name: name,
      author_email: email || null,
      memo: input.memo?.trim() || null,
    })
    .select('token')
    .maybeSingle()

  if (error || !data) {
    console.error('[review] 직접 발급 실패:', error?.message)
    return { ok: false, error: '링크를 만들지 못했습니다.' }
  }
  return { ok: true, token: (data as { token: string }).token }
}

/* 링크를 보낸 기록. 몇 번 보냈는지는 운영에서 전달 경로를 의심하는 근거가 된다. */
export async function markReviewLinkSent(token: string) {
  if (!supabaseAdmin) return
  const { data } = await supabaseAdmin
    .from('review_tokens')
    .select('sent_count')
    .eq('token', token)
    .maybeSingle()

  const n = ((data as { sent_count?: number } | null)?.sent_count ?? 0) + 1
  await supabaseAdmin
    .from('review_tokens')
    .update({ sent_count: n, last_sent_at: new Date().toISOString() })
    .eq('token', token)
}

/* ─────────── 작성 ─────────── */

/* 후기를 남긴다. 토큰을 다시 확인하고, 성공하면 그 토큰을 닫는다.

   화면에서 이미 확인했더라도 여기서 또 본다 — 화면을 열어 둔 채
   시간이 지났거나, 두 탭에서 동시에 보낼 수 있다. */
export async function submitReview(
  token: string,
  body: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!supabaseAdmin) return { ok: false, error: '서버 설정이 완료되지 않았습니다.' }

  const text = body.trim()
  if (text.length < MIN_REVIEW_BODY) {
    return { ok: false, error: `후기는 ${MIN_REVIEW_BODY}자 이상 적어 주세요.` }
  }
  if (text.length > MAX_REVIEW_BODY) {
    return { ok: false, error: `후기는 ${MAX_REVIEW_BODY}자까지 쓸 수 있습니다.` }
  }

  const state = await checkReviewToken(token)
  if (!state.ok) {
    const msg =
      state.reason === 'used'
        ? '이미 후기를 작성한 링크입니다.'
        : state.reason === 'expired'
          ? '링크 사용 기간이 지났습니다.'
          : '유효하지 않은 링크입니다.'
    return { ok: false, error: msg }
  }

  /* 신원과 대상 디자이너를 토큰이 가리키는 곳에서 베껴 온다.
     문의에 매인 링크면 의뢰에서, 직접 만든 링크면 토큰에서 읽는다.
     어느 쪽이든 후기에는 '그 시점의 값'을 박아 둔다 — 나중에 원본이
     고쳐져도 후기에 쓰인 이름은 그대로여야 한다. */
  const { data: tk } = await supabaseAdmin
    .from('review_tokens')
    .select(
      'token, inquiry_id, expires_at, used_at, designer_id, designer_name, author_name, author_email',
    )
    .eq('token', token)
    .maybeSingle()

  if (!tk) return { ok: false, error: '유효하지 않은 링크입니다.' }
  const who = await whoFor(tk as TokenRow)

  const { error } = await supabaseAdmin.from('reviews').insert({
    inquiry_id: state.inquiryId,
    token,
    designer_id: who.designerId,
    designer_name: who.designerName,
    author_name: who.authorName,
    author_email: who.authorEmail,
    body: text,
    /* 승인 전에는 공개되지 않는다 — 작성자에게 그 사실을 알려야 한다 */
    status: 'pending',
  })

  if (error) {
    /* unique(inquiry_id) 에 걸렸다면 이미 쓴 것이다 */
    if (error.message.includes('duplicate') || error.message.includes('unique')) {
      return { ok: false, error: '이미 후기를 작성한 의뢰입니다.' }
    }
    console.error('[review] 저장 실패:', error.message)
    return { ok: false, error: '저장에 실패했습니다.' }
  }

  /* 토큰을 닫는다. 실패해도 후기는 이미 저장됐으므로 성공으로 돌려준다 —
     unique(inquiry_id) 가 두 번째 작성을 막아 준다. */
  const { error: tErr } = await supabaseAdmin
    .from('review_tokens')
    .update({ used_at: new Date().toISOString() })
    .eq('token', token)
  if (tErr) console.error('[review] 토큰 닫기 실패:', tErr.message)

  return { ok: true }
}

/* ─────────── 공개 조회 ─────────── */

/* 디자이너 상세에 붙일 후기. 승인된 것만 내보낸다. */
export async function listDesignerReviews(
  designerId: string,
  limit = 20,
): Promise<PublicReview[]> {
  if (!supabaseAdmin || !isUuid(designerId)) return []

  const { data, error } = await supabaseAdmin
    .from('reviews')
    .select('*')
    .eq('designer_id', designerId)
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    /* 028 전이면 테이블이 없다 — 화면은 비우고 넘어간다 */
    console.error('[review] 디자이너 후기 조회 실패:', error.message)
    return []
  }
  return ((data ?? []) as ReviewRow[]).map(strip)
}

/* ─────────── 어드민 ─────────── */

export async function listReviews(status?: string): Promise<ReviewRow[]> {
  if (!supabaseAdmin) return []

  let q = supabaseAdmin.from('reviews').select('*')
  if (status) q = q.eq('status', status)

  const { data, error } = await q.order('created_at', { ascending: false }).limit(500)

  if (error) {
    console.error('[review] 목록 조회 실패:', error.message)
    return []
  }
  return (data ?? []) as ReviewRow[]
}

/* 만들어 둔 작성 링크 — 아직 안 쓴 것이 위로.

   어드민이 "보낸 링크가 살아 있나" 를 보는 자리다. 쓴 링크도 함께
   보여 준다 — 누가 썼는지 되짚을 수 있어야 한다. */
export async function listReviewTokens(limit = 100): Promise<ReviewTokenRow[]> {
  if (!supabaseAdmin) return []

  const { data, error } = await supabaseAdmin
    .from('review_tokens')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('[review] 링크 목록 조회 실패:', error.message)
    return []
  }
  return (data ?? []) as ReviewTokenRow[]
}

/* 승인 대기 건수 — 사이드바 배지에 쓴다 */
export async function countPendingReviews(): Promise<number> {
  if (!supabaseAdmin) return 0
  const { count, error } = await supabaseAdmin
    .from('reviews')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending')

  if (error) {
    console.error('[review] 대기 건수 조회 실패:', error.message)
    return 0
  }
  return count ?? 0
}

/* ─────────── 공용 ─────────── */

function expiresAt(): string {
  return new Date(Date.now() + REVIEW_TOKEN_DAYS * 24 * 60 * 60 * 1000).toISOString()
}

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)
}
