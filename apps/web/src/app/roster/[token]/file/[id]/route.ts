import { NextResponse, type NextRequest } from 'next/server'
import { findRosterLink, getRosterFile, previewRosterFile } from '@/lib/roster-db'
import { previewKind } from '@/lib/roster-shape'

/* 경력 페이지 포트폴리오 파일 미리보기 주소(/roster/{token}/file/{파일 id}).

   링크 페이지에서는 파일을 내려받게 하지 않는다 — 미리보기 다이얼로그(file-preview.tsx)가
   이 경로에서 짧은 수명의 주소를 받아 화면 안에서만 그린다.
   - 내려받기 지정(download)을 붙이지 않는다. 주소로 바로 넘기지도(redirect) 않는다 —
     주소창에 이 경로를 쳐도 파일이 받아지지 않는다.
   - 누를 때마다 링크가 살아 있는지, 이 파일의 디자이너가 그 링크로 보이는 사람인지 확인한다.
   열람 기록은 남기지 않는다 — 페이지를 연 것으로 이미 한 번 남았다. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string; id: string }> }) {
  const { token, id } = await params
  const no = (status: number, error: string) =>
    NextResponse.json({ error }, { status, headers: { 'cache-control': 'no-store' } })

  const open = await findRosterLink(token)
  if (open.kind === 'error') return no(500, open.error)
  if (open.kind === 'missing') return no(404, '없는 링크입니다.')
  if (open.kind !== 'ok') return no(403, '이 링크는 지금 열 수 없습니다. 담당자에게 문의해 주세요.')

  const file = await getRosterFile(id)
  const ids = open.link.designer_ids
  if (!file || (ids && !ids.includes(file.designer_id))) return no(404, '파일을 찾을 수 없습니다.')

  const kind = previewKind(file.name)
  if (!kind) return no(415, '미리보기를 지원하지 않는 형식입니다.')

  const url = await previewRosterFile(file, kind)
  if (!url) return no(404, '파일을 열 수 없습니다. 담당자에게 문의해 주세요.')

  return NextResponse.json({ url, kind, name: file.name }, { headers: { 'cache-control': 'no-store' } })
}
