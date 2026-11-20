import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { REF_PARAM, isRefCode } from '@/lib/invite-link'

/* 디자이너 초대 링크(/r/{코드}) — 그 디자이너 상세 페이지로 코드를 달고 넘긴다.
   코드 기억은 상세 페이지의 RefCapture 가, 맞는지 확인은 의뢰 접수(api/inquiry)가 한다.
   모르는 코드면 첫 화면으로 보낸다 — 링크를 받은 고객에게 오류 화면을 보이지 않게 */
export async function GET(req: NextRequest, ctx: RouteContext<'/r/[code]'>) {
  const { code: raw } = await ctx.params
  const code = raw.trim().toLowerCase()
  const home = NextResponse.redirect(new URL('/', req.url))
  if (!isRefCode(code) || !supabaseAdmin) return home

  const { data, error } = await supabaseAdmin.from('designers').select('id').eq('ref_code', code).maybeSingle()
  if (error) console.error('[ref] 초대 코드 조회 실패(0006 전?):', error.message)
  if (!data) return home

  return NextResponse.redirect(new URL(`/designers/${data.id}?${REF_PARAM}=${code}`, req.url))
}
