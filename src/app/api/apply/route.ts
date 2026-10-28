import { NextResponse } from 'next/server'
import { sendAdminMail } from '@/lib/admin-mail'
import { allowedEmails } from '@/lib/admin-auth'
import {
  supabaseAdmin,
  supabaseConfigured,
  APPLICATION_FILES_BUCKET,
} from '@/lib/supabase-admin'
import {
  APPLICATION_FILE_EXT,
  APPLICATION_FILE_KINDS,
  APPLICATION_FILE_LABELS,
  MAX_APPLICATION_FILE_BYTES,
  MAX_INTRO,
  fileExt,
  isHttpUrl,
  type ApplicationFile,
  type ApplicationFileKind,
} from '@/lib/application-shape'

/* 디자이너 지원서 접수(021_designer_applications.sql, 022_application_text_url.sql,
   027_application_resume_url.sql).

   포트폴리오(필수)는 파일 또는 주소(portfolioUrl)로, 기타 자료(선택 — 이력서·
   자소서 등)는 파일 또는 주소(resumeUrl)로 낸다 — 디자이너 신청 화면
   (designers/apply, 027_application_resume_url.sql). 기타 자료는 resume 칸에 담고,
   직접 적은 글이면 intro 칸에 담는다.
   제안서 v1-3 폼은 파일 두 개를 그대로 보낸다.

   파일은 이 라우트를 거치지 않는다 — 포트폴리오 PDF 는 수십 MB 인데
   서버리스 함수는 요청 본문이 몇 MB 에서 잘린다. 대신 두 번 부른다:

     prepare  이름·이메일·파일 정보를 검사하고, 파일마다 서명 업로드
              주소를 만들어 준다. 브라우저가 그 주소로 Storage 에 바로 올린다.
     submit   올라간 파일이 실제로 있는지 Storage 에서 확인한 뒤 DB 에 남긴다.

   로그인 없이 누구나 부르므로 들어온 값을 하나도 믿지 않는다.
   파일 크기는 버킷의 file_size_limit 가 최종으로 막는다. */

type FileMeta = { name: string; size: number }

/* 보내는 주소는 Resend 에서 인증한 도메인이어야 한다 — 아무 주소나 쓰면
   발송 자체가 거부된다. 지원자 주소는 답장 대상(replyTo)과 본문에 넣는다. */
const FROM = process.env.MAIL_FROM_EMAIL ?? 'onboarding@resend.dev'

/* 메일 속 내려받기 링크 유효기간 — 7일. 비공개 버킷이라 서명 링크로만 열린다.
   만료 후에도 파일은 남아 있고 어드민 지원서 화면에서 다시 받을 수 있다. */
const SIGNED_URL_TTL = 60 * 60 * 24 * 7

