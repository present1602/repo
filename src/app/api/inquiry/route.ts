import { NextResponse } from 'next/server'
import { sendAdminMail } from '@/lib/admin-mail'
import { supabaseAdmin, supabaseConfigured, INQUIRY_FILES_BUCKET } from '@/lib/supabase-admin'
import { allowedEmails } from '@/lib/admin-auth'
import { INQUIRY_TYPE_SCOPE, isInquiryPlanTier, type InquiryType } from '@/lib/inquiry-types'
import { SCOPE_INQUIRY_TYPE, isInquiryScope, scopesOf } from '@/lib/inquiry-choices'
import { getPlanCopies } from '@/lib/site-settings'
import { listCategoryMetas } from '@/lib/specialties'
import { priceOf } from '@/lib/specialty-shape'
import { withDownloadName } from '@/lib/download-name'
import { claimInquiryFile, fileProblem, safeName } from '@/lib/inquiry-files'

/* 의뢰 문의 접수.

   로그인 없이 누구나 보낸다 — 들어온 값을 하나도 믿지 않고 여기서 다시 센다.

   순서가 중요하다: 파일을 올리고 → DB 에 남기고 → 메일을 보낸다.
   메일이 실패해도 접수는 이미 저장돼 있어 어드민 화면에서 볼 수 있다.
   반대로 메일을 먼저 보내면, 저장에 실패했을 때 "받았다고 했는데 기록이
   없는" 상태가 된다. */

/* 20MB 업로드가 섞이면 기본 시간 안에 못 끝낼 수 있다.
   runtime 은 적지 않는다 — 이 프로젝트의 cacheComponents 설정과
   함께 쓸 수 없고, 기본값인 Node 런타임이면 충분하다. */
export const maxDuration = 60

/* 첨부 정책 — 개수는 화면(form-bits.tsx 의 FileField max)과 같고,
   형식·크기는 inquiry-files.ts 가 정한다 */
const MAX_FILES = 1


/* 메일 속 다운로드 링크 유효기간 — 7일.
   첨부는 사업 자료일 수 있어 길게 열어두지 않는다. 만료 후에도 파일은
   Storage 에 남아 있고, 대시보드에서 새 링크를 만들 수 있다. */
const SIGNED_URL_TTL = 60 * 60 * 24 * 7

const FROM = process.env.MAIL_FROM_EMAIL ?? 'onboarding@resend.dev'

type Uploaded = { name: string; path: string; url: string; size: number }

/* 메일 본문에 들어가는 사용자 입력을 막는다 — 그대로 넣으면
   태그가 살아나 본문이 깨지거나 엉뚱한 링크가 심긴다. */
function esc(s: string) {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  )
}

function bad(error: string, status = 400) {
  return NextResponse.json({ ok: false, error }, { status })
}

