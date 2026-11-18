/* 랜딩페이지 기본형과 추가 기능 가격 — 홈(가격 카드)과 소개(견적표)가 같이 본다.
   한쪽만 고치면 두 화면 금액이 어긋나므로 숫자는 여기에만 적는다.

   서버·클라이언트 양쪽에서 불러 쓰므로 'use client' 를 붙이지 않는다. */

/* 기본형 — was(줄 긋는 정가) → price(정상가) → 사례 게재 동의 시 caseDiscount 만큼 더 할인 */
export const LANDING_PRICE = {
  was: 490_000,
  price: 399_000,
  caseDiscount: 100_000,
} as const

/* 소개 견적표의 '랜딩페이지 기본형' 줄 아래 짧은 목록 */
export const LANDING_BASE_POINTS = [
  '원페이지 최대 8섹션',
  '반응형 (PC · 태블릿 · 모바일)',
  '상담 문의 기능',
  '1년 무상 배포·서버 관리',
] as const

export const LANDING_INCLUDES = [
  { title: '최대 8섹션 원페이지 반응형웹', note: 'PC·태블릿·모바일 완벽 대응' },
  { title: '상담 문의 기능', note: '문의를 이메일로 연동해 받습니다.' },
  { title: '메인 시안 2종 / 수정 3회', note: '' },
  { title: '1년 무상 배포·서버 관리', note: '1년간 무료로 서버 관리를 해드립니다.' },
] as const

/* 일반 웹사이트·프리미엄 — 기능을 골라 더하는 대신 상담으로 견적을 정한다.
   홈 가격 카드(app/page.tsx)와 소개 견적표가 같은 숫자를 쓴다. */
export const WEBSITE_PRICE = {
  was: 1_490_000,
  price: 990_000,
  caseDiscount: 100_000,
} as const

export const PREMIUM_PRICE = {
  was: 5_000_000,
  price: 2_990_000,
} as const

export type SiteKind = 'landing' | 'website' | 'premium'

/* 견적표 맨 위 유형 고르기. landing 만 아래에서 기능을 골라 더한다 */
export const SITE_KINDS: {
  id: SiteKind
  label: string
  price: number
  tagline: string
  /* website·premium — 기본 제공 범위. note 는 그 줄 아래 작은 회색 글씨 */
  includes?: readonly (string | { title: string; note: string })[]
  /* website·premium — 의뢰 폼 '견적표에서 고른 구성'에 들어가는 이름 */
  inquiryLabel?: string
}[] = [
  {
    id: 'landing',
    label: '랜딩페이지',
    price: LANDING_PRICE.price,
    tagline: '랜딩페이지는 기본적으로 원페이지 반응형 웹사이트입니다.',
  },
  {
    id: 'website',
    label: '일반 웹사이트 / 기업형 홈페이지',
    price: WEBSITE_PRICE.price,
    tagline: '기업 홍보에 적합한 가장 일반적인 홈페이지',
    inquiryLabel: '일반 웹사이트 / 기업형 홈페이지',
    includes: [
      {
        title: '총 40페이지 이내 범위까지 기본 개발 제공',
        note: '10페이지 이상 시 추가비용이 발생할 수 있습니다 (관리자를 제외한 고객단 페이지 수 기준)',
      },
      'FAQ 관리 · 팝업 · 기본 관리자페이지',
      {
        title: '회원관리 또는 콘텐츠 관리 기본 제공',
        note: '복잡한 설계가 요구되는 회원관리나 콘텐츠관리는 추가 비용이 발생됩니다',
      },
      '반응형 (PC · 태블릿 · 모바일)',
    ],
  },
  {
    id: 'premium',
    label: '프리미엄 맞춤형 홈페이지',
    price: PREMIUM_PRICE.price,
    tagline: '기획부터 기능까지 원하는 대로 맞춰 만듭니다',
    inquiryLabel: '프리미엄 맞춤형 홈페이지',
    includes: [
      '페이지 수 무제한',
      '고도화된 설계가 요구되는 기능도 맞춤 기획/개발',
      '반응형 (PC · 태블릿 · 모바일)',
      '50만원 상당의 상세페이지 디자인 쿠폰 제공',
    ],
  },
]

/* 소개 화면 '의뢰하기'가 골라 두는 의뢰 분야 — 어드민 분야 이름과 같아야 한다.
   이름이 바뀌어 못 찾으면 고르지 않은 채 열릴 뿐 의뢰는 그대로 된다 */
export const ABOUT_INQUIRY_CATEGORY = '웹사이트 개발'

/* 소개 화면의 SOOM 의뢰 유형 — 위 탭 차례이자 아래 구역 차례다(id 는 구역의 id).
   이 중 웹사이트 개발만 견적표(SITE_KINDS)로 나뉜다 */
export const SERVICES = [
  { id: 'service-website', label: '웹사이트 개발' },
  { id: 'service-app', label: '앱 디자인' },
  { id: 'service-detail', label: '상세페이지 디자인' },
] as const

/* 앱·상세페이지 구역의 '의뢰하기'가 골라 둘 분야 — 어드민 분야 이름과 같아야 한다 */
export const APP_INQUIRY_CATEGORY = '모바일앱(디자인)'
export const DETAIL_INQUIRY_CATEGORY = '상세페이지'