function bad(error: string, status = 400) {
  return NextResponse.json({ ok: false, error }, { status })
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/* 저장 경로 — 제출 키 폴더 아래 종류별 한 개.
   원래 파일명은 쓰지 않는다(한글·공백이 경로를 깨뜨린다). DB 에 따로 남긴다. */
function pathOf(submitKey: string, kind: ApplicationFileKind, name: string) {
  return `${submitKey}/${kind}.${fileExt(name)}`
}

/* 두 단계가 함께 쓰는 입력 검사 */
function readInput(body: Record<string, unknown>) {
  const name = String(body.name ?? '').trim()
  const email = String(body.email ?? '').trim()
  const submitKey = String(body.submitKey ?? '').trim()
  const raw = (body.files ?? {}) as Record<string, Partial<FileMeta> | undefined>

  if (!UUID_RE.test(submitKey)) return { error: '잘못된 요청입니다. 새로고침 후 다시 시도해 주세요.' }
  if (!name || !email) return { error: '이름과 이메일은 필수입니다.' }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: '이메일 주소를 확인해 주세요.' }
  /* DB check 제약과 같은 값 — 거부되면 뭉뚱그린 오류만 남는다 */
  if (name.length > 100 || email.length > 200) return { error: '입력이 너무 깁니다.' }

  /* 파일 대신 받을 수 있는 주소(022·027). 파일이 오면 파일을 쓴다.
     기타 자료는 직접 적은 글(intro, 022 의 칸을 다시 쓴다)로도 낼 수 있다. */
  const resumeUrl = String(body.resumeUrl ?? '').trim()
  const intro = String(body.intro ?? '').trim()
  const portfolioUrl = String(body.portfolioUrl ?? '').trim()
  const alt: Record<ApplicationFileKind, string> = { resume: resumeUrl, portfolio: portfolioUrl }

  const files: Partial<Record<ApplicationFileKind, FileMeta>> = {}
  for (const kind of APPLICATION_FILE_KINDS) {
    const f = raw[kind]
    const label = APPLICATION_FILE_LABELS[kind]
    const fname = String(f?.name ?? '').trim()
    const size = Number(f?.size ?? 0)
    if (!fname || !size) {
      /* 기타 자료는 선택 — 파일도 주소도 없으면 그냥 넘어간다 */
      if (alt[kind] || kind === 'resume') continue
      return { error: '포트폴리오 파일을 첨부하거나 주소를 적어 주세요.' }
    }
    if (size > MAX_APPLICATION_FILE_BYTES) return { error: `${label} 파일은 30MB를 넘을 수 없습니다.` }
    if (!APPLICATION_FILE_EXT.includes(fileExt(fname))) {
      return { error: `${label}: 허용되지 않는 형식입니다 (${fname})` }
    }
    files[kind] = { name: fname.slice(0, 200), size }
  }

  /* 파일을 낸 쪽의 주소는 버린다 — 화면에서 라디오를 바꾸며 남은 값이다 */
  const resumeUsed = files.resume ? null : resumeUrl || null
  const introUsed = files.resume || resumeUsed ? null : intro || null
  const urlUsed = files.portfolio ? null : portfolioUrl
  if (introUsed && introUsed.length > MAX_INTRO) {
    return { error: `기타 자료는 ${MAX_INTRO}자 이내로 적어 주세요.` }
  }
  /* http(s) 만 — javascript: 같은 주소가 어드민 화면·메일의 링크로 실리면 안 된다 */
  if (resumeUsed && (resumeUsed.length > 500 || !isHttpUrl(resumeUsed))) {
    return { error: '기타 자료 주소를 확인해 주세요. (http:// 또는 https://로 시작)' }
  }
  if (urlUsed && (urlUsed.length > 500 || !isHttpUrl(urlUsed))) {
    return { error: '포트폴리오 주소를 확인해 주세요. (http:// 또는 https://로 시작)' }
  }

  return { name, email, submitKey, files, resumeUrl: resumeUsed, intro: introUsed, portfolioUrl: urlUsed }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Record<string, unknown>

    /* 봇만 채우는 숨은 칸 — 조용히 성공으로 돌려보낸다 */
    if (String(body.company_website ?? '').trim()) {
      return NextResponse.json({ ok: true, skip: true })
    }

    const input = readInput(body)
    if ('error' in input) return bad(input.error!)
    const { name, email, submitKey, files, resumeUrl, intro, portfolioUrl } = input
    /* 파일로 낸 종류만 — 글·주소로 낸 쪽은 올릴 것도 확인할 것도 없다 */
    const fileKinds = APPLICATION_FILE_KINDS.filter((k) => files[k])

    if (!supabaseConfigured || !supabaseAdmin) {
      console.error('[apply] Supabase 미설정 — 지원자:', { name, email })
      return bad('서버 설정이 완료되지 않았습니다. 잠시 후 다시 시도해 주세요.', 503)
    }
    const db = supabaseAdmin
    const bucket = db.storage.from(APPLICATION_FILES_BUCKET)

    /* 이미 받은 지원서면 다시 처리하지 않는다 — 보낸 쪽에는 성공으로 */
    const { data: dup } = await db
      .from('designer_applications')
      .select('id')
      .eq('submit_key', submitKey)
      .maybeSingle()
    if (dup) return NextResponse.json({ ok: true, duplicate: true })

    /* ── 1단계: 업로드 주소 ── */
    if (body.step === 'prepare') {
      const uploads: Partial<Record<ApplicationFileKind, { path: string; token: string }>> = {}
      for (const kind of fileKinds) {
        const path = pathOf(submitKey, kind, files[kind]!.name)
        /* upsert — 업로드 도중 실패해 다시 누르면 같은 경로에 덮어쓴다 */
        const { data, error } = await bucket.createSignedUploadUrl(path, { upsert: true })
        if (error || !data) {
          console.error('[apply] 업로드 주소 생성 실패:', error?.message)
          /* 버킷이 없으면 Storage 는 'bucket' 대신 "The related resource does
             not exist" 로 답한다 — 021 을 돌리지 않은 경우 */
          if (error && /bucket|related resource does not exist/i.test(error.message)) {
            return bad('지원서 저장소가 준비되지 않았습니다. 관리자에게 알려 주세요.', 503)
          }
          return bad('업로드를 준비하지 못했습니다. 잠시 후 다시 시도해 주세요.', 500)
        }
        uploads[kind] = { path: data.path, token: data.token }
      }
      return NextResponse.json({ ok: true, uploads })
    }

    if (body.step !== 'submit') return bad('잘못된 요청입니다.')

    /* ── 2단계: 확인 후 저장 ──
       브라우저가 "올렸다"고 해도 믿지 않는다. 폴더를 직접 들여다봐
       파일이 있는지, 크기가 제한 안인지 확인한다. */
    const saved: Partial<Record<ApplicationFileKind, ApplicationFile>> = {}
    if (fileKinds.length > 0) {
      const { data: listed, error: listErr } = await bucket.list(submitKey)
      if (listErr) {
        console.error('[apply] 업로드 확인 실패:', listErr.message)
        return bad('업로드를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.', 500)
      }

      for (const kind of fileKinds) {
        const path = pathOf(submitKey, kind, files[kind]!.name)
        const obj = listed?.find((o) => `${submitKey}/${o.name}` === path)
        const size = Number(obj?.metadata?.size ?? 0)
        if (!obj || !size) {
          return bad(`${APPLICATION_FILE_LABELS[kind]} 파일이 올라가지 않았습니다. 다시 시도해 주세요.`)
        }
        saved[kind] = { name: files[kind]!.name, path, size }
      }
    }

    const { data: row, error: dbErr } = await db.from('designer_applications').insert({
      name,
      email,
      resume: saved.resume ?? null,
      portfolio: saved.portfolio ?? null,
      /* 022·027 전 DB 에는 이 칸들이 없다 — 파일 두 개로 내는 v1-3 폼이
         그동안에도 동작하도록 값이 있을 때만 싣는다 */
      ...(resumeUrl ? { resume_url: resumeUrl } : {}),
      ...(intro ? { intro } : {}),
      ...(portfolioUrl ? { portfolio_url: portfolioUrl } : {}),
      submit_key: submitKey,
    }).select('id').single()

    if (dbErr) {
      /* 유니크 제약 위반 = 동시에 들어온 중복 제출 */
      if (dbErr.code === '23505') return NextResponse.json({ ok: true, duplicate: true })
      console.error('[apply] DB 저장 실패 — 지원자:', { name, email, saved, error: dbErr.message })
      if (/designer_applications/i.test(dbErr.message)) {
        return bad('지원 접수가 아직 준비되지 않았습니다. 관리자에게 알려 주세요.', 503)
      }
      return bad('접수 처리에 실패했습니다. 잠시 후 다시 시도해 주세요.', 500)
    }

    /* ── 알림 메일 ──
       DB 에 이미 남았으므로 메일이 실패해도 접수는 성공으로 돌려준다.
       못 나간 지원서도 어드민 지원서 화면에서는 보인다. */
    const mailed = await notifyAdmins(db, {
      id: row.id as string,
      name,
      email,
      resumeUrl,
      intro,
      portfolioUrl,
      saved,
    })

    return NextResponse.json({ ok: true, mailed })
  } catch (err) {
    console.error('[apply] 처리 실패:', err)
    return bad('전송 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.', 500)
  }
}

