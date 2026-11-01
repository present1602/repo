import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { isSearchable } from '@/lib/search-term'

/* 탐색 검색 — 디자이너 이메일의 @ 앞부분으로 찾는다.

   공개 목록은 이메일을 싣지 않는다(public-designers.ts) — 화면 HTML 에 모든
   디자이너의 메일 주소가 박히면 그대로 수집된다. 그래서 맞추기는 여기서 하고
   일치한 디자이너의 id 만 돌려준다. 이메일은 한 글자도 내보내지 않는다.

   이름·소개·분야 검색은 목록이 이미 들고 있어 브라우저에서 한다(designer-list.tsx).
   여기서는 이메일만 본다. */

/* 공개 화면과 같은 조건 — 숨긴 계정·비공개 프로필은 찾아 주지 않는다 */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get('q')?.trim() ?? ''

  /* 기준에 못 미치는 검색어는 묻지 않는다 — 'a' 로 모든 주소를 훑는 일을 막는다 */
  if (!isSearchable(q) || q.length > 64 || !supabaseAdmin) {
    return NextResponse.json({ ids: [] })
  }

  /* ilike 의 와일드카드(% _)와 \ 를 글자 그대로 찾게 바꾸고, @ 는 뺀다 —
     '%검색어%@%' 로 @ 앞에서만 맞춘다(주소에는 @ 가 하나뿐이다) */
  const term = q.replace(/@/g, '').replace(/[\\%_]/g, (c) => `\\${c}`)
  if (!term) return NextResponse.json({ ids: [] })

  const { data, error } = await supabaseAdmin
    .from('designers')
    .select('id')
    .eq('visible', true)
    .eq('profile_public', true)
    .ilike('email', `%${term}%@%`)
    .limit(50)

  if (error) {
    console.error('[search] 이메일 검색 실패:', error.message)
    return NextResponse.json({ ids: [] })
  }

  return NextResponse.json({ ids: (data ?? []).map((d) => d.id as string) })
}
