import { NextResponse } from 'next/server'
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
  fileExt,
  type ApplicationFile,
  type ApplicationFileKind,
} from '@/lib/application-shape'

/* 디자이너 지원서 접수(021_designer_applications.sql).

   파일은 이 라우트를 거치지 않는다 — 포트폴리오 PDF 는 수십 MB 인데
   서버리스 함수는 요청 본문이 몇 MB 에서 잘린다. 대신 두 번 부른다:

     prepare  이름·이메일·파일 정보를 검사하고, 파일마다 서명 업로드
              주소를 만들어 준다. 브라우저가 그 주소로 Storage 에 바로 올린다.
     submit   올라간 파일이 실제로 있는지 Storage 에서 확인한 뒤 DB 에 남긴다.

   로그인 없이 누구나 부르므로 들어온 값을 하나도 믿지 않는다.
   파일 크기는 버킷의 file_size_limit 가 최종으로 막는다. */

type FileMeta = { name: string; size: number }

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

  const files = {} as Record<ApplicationFileKind, FileMeta>
  for (const kind of APPLICATION_FILE_KINDS) {
    const f = raw[kind]
    const label = APPLICATION_FILE_LABELS[kind]
    const fname = String(f?.name ?? '').trim()
    const size = Number(f?.size ?? 0)
    if (!fname || !size) return { error: `${label} 파일을 첨부해 주세요.` }
    if (size > MAX_APPLICATION_FILE_BYTES) return { error: `${label} 파일은 30MB를 넘을 수 없습니다.` }
    if (!APPLICATION_FILE_EXT.includes(fileExt(fname))) {
      return { error: `${label}: 허용되지 않는 형식입니다 (${fname})` }
    }
    files[kind] = { name: fname.slice(0, 200), size }
  }

  return { name, email, submitKey, files }
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
    const { name, email, submitKey, files } = input

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
      const uploads = {} as Record<ApplicationFileKind, { path: string; token: string }>
      for (const kind of APPLICATION_FILE_KINDS) {
        const path = pathOf(submitKey, kind, files[kind].name)
        /* upsert — 업로드 도중 실패해 다시 누르면 같은 경로에 덮어쓴다 */
        const { data, error } = await bucket.createSignedUploadUrl(path, { upsert: true })
        if (error || !data) {
          console.error('[apply] 업로드 주소 생성 실패:', error?.message)
          if (error && /bucket/i.test(error.message)) {
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
    const { data: listed, error: listErr } = await bucket.list(submitKey)
    if (listErr) {
      console.error('[apply] 업로드 확인 실패:', listErr.message)
      return bad('업로드를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.', 500)
    }

    const saved = {} as Record<ApplicationFileKind, ApplicationFile>
    for (const kind of APPLICATION_FILE_KINDS) {
      const path = pathOf(submitKey, kind, files[kind].name)
      const obj = listed?.find((o) => `${submitKey}/${o.name}` === path)
      const size = Number(obj?.metadata?.size ?? 0)
      if (!obj || !size) {
        return bad(`${APPLICATION_FILE_LABELS[kind]} 파일이 올라가지 않았습니다. 다시 시도해 주세요.`)
      }
      saved[kind] = { name: files[kind].name, path, size }
    }

    const { error: dbErr } = await db.from('designer_applications').insert({
      name,
      email,
      resume: saved.resume,
      portfolio: saved.portfolio,
      submit_key: submitKey,
    })

    if (dbErr) {
      /* 유니크 제약 위반 = 동시에 들어온 중복 제출 */
      if (dbErr.code === '23505') return NextResponse.json({ ok: true, duplicate: true })
      console.error('[apply] DB 저장 실패 — 지원자:', { name, email, saved, error: dbErr.message })
      if (/designer_applications/i.test(dbErr.message)) {
        return bad('지원 접수가 아직 준비되지 않았습니다. 관리자에게 알려 주세요.', 503)
      }
      return bad('접수 처리에 실패했습니다. 잠시 후 다시 시도해 주세요.', 500)
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[apply] 처리 실패:', err)
    return bad('전송 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.', 500)
  }
}