/* ─────────── 알림 메일 ─────────── */

type Saved = Partial<Record<ApplicationFileKind, ApplicationFile>>

async function notifyAdmins(
  db: NonNullable<typeof supabaseAdmin>,
  a: { id: string; name: string; email: string; resumeUrl: string | null; intro: string | null; portfolioUrl: string | null; saved: Saved },
): Promise<boolean> {
  const to = allowedEmails()
  if (!process.env.RESEND_API_KEY || to.length === 0) {
    console.warn('[apply] 메일 미설정 — 접수만 저장됨:', a.id)
    return false
  }

  try {
    /* 파일마다 내려받기 링크를 만든다. 실패하면 링크 없이 이름만 싣는다 —
       링크 하나 때문에 알림 전체를 놓치는 것보다 낫다. */
    const links: Partial<Record<ApplicationFileKind, string>> = {}
    for (const kind of APPLICATION_FILE_KINDS) {
      const f = a.saved[kind]
      if (!f) continue
      const { data } = await db.storage
        .from(APPLICATION_FILES_BUCKET)
        .createSignedUrl(f.path, SIGNED_URL_TTL, { download: f.name })
      if (data?.signedUrl) links[kind] = data.signedUrl
    }

    await sendAdminMail({
      from: `soom 디자이너 지원 <${FROM}>`,
      to,
      /* 답장을 누르면 바로 지원자에게 간다 */
      replyTo: a.email,
      subject: `[디자이너 지원] ${a.name}`,
      html: mailHtml(a, links),
    })
    return true
  } catch (err) {
    console.error('[apply] 메일 전송 실패 (접수는 저장됨):', a.id, err)
    return false
  }
}

