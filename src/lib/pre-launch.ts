/* 공개 전(베타) 여부 — 탐색 링크(explore-gate.tsx)와 홈의 작업 자리(app/page.tsx)가 같이 본다.

   운영(soom.it)에서만 가린다 — dev.soom.it·로컬은 샘플 데이터를 그대로 보여 준다.
   NEXT_PUBLIC_PRE_LAUNCH 를 적으면 그 값('1'·'0')을 따르고, 없으면 사이트 주소로 가린다.
   정식 공개 때 운영 환경 변수에 NEXT_PUBLIC_PRE_LAUNCH=0 을 넣고 다시 배포하면 원래대로 돌아간다.

   'use client' 파일에 두지 않는다 — 서버 컴포넌트가 클라이언트 모듈에서 값을 가져오면
   진짜 값이 아니라 클라이언트 참조(늘 참)를 받아, 변수를 0 으로 둬도 홈이 계속 가려졌다. */
function preLaunch(): boolean {
  const flag = process.env.NEXT_PUBLIC_PRE_LAUNCH
  if (flag === '1' || flag === '0') return flag === '1'
  try {
    const host = new URL(process.env.NEXT_PUBLIC_SITE_URL ?? '').hostname
    return host === 'soom.it' || host === 'www.soom.it'
  } catch {
    return false
  }
}

export const PRE_LAUNCH = preLaunch()
