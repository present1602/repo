import { NextResponse, type NextRequest } from 'next/server'
import { getAdminUser } from '@/lib/admin-auth'
import { supabaseAdmin, INQUIRY_FILES_BUCKET } from '@/lib/supabase-admin'
import { withDownloadName } from '@/lib/download-name'

/* 문의 첨부 내려받기(/admin/inquiries/file?id={문의}&i={몇 번째}) — 어드민만.

   접수 때 메일에 실은 서명 링크는 7일이면 만료되고, 내려받기 지정이 없어
   이미지·PDF 는 받지 않고 브라우저에서 열렸다. 누를 때마다 짧은 링크를 새로 만들고
   원래 파일 이름으로 내려받게(download) 해서 넘긴다.
   경로는 주소로 받지 않는다 — 문의에 남은 파일 목록에서 찾아 남의 파일을 고를 수 없게 */
export async function GET(req: NextRequest) {
  if (!(await getAdminUser()) || !supabaseAdmin) {
    return new NextResponse('권한이 없습니다.', { status: 403 })
  }

  const id = req.nextUrl.searchParams.get('id') ?? ''
  const i = Number(req.nextUrl.searchParams.get('i') ?? '0')

  const { data, error } = await supabaseAdmin.from('inquiries').select('files').eq('id', id).maybeSingle()
  const file = (data?.files as { name: string; path: string }[] | undefined)?.[i]
  if (error || !file) return new NextResponse('첨부를 찾을 수 없습니다.', { status: 404 })

  /* 1분이면 넘어가서 받기에 충분하다 — 주소가 새어도 곧 못 쓴다 */
  const { data: signed, error: signErr } = await supabaseAdmin.storage
    .from(INQUIRY_FILES_BUCKET)
    .createSignedUrl(file.path, 60)
  if (signErr || !signed) {
    console.error('[inquiry] 첨부 링크 생성 실패:', file.path, signErr?.message)
    return new NextResponse('파일을 열 수 없습니다. 저장소에서 지워졌을 수 있습니다.', { status: 404 })
  }

  return NextResponse.redirect(withDownloadName(signed.signedUrl, file.name))
}