/* 상세페이지 구역에 띄우는 모션배너 예시(유튜브 쇼츠 id) */
export const MOTION_BANNER_VIDEO = 'ysnjN5N7BzM'

/* 웹사이트·프리미엄 견적 안내 — 랜딩페이지 옵션도 더할 수 있음을 알린다 */
export const CONSULT_NOTE =
  '**랜딩페이지에 제공되는 옵션들도 모두 결합 가능하고, 추가로 특화된 기능/복잡한 시스템도 개발 가능해요. 작업범위에 따라 구체적인 견적이 산정됩니다.'

export type AddOnGroup = 'content' | 'customer' | 'custom'

export type AddOn = {
  id: string
  group: AddOnGroup
  title: string
  price: number
  /* 범위로 받는 항목(회원가입)의 최대 금액 */
  maxPrice?: number
  /* 맞춤 개발처럼 상담 뒤 금액이 오를 수 있는 항목 — 금액 뒤에 '~' */
  startingAt?: boolean
  summary: string
  points?: readonly string[]
  /* 이 항목을 고르면 함께 들어가야 하는 항목 */
  requires?: string
  /* 카드 아래 작은 글씨 안내 */
  note?: string
}

export const ADD_ON_GROUPS: { id: AddOnGroup; label: string; hint: string }[] = [
  { id: 'content', label: '콘텐츠를 직접 관리하고 싶다면,', hint: '관리자페이지' },
  { id: 'customer', label: '고객을 모으고 싶다면', hint: '구독 · 메일 · 회원' },
  { id: 'custom', label: '우리 업종에 꼭 맞는 기능이 필요하다면', hint: '프리미엄 맞춤 개발' },
]

export const ADD_ONS: readonly AddOn[] = [
  {
    id: 'cms',
    group: 'content',
    title: '콘텐츠 관리 시스템',
    price: 200_000,
    summary: '사이트 속 콘텐츠를 관리자페이지를 통해 바꿀 수 있습니다.',
    points: ['콘텐츠 이미지 자유롭게 교체', '카테고리 편집', '영상도 가능'],
  },
  {
    id: 'board',
    group: 'content',
    title: 'FAQ · 팝업 ·공지사항',
    price: 100_000,
    summary: '',
    note: '내용이 고정된 FAQ 섹션을 무료이며. 관리자페이지를 통한 내용 편집 기능을 개발 시에만 추가비용이 발생됩니다.',
  },
  {
    id: 'subscribe',
    group: 'customer',
    title: '뉴스레터',
    price: 100_000,
    startingAt: true,
    summary:
      '뉴스레터 메일을 수집받고 관리자페이지에서 소식 메일을 발송합니다',
    points: ['기본 관리자페이지 제공'],
  },
  {
    id: 'member',
    group: 'customer',
    title: '회원가입 · 로그인',
    price: 200_000,
    maxPrice: 500_000,
    summary: '',
    points: ['구글 로그인', '카카오 로그인', '네이버 로그인', '자체 회원가입'],
    note: '관리자페이지에서 회원관리기능 및 이메일 가입방식의 경우 마케팅 메일 발송 기능이 함께 제공됩니다.',
  },
  {
    id: 'booking',
    group: 'custom',
    title: '맞춤형 예약 시스템',
    price: 300_000,
    startingAt: true,
    summary: '',
    points: ['기본 관리자페이지 제공', '예약 확인 이메일', '구글 캘린더 연동', '알림톡 연동'],
  },
  {
    id: 'chatbot',
    group: 'custom',
    title: '챗봇 기능',
    price: 250_000,
    startingAt: true,
    summary: '방문자의 자주 묻는 질문에 사이트가 바로 답합니다. 예약 연동 등 맞춤형 기능 혼합도 가능합니다.',
    points: ['기본 관리자페이지 제공'],
  },
  {
    id: 'app',
    group: 'custom',
    title: '앱 동시 제작',
    price: 500_000,
    startingAt: true,
    summary: '웹사이트와 함께 안드로이드/ios 앱도 함께 만듭니다.',
  },
]

/* 견적표 아래 이벤트 — 합계에서 이만큼 더 내려간다(LANDING_PRICE.caseDiscount 와 같은 금액) */
export const ESTIMATE_EVENT_LABEL = '11월 한정 10만원 추가할인 이벤트 (선착순 5팀)'

/* 견적 예시 — 고르면 아래 견적표가 그 구성으로 바뀐다 */
export const ESTIMATE_PRESETS: { label: string; ids: readonly string[] }[] = [
  { label: '기본형만', ids: [] },
  { label: '콘텐츠 관리', ids: ['cms', 'board'] },
  { label: '고객을 모으는 사이트', ids: ['cms', 'subscribe'] },
  { label: '예약을 받는 공간', ids: ['cms', 'booking'] },
]

export const SAMPLE_SITE_URL = 'https://gyeol-space-demo.vercel.app'

export const manwon = (n: number) => `${n / 10_000}만원`
export const won = (n: number) => `${n.toLocaleString('ko-KR')}원`
