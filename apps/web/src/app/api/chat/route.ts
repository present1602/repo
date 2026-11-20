import Anthropic from '@anthropic-ai/sdk'
import { getAdminUser } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getChatPublic } from '@/lib/site-settings'
import { buildChatSystem } from '@/lib/chat-prompt'
import { allowIp, allowSession, clientIp } from '@/lib/chat-limit'
import {
  CHAT_HISTORY_TURNS,
  MAX_CHAT_INPUT,
  MAX_CHAT_TURNS,
  UNKNOWN_MARK,
  isChatTurn,
  type ChatTurn,
} from '@/lib/chat-shape'

/* 문의 챗봇 — 지식으로 답하고, 모르면 모른다고 한다(0023_chat.sql).

   순서가 중요하다: 권한을 보고 → 상한을 세고 → 답을 흘려보내고 → 기록을 남긴다.
   기록을 먼저 남기면 실패한 대화까지 '답변 필요' 로 쌓여 운영자가 헛일을 한다.

   답은 토막토막 흘려보낸다(스트리밍) — 통째로 기다리면 3~5초간 빈 화면이고,
   사용자에게 그것은 고장과 같다(AGENTS.md).

   공개 스위치를 켜기 전에는 어드민으로 로그인한 사람만 쓸 수 있다. */

/* 모델이 한 번에 답하는 데 수십 초가 걸리는 일은 없지만, 네트워크가 느릴 때를 둔다.
   runtime 은 적지 않는다 — 이 프로젝트의 cacheComponents 설정과 함께 쓸 수 없다
   (api/inquiry/route.ts 와 같은 방침). */
export const maxDuration = 60

/* 상담 응대에는 Sonnet 이 넉넉하다 — 빠르고, 비용이 Opus 의 절반 아래다.
   더 어려운 판단을 맡기게 되면 claude-opus-5-5 로 올린다. */
const MODEL = 'claude-sonnet-5-5'

/* 답은 3~4문장으로 묶으라고 일러 두었다 — 넉넉히 두고 모델이 알아서 멈추게 한다 */
const MAX_TOKENS = 1024

const apiKey = process.env.ANTHROPIC_API_KEY
const anthropic = apiKey ? new Anthropic({ apiKey }) : null

function bad(error: string, status = 400) {
  return Response.json({ ok: false, error }, { status })
}

/* 대화 한 줄을 남긴다 — 실패해도 답은 이미 사용자에게 갔으므로 조용히 로그만 남긴다.
   이 기록이 다음에 채울 지식의 목록이다. */
async function log(row: {
  sessionId: string
  question: string
  answer: string
  unanswered: boolean
  tokensIn: number
  tokensOut: number
  error?: string
}) {
  if (!supabaseAdmin) return

  const { error } = await supabaseAdmin.from('chat_logs').insert({
    session_id: row.sessionId,
    question: row.question,
    answer: row.answer,
    unanswered: row.unanswered,
    tokens_in: row.tokensIn,
    tokens_out: row.tokensOut,
    error: row.error ?? '',
  })

  if (error) {
    /* 0023 전이면 표가 없다 — 대화는 이미 성공했으므로 막지 않는다 */
    console.error('[chat] 대화 기록 실패:', error.message)
  }
}