export async function POST(req: Request) {
  try {
    const form = await req.formData()

    /* 봇만 채우는 숨은 칸 — 조용히 성공으로 돌려보낸다.
       막혔다고 알려주면 다음에는 피해서 채운다. */
    if (String(form.get('company_website') ?? '').trim()) {
      return NextResponse.json({ ok: true })
    }

    const name = String(form.get('name') ?? '').trim()
    const email = String(form.get('email') ?? '').trim()
    const phone = String(form.get('phone') ?? '').trim()
    const message = String(form.get('message') ?? '').trim()
    /* 분야와 범위(0003_inquiry_category.sql) — 화면이 보낸 값을 그대로 믿지 않고
       아래에서 분야 설정과 맞춰 본다. 범위는 inquiry_type 글자로 남는다 */
    const category = String(form.get('category') ?? '').trim()
    const rawScope = String(form.get('scope') ?? '').trim()
    const scope = isInquiryScope(rawScope) ? rawScope : null
    /* 메인 시안을 본계약 옵션으로 골랐을 때 염두에 둔 본계약(디자인만·디자인 + 개발) — 메일에만 적는다 */
    const rawMain = String(form.get('mainScope') ?? '').trim()
    /* 기본·프리미엄 — 프리미엄이 있는 유형을 골랐을 때만 온다. 그 밖에는 null */
    const rawTier = String(form.get('planTier') ?? '').trim()
    const planTier = isInquiryPlanTier(rawTier) ? rawTier : null
    const designerId = String(form.get('designerId') ?? '').trim()
    let designerName = String(form.get('designerName') ?? '').trim()
    const submitKey = String(form.get('submitKey') ?? '').trim()
    const ref = String(form.get('ref') ?? '').trim().slice(0, 40)

    if (!name || !email || !phone || !message) {
      return bad('성함, 이메일, 연락처, 문의내용은 필수입니다.')
    }

    /* 분야가 하나라도 있으면 분야·범위를 골라야 한다. 분야가 아예 없으면(설정 전)
       고를 것이 없었으므로 유형 없이 받는다 */
    /* 의뢰 유형은 탐색 메뉴에 나오는 분야뿐이다 — 숨긴 분야는 받지 않는다 */
    const metas = (await listCategoryMetas()).filter((m) => m.visible)
    let inquiryType: InquiryType | null = null
    let mainType: InquiryType | null = null
    if (metas.length > 0) {
      const meta = metas.find((m) => m.name === category)
      if (!meta) return bad('무엇을 만드는지 골라 주세요. 새로고침 후 다시 시도해 주세요.')
      if (!scope || !scopesOf(meta).includes(scope)) {
        return bad('맡길 범위를 골라 주세요.')
      }
      inquiryType = SCOPE_INQUIRY_TYPE[scope]
      if (scope === 'sample' && isInquiryScope(rawMain) && rawMain !== 'sample' && scopesOf(meta).includes(rawMain)) {
        /* 그 범위에서 메인 시안 옵션을 뺀 분야(0013) — 예전 화면이나 직접 보낸 요청을 막는다 */
        if (!priceOf(meta.prices, rawMain, 'basic').allowSample) {
          return bad('이 의뢰에는 메인화면 먼저 의뢰를 붙일 수 없습니다. 새로고침 후 다시 골라 주세요.')
        }
        mainType = SCOPE_INQUIRY_TYPE[rawMain]
      }
      /* 사이트에서 숨긴 플랜은 받지 않는다 — 화면에서 뺐어도 예전 화면이나 직접 보낸 요청이 올 수 있다 */
      if (!(await getPlanCopies())[INQUIRY_TYPE_SCOPE[inquiryType]].visible) {
        return bad('지금은 받지 않는 의뢰 유형입니다. 새로고침 후 다시 골라 주세요.')
      }
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return bad('이메일 주소를 확인해 주세요.')
    }
    /* 연락처는 형식을 묶지 않는다 — 02-123-4567, +82 10-…, 내선처럼
       모양이 제각각이라 정규식으로 막으면 멀쩡한 번호가 거부된다.
       숫자가 하나도 없으면 번호가 아니므로 그것만 본다. */
    if (!/\d/.test(phone)) {
      return bad('연락처를 확인해 주세요.')
    }
    /* DB check 제약과 같은 값 — 거부되면 뭉뚱그린 오류만 남는다 */
    if (name.length > 100 || email.length > 200 || phone.length > 40 || message.length > 5000) {
      return bad('입력이 너무 깁니다. 줄여서 다시 보내 주세요.')
    }

    if (!supabaseConfigured || !supabaseAdmin) {
      /* 설정이 없으면 접수를 잃는다 — 로그에라도 남긴다 */
      console.error('[inquiry] Supabase 미설정 — 접수 내용:', { name, email, message })
      return bad('서버 설정이 완료되지 않았습니다. 잠시 후 다시 시도해 주세요.', 503)
    }
    const db = supabaseAdmin

    /* 공개 화면은 이름 가운데를 가려 보낸다(김*연) — 어드민 목록·메일에는
       실명이 남도록 id 로 다시 찾는다. 못 찾으면 받은 값을 그대로 둔다. */
    if (designerId) {
      const { data: d } = await db.from('designers').select('name').eq('id', designerId).maybeSingle()
      const real = (d?.name as string | null | undefined)?.trim()
      if (real) designerName = real
    }

    /* 초대 링크(0006) — 받는 디자이너의 코드와 같을 때만 초대로 친다.
       다른 디자이너 링크로 들어왔거나 지어낸 코드면 그냥 일반 의뢰다 */
    let viaRef = false
    if (designerId && ref) {
      const { data: d, error: refErr } = await db
        .from('designers')
        .select('ref_code')
        .eq('id', designerId)
        .maybeSingle()
      if (refErr) console.warn('[inquiry] 초대 코드 확인 실패(0006 전?):', refErr.message)
      viaRef = d?.ref_code === ref
    }

    /* 이미 받은 접수면 파일도 메일도 다시 처리하지 않는다.
       보낸 쪽에는 성공으로 보여야 "또 눌러보는" 일이 없다. */
    if (submitKey) {
      const { data: dup } = await db
        .from('inquiries')
        .select('id')
        .eq('submit_key', submitKey)
        .maybeSingle()
      if (dup) return NextResponse.json({ ok: true, duplicate: true })
    }

    /* ── 첨부 검사 ── */
    /* 지금 화면은 파일을 Storage 에 먼저 올리고 경로만 보낸다(attachmentPath, inquiry-files.ts).
       예전 화면이 파일을 그대로 실어 보내도 받는다 — 작은 파일은 Vercel 한도 안이라 닿는다 */
    const files = form
      .getAll('attachment')
      .filter((f): f is File => f instanceof File && f.size > 0)
    const sentPath = String(form.get('attachmentPath') ?? '').trim()
    const sentName = String(form.get('attachmentName') ?? '').trim().slice(0, 200)

    if (files.length + (sentPath ? 1 : 0) > MAX_FILES) {
      return bad(`파일은 ${MAX_FILES}개만 첨부할 수 있습니다.`)
    }
    for (const file of files) {
      const problem = fileProblem(file.name, file.size)
      if (problem) return bad(problem)
    }
    const preUploaded = sentPath ? await claimInquiryFile(sentPath, sentName) : null
    if (sentPath && (!preUploaded || fileProblem(sentName, preUploaded.size))) {
      return bad('첨부 파일을 확인하지 못했습니다. 파일을 다시 골라 보내 주세요.')
    }

    /* ── Storage 업로드 ── */
    const uploaded: Uploaded[] = []
    const stamp = new Date().toISOString().slice(0, 10)
    const linkOf = async (path: string, name: string) => {
      const { data: signed } = await db.storage.from(INQUIRY_FILES_BUCKET).createSignedUrl(path, SIGNED_URL_TTL)
      /* 원래 이름으로 내려받게 — 지정이 없으면 이미지·PDF 는 브라우저에서 열리기만 한다 */
      return signed?.signedUrl ? withDownloadName(signed.signedUrl, name) : ''
    }

    if (sentPath && preUploaded) {
      uploaded.push({ name: sentName, path: sentPath, url: await linkOf(sentPath, sentName), size: preUploaded.size })
    }

    for (const file of files) {
      const path = `${stamp}/${crypto.randomUUID()}-${safeName(file.name)}`
      const { error: upErr } = await db.storage
        .from(INQUIRY_FILES_BUCKET)
        .upload(path, file, { contentType: file.type || undefined, upsert: false })

      if (upErr) {
        console.error('[inquiry] 파일 업로드 실패:', file.name, upErr.message)
        /* 버킷이 없을 때가 가장 흔하다 — 마이그레이션을 돌리지 않은 경우 */
        if (/bucket/i.test(upErr.message)) {
          return bad('첨부 저장소가 준비되지 않았습니다. 관리자에게 알려 주세요.', 503)
        }
        return bad('파일 업로드에 실패했습니다. 잠시 후 다시 시도해 주세요.', 500)
      }

      uploaded.push({ name: file.name, path, url: await linkOf(path, file.name), size: file.size })
    }

    /* ── DB 저장: 여기까지 왔으면 접수는 안전하다 ── */
    const fields = {
      name,
      email,
      phone,
      message,
      inquiry_type: inquiryType,
      /* 036 전 DB 에는 칸이 없다 — 그때는 프리미엄이 공개되지 않아 값도 오지 않는다 */
      ...(planTier ? { plan_tier: planTier } : {}),
      designer_id: designerId || null,
      designer_name: designerName || null,
      files: uploaded,
      submit_key: submitKey || null,
      /* 0006 전 DB 에는 칸이 없다 — 그때는 코드도 맞을 수 없어 값이 붙지 않는다 */
      ...(viaRef ? { via_ref: true } : {}),
    }
    const insert = (row: Record<string, unknown>) =>
      db.from('inquiries').insert(row).select('id').single()

    let { data: row, error: dbErr } = await insert(
      inquiryType ? { ...fields, category } : fields,
    )
    /* 0003 전 DB 에는 category 칸이 없다 — 접수를 잃지 않게 분야 없이 다시 넣는다 */
    if (dbErr?.message.includes('category')) {
      console.warn('[inquiry] category 칸 없음(0003 전) — 분야 없이 저장:', category)
      ;({ data: row, error: dbErr } = await insert(fields))
    }

    if (dbErr || !row) {
      /* 유니크 제약 위반 = 동시에 들어온 중복 제출 */
      if (dbErr?.code === '23505') {
        return NextResponse.json({ ok: true, duplicate: true })
      }
      console.error('[inquiry] DB 저장 실패 — 접수 내용:', {
        name, email, message, designerName, uploaded, error: dbErr?.message,
      })
      /* 012 마이그레이션 전이면 테이블이 없다 */
      if (/inquiries/i.test(dbErr?.message ?? '')) {
        return bad('문의 접수가 아직 준비되지 않았습니다. 관리자에게 알려 주세요.', 503)
      }
      return bad('접수 처리에 실패했습니다. 잠시 후 다시 시도해 주세요.', 500)
    }

    /* ── 알림 메일 ──
       DB 에 이미 남았으므로 메일이 실패해도 접수는 성공으로 돌려준다.
       실패는 로그로 남기고, mailed 컬럼으로 못 나간 건을 찾을 수 있다. */
    const to = allowedEmails()
    let mailed = false

    /* 분야·범위를 한 줄로, 프리미엄을 골랐으면 그 옆에 — 메일 제목만 보고도 견적이 갈린다 */
    const typeLabel =
      [
        inquiryType ? category : '',
        (inquiryType ?? '일반 문의') + (mainType ? ` → ${mainType}` : ''),
        planTier === 'premium' ? '프리미엄' : '',
      ]
        .filter(Boolean)
        .join(' · ')

    if (process.env.RESEND_API_KEY && to.length > 0) {
      try {
        await sendAdminMail({
          from: `soom 문의 <${FROM}>`,
          to,
          /* 답장을 누르면 바로 문의한 사람에게 간다 */
          replyTo: email,
          subject: designerName
            ? `[${typeLabel}] ${name} → ${designerName}${viaRef ? ' (초대 링크)' : ''}`
            : `[${typeLabel}] ${name}`,
          html: mailHtml({
            id: row.id as string,
            name,
            email,
            phone,
            message,
            inquiryType: typeLabel,
            designerName,
            viaRef,
            uploaded,
          }),
        })

        mailed = true
        await db.from('inquiries').update({ mailed: true }).eq('id', row.id)
      } catch (mailErr) {
        console.error('[inquiry] 메일 전송 실패 (접수는 저장됨):', row.id, mailErr)
      }
    } else {
      console.warn('[inquiry] 메일 미설정 — 접수만 저장됨:', row.id)
    }

    return NextResponse.json({ ok: true, id: row.id, files: uploaded.length, mailed })
  } catch (err) {
    console.error('[inquiry] 처리 실패:', err)
    return bad('전송 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.', 500)
  }
}

