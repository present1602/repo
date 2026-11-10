import 'server-only'
import { supabaseAdmin } from './supabase-admin'
import { buildIntentTree, type ChatIntent, type ChatIntentNode } from './chat-shape'

/* 챗봇 시작 메뉴 조회(0027_chat_intents.sql).

   chat-knowledge.ts·faqs.ts 와 같은 방침 — 마이그레이션 전이면 조용히 비워
   돌려주고 화면은 뜬다. 메뉴가 비면 챗봇은 단추 없이 열리고, 손님은 평소처럼
   적어서 물으면 된다. */

const COLS = 'id, parent_id, label, intro, sort_order, enabled'

/* 차례대로 정렬한다 — sort_order 가 같으면 먼저 등록한 것이 앞.
   Postgres 의 정렬은 로케일 설정에 기대므로 코드에서 맞춘다(faqs.ts 와 같은 방침). */
async function readIntents(enabledOnly: boolean): Promise<ChatIntent[]> {
  if (!supabaseAdmin) return []

  const q = supabaseAdmin
    .from('chat_intents')
    .select(COLS)
    .order('sort_order')
    .order('created_at')
  const { data, error } = await (enabledOnly ? q.eq('enabled', true) : q)

  if (error) {
    /* 마이그레이션 전이면 표가 없다 — 조용히 비워 돌려준다 */
    if (!/chat_intents/i.test(error.message)) {
      console.error('[chat] 시작 메뉴 조회 실패:', error.message)
    }
    return []
  }

  return (data ?? []) as unknown as ChatIntent[]
}

/* 손님 화면용 — 켜 둔 것만, 부모-자식으로 엮어서 */
export async function getIntentTree(): Promise<ChatIntentNode[]> {
  return buildIntentTree(await readIntents(true))
}

/* 어드민용 — 끈 것까지 전부, 부모-자식으로 엮어서 */
export async function getAllIntentTree(): Promise<ChatIntentNode[]> {
  return buildIntentTree(await readIntents(false))
}

/* 챗봇 프롬프트에 넣을 글 — 단추를 안 누르고 글로 물어도 답할 수 있게.

   단계를 들여쓰기로 나타낸다. 소개 멘트가 비어 있으면 그 줄은 건너뛴다 —
   할 말이 없는 단추(한 번 더 묻기만 하는 것)는 모델에게 줄 것이 없다. */
export async function intentFacts(): Promise<string> {
  const tree = await getIntentTree()
  if (tree.length === 0) return ''

  const lines: string[] = []

  const walk = (nodes: ChatIntentNode[], depth: number) => {
    for (const n of nodes) {
      const pad = '  '.repeat(depth)
      lines.push(`${pad}- ${n.label}`)
      if (n.intro.trim()) {
        /* 줄바꿈이 들어 있어도 들여쓰기를 유지한다 — 목록 모양이 흐트러지면
           어느 단추의 설명인지 모델이 헷갈린다 */
        const intro = n.intro.trim().split('\n').join(`\n${pad}  `)
        lines.push(`${pad}  ${intro}`)
      }
      walk(n.children, depth + 1)
    }
  }
  walk(tree, 0)

  return ['## 의뢰할 수 있는 것(시작 메뉴)', ...lines].join('\n')
}
