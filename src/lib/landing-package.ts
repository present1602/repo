/* 랜딩페이지 기본형과 추가 기능 가격 — 홈(가격 카드)과 소개(견적표)가 같이 본다.
   한쪽만 고치면 두 화면 금액이 어긋나므로 숫자는 여기에만 적는다.

   서버·클라이언트 양쪽에서 불러 쓰므로 'use client' 를 붙이지 않는다. */

/* 기본형 — was(줄 긋는 정가) → price(정상가) → 사례 게재 동의 시 caseDiscount 만큼 더 할인 */
export const LANDING_PRICE = {
  was: 490_000,
  price: 399_000,
  caseDiscount: 100_000,
} as const

export const LANDING_INCLUDES = [
  { title: '최대 8섹션 원페이지 반응형 웹사이트', note: 'PC·태블릿·모바일 화면에 맞춰 보입니다' },
  { title: '상담 문의 기능', note: '문의가 들어오면 이메일로 바로 받아 봅니다' },
  { title: '소셜 채널 링크 연동', note: '인스타그램·블로그·카카오 채널 등으로 이어집니다' },
  { title: '메인 시안 2종', note: '두 가지 시안 중 마음에 드는 쪽을 고릅니다' },
  { title: '수정 3회', note: '고른 시안을 3번까지 고칠 수 있습니다' },
  { title: '1년 무상 배포·서버 관리', note: '사이트 공개부터 서버 대응까지 1년간 맡아 드립니다' },
] as const

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
}

export const ADD_ON_GROUPS: { id: AddOnGroup; label: string; hint: string }[] = [
  { id: 'content', label: '내용을 직접 고치고 싶다면', hint: '관리자페이지' },
  { id: 'customer', label: '고객을 모으고 싶다면', hint: '구독 · 메일 · 회원' },
  { id: 'custom', label: '우리 업종에 꼭 맞는 기능이 필요하다면', hint: '프리미엄 맞춤 개발' },
]

export const ADD_ONS: readonly AddOn[] = [
  {
    id: 'cms',
    group: 'content',
    title: '콘텐츠 관리 시스템',
    price: 200_000,
    summary: '기본 관리자페이지를 드립니다. 개발자 없이도 사이트 속 콘텐츠를 직접 바꿀 수 있습니다.',
    points: ['콘텐츠 이미지 추가', '카테고리 편집', '글 내용 자유롭게 수정'],
  },
  {
    id: 'board',
    group: 'content',
    title: 'FAQ · 팝업 공지사항',
    price: 100_000,
    summary: '자주 묻는 질문과 팝업 공지를 관리자페이지에서 올리고 고칩니다.',
  },
  {
    id: 'subscribe',
    group: 'customer',
    title: '이메일 구독',
    price: 50_000,
    summary: '방문자가 이메일을 남기면, 구독자 목록을 관리자페이지에서 확인합니다.',
  },
  {
    id: 'newsletter',
    group: 'customer',
    title: '프로모션 메일 발송',
    price: 100_000,
    summary: '구독자 목록으로 할인·소식 메일을 한 번에 보냅니다. 매달 일정 건수까지는 발송 비용이 들지 않습니다.',
    requires: 'subscribe',
  },
  {
    id: 'member',
    group: 'customer',
    title: '회원가입 · 로그인',
    price: 200_000,
    maxPrice: 500_000,
    summary: '필요한 방식만 고르세요. 고르는 방식에 따라 금액이 달라집니다.',
    points: ['구글 로그인', '카카오 로그인', '네이버 로그인', '자체 회원가입'],
  },
  {
    id: 'booking',
    group: 'custom',
    title: '맞춤형 장소 예약',
    price: 300_000,
    startingAt: true,
    summary: '공간·상담 예약을 사이트에서 바로 받습니다. 업종에 맞춰 흐름을 설계합니다.',
    points: ['예약 확인 이메일', '구글 캘린더 연동', '카카오 알림톡 알림'],
  },
  {
    id: 'chatbot',
    group: 'custom',
    title: '챗봇 기능',
    price: 300_000,
    startingAt: true,
    summary: '방문자의 자주 묻는 질문에 사이트가 바로 답합니다. 상담 문의로도 이어집니다.',
  },
  {
    id: 'app',
    group: 'custom',
    title: '앱 동시 제작',
    price: 500_000,
    startingAt: true,
    summary: '웹사이트와 함께 앱도 만듭니다. 필요한 기능에 따라 금액이 정해집니다.',
  },
]

/* 견적표 아래 이벤트 — 합계에서 이만큼 더 내려간다(LANDING_PRICE.caseDiscount 와 같은 금액) */
export const ESTIMATE_EVENT_LABEL = '11월 한정 10만원 추가할인 이벤트 (선착순 5팀)'

/* 견적 예시 — 고르면 아래 견적표가 그 구성으로 바뀐다 */
export const ESTIMATE_PRESETS: { label: string; ids: readonly string[] }[] = [
  { label: '기본형만', ids: [] },
  { label: '내용을 직접 고치는 사이트', ids: ['cms', 'board'] },
  { label: '고객을 모으는 사이트', ids: ['cms', 'subscribe', 'newsletter'] },
  { label: '예약을 받는 공간', ids: ['cms', 'booking'] },
]

export const SAMPLE_SITE_URL = 'https://gyeol-space-demo.vercel.app'

export const manwon = (n: number) => `${n / 10_000}만원`
export const won = (n: number) => `${n.toLocaleString('ko-KR')}원`
