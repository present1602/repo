import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/site-url'

/* robots.txt — 크롤러에게 "어디까지 봐도 되는지"를 알려 준다.

   없으면 /robots.txt 가 404 가 되고, 사이트맵 위치를 알릴 자리도 사라진다.

   막는 곳은 검색 결과에 떠서는 안 되는 길들이다:
     /admin     어드민 화면
     /api       JSON 응답 — 사람이 읽을 화면이 아니다
     /studio    디자이너 본인 작업실(로그인 뒤)
     /auth      로그인 콜백
     /r         초대 링크 — 코드가 들어간 일회용 주소다
     /review    리뷰 작성 링크(토큰)
     디자이너 상세의 preview  어드민 미리보기(본 화면과 내용이 겹친다)

   Disallow 는 "크롤링하지 말라"는 뜻이고 색인 금지 보장은 아니다 —
   토큰이 들어간 /r·/review 는 애초에 남이 알 수 없는 주소라 이 정도로 둔다. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/api', '/studio', '/auth', '/r/', '/review/', '/designers/*/preview'],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
