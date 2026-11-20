import { NextResponse, type NextRequest } from 'next/server'
import { getAdminUser } from '@/lib/admin-auth'
import { getRosterFile, signRosterFile } from '@/lib/roster-db'

/* 경력 페이지 포트폴리오 파일 확인용 내려받기(/admin/roster/file?id={파일 id}) — 어드민만.
   inquiries/file 과 같게 누를 때마다 1분짜리 서명 주소를 만든다. */
export async function GET(req: NextRequest) {
  if (!(await getAdminUser())) return new NextResponse('권한이 없습니다.', { status: 403 })

  const file = await getRosterFile(req.nextUrl.searchParams.get('id') ?? '')
  if (!file) return new NextResponse('파일을 찾을 수 없습니다.', { status: 404 })

  const url = await signRosterFile(file)
  if (!url) return new NextResponse('파일을 열 수 없습니다. 저장소에서 지워졌을 수 있습니다.', { status: 404 })
  return NextResponse.redirect(url)
}