/* 알림 메일 본문 */
function mailHtml({
  id,
  name,
  email,
  phone,
  message,
  inquiryType,
  designerName,
  viaRef,
  uploaded,
}: {
  id: string
  name: string
  email: string
  phone: string
  message: string
  inquiryType: string
  designerName: string
  viaRef: boolean
  uploaded: Uploaded[]
}) {
  const rows: [string, string][] = [
    ['의뢰 유형', inquiryType],
    ['성함 / 회사명', name],
    ['이메일', email],
    ['연락처', phone],
    ['받는 디자이너', designerName ? `${designerName}${viaRef ? ' · 초대 링크로 온 의뢰' : ''}` : '지정 안 함'],
  ]

  return `
    <div style="font-family:system-ui,-apple-system,sans-serif;max-width:640px">
      <h2 style="margin:0 0 18px;font-size:18px">새 의뢰 문의가 접수되었습니다</h2>
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        ${rows
          .map(
            ([k, v]) => `<tr>
              <td style="padding:8px 0;color:#666;width:130px;vertical-align:top">${k}</td>
              <td style="padding:8px 0">${esc(v)}</td>
            </tr>`,
          )
          .join('')}
      </table>

      <h3 style="margin:22px 0 8px;font-size:15px">문의 내용</h3>
      <p style="white-space:pre-wrap;font-size:14px;line-height:1.7;margin:0">${esc(message)}</p>

      ${
        uploaded.length > 0
          ? `<h3 style="margin:22px 0 8px;font-size:15px">첨부 파일</h3>
             <ul style="font-size:14px;line-height:1.8;padding-left:18px;margin:0">
               ${uploaded
                 .map(
                   (f) =>
                     `<li><a href="${f.url}">${esc(f.name)}</a> (${(f.size / 1024 / 1024).toFixed(1)}MB)</li>`,
                 )
                 .join('')}
             </ul>
             <p style="font-size:12px;color:#999;margin-top:10px">
               링크는 7일간 유효합니다. 이후에도 파일은 보관되며,
               Supabase 대시보드에서 다시 받을 수 있습니다.
             </p>`
          : ''
      }

      <p style="font-size:12px;color:#999;margin-top:24px">접수 번호: ${id}</p>
    </div>`
}
