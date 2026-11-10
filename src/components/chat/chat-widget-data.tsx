import { getChatPublic } from '@/lib/site-settings'
import { getAdminUser } from '@/lib/admin-auth'
import { getIntentTree } from '@/lib/chat-intents'
import { ChatWidget } from './chat-widget'

/* 챗봇을 누구에게 보일지 정하는 자리.

   공개 스위치(0023_chat.sql)를 켜기 전에는 어드민으로 로그인한 사람에게만
   보인다 — 지식이 모자란 챗봇을 손님에게 먼저 보이면 그게 첫인상이 된다.

   화면을 가리는 것과 막는 것은 다른 일이다: 라우트(api/chat/route.ts)도
   같은 조건을 다시 본다. 여기서 숨기는 것은 눈에 띄지 않게 하는 것뿐이다. */
export async function ChatWidgetData() {
  const isPublic = await getChatPublic()

  /* 공개 전이면 어드민인지 묻는다 — 켠 뒤에는 묻지 않는다(모두에게 보이므로
     로그인 확인에 쓸 왕복을 아낀다) */
  if (!isPublic) {
    const admin = await getAdminUser()
    if (!admin) return null
    return <ChatWidget adminOnly intents={await getIntentTree()} />
  }

  /* 시작 메뉴 — 비어 있으면(마이그레이션 전이거나 다 꺼 뒀으면) 단추 없이
     열리고 평소처럼 적어서 물으면 된다 */
  return <ChatWidget adminOnly={false} intents={await getIntentTree()} />
}
