import 'server-only'
import { Resend } from 'resend'

const FROM = process.env.MAIL_FROM_EMAIL ?? 'onboarding@resend.dev'

/* 임시 비밀번호 안내 메일.
   메일이 실패해도 계정 생성은 이미 끝난 상태다 —
   어드민 화면에서 임시 비밀번호를 직접 확인해 전달할 수 있으므로
   여기서는 성공 여부만 돌려주고 흐름을 막지 않는다. */
export async function sendTempPassword(
  email: string,
  name: string,
  tempPassword: string,
  loginUrl: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!process.env.RESEND_API_KEY) {
    return { ok: false, error: '메일 설정(RESEND_API_KEY)이 없습니다.' }
  }

  const html = `
    <div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;line-height:1.7">
      <h2 style="margin:0 0 18px;font-size:18px">soom 디자이너 계정이 만들어졌습니다</h2>
      <p style="margin:0 0 18px;font-size:14px">
        ${esc(name)}님, 아래 임시 비밀번호로 로그인한 뒤
        비밀번호를 변경해 주세요.
      </p>

      <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:20px">
        <tr>
          <td style="padding:9px 0;color:#666;width:120px">로그인 주소</td>
          <td style="padding:9px 0"><a href="${loginUrl}">${esc(loginUrl)}</a></td>
        </tr>
        <tr>
          <td style="padding:9px 0;color:#666">이메일</td>
          <td style="padding:9px 0">${esc(email)}</td>
        </tr>
        <tr>
          <td style="padding:9px 0;color:#666">임시 비밀번호</td>
          <td style="padding:9px 0">
            <code style="background:#f4f4f5;padding:5px 10px;border-radius:4px;
                         font-size:15px;letter-spacing:.06em">${esc(tempPassword)}</code>
          </td>
        </tr>
      </table>

      <p style="font-size:13px;color:#777;margin:0">
        이 비밀번호는 첫 로그인용입니다. 로그인 후 <b>비밀번호 변경</b>에서 반드시 바꿔 주세요.
        변경하면 관리자도 더 이상 이 비밀번호를 확인할 수 없습니다.
      </p>
    </div>`

  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    const { error } = await resend.emails.send({
      from: `soom <${FROM}>`,
      to: email,
      subject: '[soom] 디자이너 계정 임시 비밀번호',
      html,
    })
    if (error) throw error
    return { ok: true }
  } catch (err) {
    console.error('[designer-mail] 임시 비밀번호 발송 실패:', email, err)
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
