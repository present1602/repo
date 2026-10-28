import 'server-only'
import { Resend } from 'resend'

/* 어드민 알림 메일 — 문의·지원서 접수 때 보낸다.

   답장 주소(replyTo)에는 보낸 사람이 적은 이메일을 넣는다. 그런데 Resend 는
   그 주소가 조금만 이상해도(km@m.c 처럼 끝이 한 글자) 요청을 통째로 거부하고,
   거부된 요청은 발송 기록에도 남지 않는다. 접수 폼의 검사는 느슨하게 둬야
   하므로(오타가 있어도 접수는 받는다), 여기서 답장 주소만 빼고 한 번 더 보낸다.
   어드민은 본문에 적힌 주소로 직접 연락하면 된다. */

export async function sendAdminMail(msg: {
  from: string
  to: string[]
  replyTo?: string
  subject: string
  html: string
}) {
  const resend = new Resend(process.env.RESEND_API_KEY)

  const first = await resend.emails.send(msg)
  if (!first.error) return

  const rejectedReplyTo =
    msg.replyTo && first.error.name === 'validation_error' && /reply_to/i.test(first.error.message)
  if (!rejectedReplyTo) throw first.error

  console.warn('[mail] 답장 주소가 거부돼 빼고 다시 보냄:', msg.replyTo)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { replyTo, ...rest } = msg
  const retry = await resend.emails.send(rest)
  if (retry.error) throw retry.error
}
