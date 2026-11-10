/* 사이트 주소 한 곳 — robots.ts·sitemap.ts·layout.tsx 가 같이 본다.

   검색 쪽에 내보내는 주소는 반드시 절대 URL 이어야 한다(sitemap 의 <loc>,
   robots 의 Sitemap:, og:image). 그래서 기본값을 운영 주소로 둔다 —
   환경 변수가 빠진 채 배포돼도 상대 주소가 나가지는 않게 한다.

   끝의 '/' 는 떼어 둔다. 붙은 채로 `${SITE_URL}/explore` 를 만들면
   '//explore' 가 되어 구글에게는 다른 주소로 보인다(중복 색인). */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://soom.it').replace(/\/+$/, '')
