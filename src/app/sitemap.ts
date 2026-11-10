import type { MetadataRoute } from 'next'
import { INDEXABLE, SITE_URL } from '@/lib/site-url'
import { listPublicDesigners } from '@/lib/public-designers'

/* sitemap.xml — 구글에게 "이 사이트에 어떤 주소가 있는지" 목록으로 알려 준다.

   없으면 크롤러가 링크를 따라가며 스스로 찾아야 한다. 홈에서 탐색으로 가는
   링크는 공개 전(PRE_LAUNCH)에는 버튼으로 바뀌어 <a href> 가 아니므로
   (explore-gate.tsx), 사이트맵이 없으면 /explore 와 디자이너 상세로 가는
   길이 크롤러에게는 끊겨 있다. 이 파일이 그 길을 대신 알려 준다.

   디자이너 상세는 listPublicDesigners 에서 받는다 — visible + profile_public
   을 함께 걸어 둔 조회라(public-designers.ts) 숨긴 프로필이 섞이지 않는다.
   어드민 전용·토큰이 들어간 주소는 robots.ts 에서 막는다.

   DB 를 읽으므로 캐시하지 않는다 — 탐색 목록과 같은 이유다. 조회가 실패하면
   listPublicDesigners 가 빈 배열을 돌려주므로, 그때는 고정 페이지만 담긴
   사이트맵이 나간다. 사이트맵 전체가 500 으로 죽는 것보다 낫다. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  /* 운영이 아니면 빈 목록을 돌려준다 — dev 주소를 크롤러에게 건네지 않는다.
     DB 도 읽지 않는다(site-url.ts 의 INDEXABLE). */
  if (!INDEXABLE) return []

  const designers = await listPublicDesigners()

  return [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${SITE_URL}/explore`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/designers/apply`,
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${SITE_URL}/terms`,
      changeFrequency: 'yearly',
      priority: 0.2,
    },
    /* lastModified 를 적지 않는다 — 공개 카드(PublicDesignerCard)에는 수정
       시각이 없다. 지금 시각을 적으면 바뀐 적 없는 프로필까지 매번 "방금
       고쳐졌다"고 알리는 셈이 되어, 구글이 그 값을 믿지 않게 된다. */
    ...designers.map((d) => ({
      url: `${SITE_URL}/designers/${d.id}`,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
  ]
}