/* 메일 본문에 들어가는 지원자 입력을 막는다 — 그대로 넣으면 태그가
   살아나 본문이 깨지거나 엉뚱한 링크가 심긴다. */
function esc(s: string) {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  )
}

function mailHtml(
  a: { id: string; name: string; email: string; resumeUrl: string | null; intro: string | null; portfolioUrl: string | null; saved: Saved },
  links: Partial<Record<ApplicationFileKind, string>>,
) {
  const file = (kind: ApplicationFileKind) => {
    const f = a.saved[kind]!
    const size = `${(f.size / 1024 / 1024).toFixed(1)}MB`
    return links[kind]
      ? `<a href="${links[kind]}">${esc(f.name)}</a> (${size})`
      : `${esc(f.name)} (${size}) — 링크를 만들지 못했습니다. 어드민 화면에서 받아 주세요.`
  }

  /* 포트폴리오는 파일 또는 주소, 기타 자료는 파일·주소·직접 입력·없음 */
  const extra = a.saved.resume
    ? file('resume')
    : a.resumeUrl
      ? `<a href="${esc(a.resumeUrl)}">${esc(a.resumeUrl)}</a>`
      : a.intro
        ? `<span style="white-space:pre-wrap">${esc(a.intro)}</span>`
        : '<span style="color:#999">없음</span>'
  /* 주소는 접수 때 http(s) 만 받았다(isHttpUrl) — 그래도 속성에 넣으니 이스케이프한다 */
  const portfolio = a.saved.portfolio
    ? file('portfolio')
    : `<a href="${esc(a.portfolioUrl ?? '')}">${esc(a.portfolioUrl ?? '')}</a>`

  const rows: [string, string][] = [
    ['이름', esc(a.name)],
    ['이메일', `<a href="mailto:${esc(a.email)}">${esc(a.email)}</a>`],
    ['포트폴리오', portfolio],
    ['기타 자료', extra],
  ]

  const hasFiles = Boolean(a.saved.resume || a.saved.portfolio)

  return `
    <div style="font-family:system-ui,-apple-system,sans-serif;max-width:640px">
      <h2 style="margin:0 0 18px;font-size:18px">새 디자이너 지원서가 접수되었습니다</h2>
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        ${rows
          .map(
            ([k, v]) => `<tr>
              <td style="padding:8px 0;color:#666;width:110px;vertical-align:top">${k}</td>
              <td style="padding:8px 0;line-height:1.7">${v}</td>
            </tr>`,
          )
          .join('')}
      </table>
      ${
        hasFiles
          ? `<p style="font-size:12px;color:#999;margin-top:14px">
               파일 링크는 7일간 유효합니다. 이후에는 어드민 지원서 화면에서 받을 수 있습니다.
             </p>`
          : ''
      }
      <p style="font-size:12px;color:#999;margin-top:24px">접수 번호: ${a.id}</p>
    </div>`
}
