import 'server-only'
import { Resend } from 'resend'

const FROM = process.env.MAIL_FROM_EMAIL ?? 'onboarding@resend.dev'

/* 후기 요청 메일 — 받는 사람이 디자이너가 아니라 고객이라
   designer-mail.ts 와 나눠 둔다.

   메일이 실패해도 링크는 이미 만들어진 상태다. 어드민 화면에서 주소를
   복사해 카카오·문자로 직접 보낼 수 있으므로 성공 여부만 돌려주고
   흐름을 막지 않는다(sendTempPassword 와 같은 방침). */
export async function sendReviewRequest(
  email: string,
  name: string,
  reviewUrl: string,
  designerName?: string | null,
): Promise<{ ok: boolean; error?: string }> {
  if (!process.env.RESEND_API_KEY) {
    return { ok: false, error: '메일 설정(RESEND_API_KEY)이 없습니다.' }
  }

  /* 디자이너를 아는 경우에만 이름을 넣는다 — 모르면 '이번 작업' 으로 둔다 */
  const what = designerName ? `${esc(designerName)} 디자이너와의 작업` : '이번 작업'

  const html = `
    <div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;line-height:1.7">
      <h2 style="margin:0 0 18px;font-size:18px">${what}, 어떠셨나요?</h2>
      <p style="margin:0 0 18px;font-size:14px">
        ${esc(name)}님, 작업은 만족스러우셨는지요.<br>
        잠깐 시간을 내어 후기를 남겨 주시면 다른 분들이 디자이너를 고를 때
        큰 도움이 됩니다.
      </p>

      <p style="margin:0 0 22px">
        <a href="${reviewUrl}"
           style="display:inline-block;background:#18181b;color:#fff;text-decoration:none;
                  padding:13px 26px;border-radius:10px;font-size:14px;font-weight:600">
          후기 남기기
        </a>
      </p>

      <p style="font-size:13px;color:#777;margin:0 0 6px">
        버튼이 눌리지 않으면 아래 주소를 복사해 주소창에 붙여 넣어 주세요.
      </p>
      <p style="font-size:12px;color:#999;margin:0 0 18px;word-break:break-all">
        ${esc(reviewUrl)}
      </p>

      <p style="font-size:13px;color:#777;margin:0">
        이 링크는 30일간 열리며, 후기는 한 번만 쓸 수 있습니다.<br>
        남겨 주신 이름은 <b>김*연</b> 처럼 일부만 공개되고 이메일은 공개되지 않습니다.
      </p>
    </div>`

  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    const { error } = await resend.emails.send({
      from: `soom <${FROM}>`,
      to: email,
      subject: '[soom] 작업은 어떠셨나요? 후기를 남겨 주세요',
      html,
    })
    if (error) throw error
    return { ok: true }
  } catch (err) {
    console.error('[review-mail] 후기 요청 발송 실패:', email, err)
    const msg = err instanceof Error ? err.message : '알 수 없는 오류'
    return { ok: false, error: msg }
  }
}

function esc(s: string) {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  )
}