export async function POST(req: Request) {
  try {
    /* ── 권한: 공개 스위치가 꺼져 있으면 어드민만 ── */
    const [isPublic, admin] = await Promise.all([getChatPublic(), getAdminUser()])
    if (!isPublic && !admin) {
      return bad('문의 챗봇은 준비 중입니다.', 403)
    }

    if (!anthropic) {
      console.error('[chat] ANTHROPIC_API_KEY 미설정')
      return bad('챗봇이 아직 설정되지 않았습니다. 관리자에게 알려 주세요.', 503)
    }

    const body: unknown = await req.json().catch(() => null)
    if (typeof body !== 'object' || body == null) return bad('요청을 읽지 못했습니다.')

    const { sessionId: rawSession, message: rawMessage, history: rawHistory } = body as Record<
      string,
      unknown
    >

    const sessionId = String(rawSession ?? '').trim().slice(0, 64)
    const message = String(rawMessage ?? '').trim()

    if (!sessionId) return bad('대화를 시작하지 못했습니다. 새로고침 후 다시 시도해 주세요.')
    if (!message) return bad('물어보실 내용을 적어 주세요.')
    if (message.length > MAX_CHAT_INPUT) {
      return bad(
        `한 번에 ${MAX_CHAT_INPUT}자까지 보낼 수 있습니다. 내용이 길면 의뢰하기로 남겨 주세요.`,
      )
    }

    /* ── 상한: 화면에서도 막지만 직접 보낸 요청에는 효력이 없다 ── */
    if (!allowIp(clientIp(req))) {
      return bad('잠시 후 다시 시도해 주세요. 문의가 급하시면 의뢰하기로 남겨 주세요.', 429)
    }
    if (!allowSession(sessionId, MAX_CHAT_TURNS)) {
      return bad(
        '한 대화에서 주고받을 수 있는 횟수를 넘었습니다. 의뢰하기로 남겨 주시면 자세히 안내드립니다.',
        429,
      )
    }

    /* 지난 대화 — 화면이 보낸 것을 그대로 믿지 않고 모양과 개수를 여기서 다시 센다.
       마지막 몇 쌍만 보낸다: 길어지면 캐시가 깨지고 값만 는다. */
    const history: ChatTurn[] = (Array.isArray(rawHistory) ? rawHistory : [])
      .filter(isChatTurn)
      .map((t) => ({ role: t.role, text: t.text.slice(0, MAX_CHAT_INPUT) }))
      .filter((t) => t.text.trim())
      .slice(-CHAT_HISTORY_TURNS * 2)

    const system = await buildChatSystem()

    const messages: Anthropic.MessageParam[] = [
      ...history.map((t) => ({ role: t.role, content: t.text }) as Anthropic.MessageParam),
      { role: 'user', content: message },
    ]

    /* 지식 덩이를 캐시에 올린다 — 요청마다 같은 글자라서 두 번째 대화부터
       입력 비용이 1/10 로 떨어진다. 사용자의 말은 캐시 뒤에 붙으므로 캐시를 깨지 않는다. */
    const stream = anthropic.messages.stream({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
      messages,
    })

    /* 토막을 그대로 흘려보낸다. 사용자에게는 '[모름]' 표시를 떼고 보여 주고,
       기록에는 그 표시로 '답변 필요' 를 가린다. */
    const encoder = new TextEncoder()
    const out = new ReadableStream<Uint8Array>({
      async start(controller) {
        let answer = ''
        /* 앞머리를 다 받기 전에는 '[모름]' 인지 알 수 없다 — 표시만큼 모아 두고 판단한다 */
        let head = ''
        let decided = false
        let unknown = false

        const send = (text: string) => {
          if (text) controller.enqueue(encoder.encode(text))
        }

        try {
          for await (const event of stream) {
            if (event.type !== 'content_block_delta' || event.delta.type !== 'text_delta') continue
            const piece = event.delta.text
            answer += piece

            if (decided) {
              send(piece)
              continue
            }

            head += piece
            /* 표시가 아닌 것이 확실해질 만큼 모였거나, 표시를 다 받았을 때 판단한다 */
            if (head.length < UNKNOWN_MARK.length && UNKNOWN_MARK.startsWith(head)) continue

            decided = true
            unknown = head.startsWith(UNKNOWN_MARK)
            send(unknown ? head.slice(UNKNOWN_MARK.length).trimStart() : head)
          }

          /* 짧은 답이 표시 길이에 못 미친 채 끝났을 때 — 모아 둔 것을 내보낸다 */
          if (!decided) {
            unknown = head.startsWith(UNKNOWN_MARK)
            send(unknown ? head.slice(UNKNOWN_MARK.length).trimStart() : head)
          }

          const final = await stream.finalMessage()
          controller.close()

          await log({
            sessionId,
            question: message,
            answer,
            unanswered: unknown,
            tokensIn: final.usage.input_tokens + (final.usage.cache_read_input_tokens ?? 0),
            tokensOut: final.usage.output_tokens,
          })
        } catch (err) {
          console.error('[chat] 답변 생성 실패:', err)
          /* 이미 흘려보낸 글이 있으면 그 뒤에 한 줄 덧붙인다 — 끊긴 채로 두면
             사용자는 답이 끝난 줄 안다. 아직 아무것도 못 보냈으면 그 줄만 보낸다. */
          send(
            answer
              ? '\n\n(답변이 중간에 끊겼습니다. 다시 물어봐 주세요.)'
              : '답변을 가져오지 못했습니다. 잠시 후 다시 시도해 주세요.',
          )
          controller.close()

          await log({
            sessionId,
            question: message,
            answer,
            unanswered: false,
            tokensIn: 0,
            tokensOut: 0,
            error: err instanceof Error ? err.message : String(err),
          })
        }
      },
      cancel() {
        /* 사용자가 창을 닫았다 — 모델 쪽도 끊어 값을 아낀다 */
        stream.abort()
      },
    })

    return new Response(out, {
      headers: {
        'content-type': 'text/plain; charset=utf-8',
        'cache-control': 'no-store',
        /* 프록시가 모아 두지 않게 — 모아 두면 스트리밍이 통째로 한 번에 온다 */
        'x-accel-buffering': 'no',
      },
    })
  } catch (err) {
    console.error('[chat] 처리 실패:', err)
    return bad('문제가 발생했습니다. 잠시 후 다시 시도해 주세요.', 500)
  }
}
