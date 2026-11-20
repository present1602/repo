/* User-Agent 원문에서 사람이 읽을 이름(브라우저·OS·기기)을 뽑는다.

   라이브러리 없이 자주 보이는 것만 가린다 — 어드민이 "누가 열었나"를 가늠하는 용도라
   정확한 버전 판별까지는 필요 없다. 못 알아보면 '기타'로 둔다.

   순서가 중요하다. 인앱 브라우저(카카오톡·네이버·인스타그램)의 UA 에도 'Safari'·'Chrome' 이
   들어 있고, Edge·웨일·삼성 인터넷의 UA 에도 'Chrome' 이 들어 있다 — 좁은 것부터 본다. */

export type ParsedAgent = {
  browser: string
  os: string
  device: '모바일' | '태블릿' | 'PC' | '봇'
  isBot: boolean
}

/* 링크 미리보기·검색 수집기. 카카오톡 미리보기는 'kakaotalk-scrap' 이다
   (카카오톡 인앱 브라우저로 사람이 연 것은 'KAKAOTALK' 이라 여기 걸리지 않는다). */
const BOT =
  /kakaotalk-scrap|facebookexternalhit|facebot|slackbot|slack-imgproxy|twitterbot|discordbot|telegrambot|whatsapp|linkedinbot|skypeuripreview|googlebot|google-inspectiontool|adsbot|bingbot|yeti|daumoa|applebot|petalbot|bytespider|headlesschrome|bot\b|crawler|spider|preview/i

const BOT_NAMES: [RegExp, string][] = [
  [/kakaotalk-scrap/i, '카카오톡 미리보기'],
  [/slack/i, '슬랙 미리보기'],
  [/facebookexternalhit|facebot/i, '페이스북 미리보기'],
  [/telegrambot/i, '텔레그램 미리보기'],
  [/discordbot/i, '디스코드 미리보기'],
  [/twitterbot/i, 'X(트위터) 미리보기'],
  [/linkedinbot/i, '링크드인 미리보기'],
  [/whatsapp/i, '왓츠앱 미리보기'],
  [/yeti/i, '네이버 검색 수집기'],
  [/daumoa/i, '다음 검색 수집기'],
  [/googlebot|google-inspectiontool|adsbot/i, '구글 검색 수집기'],
  [/bingbot/i, '빙 검색 수집기'],
  [/headlesschrome/i, '자동화 브라우저'],
]

const BROWSERS: [RegExp, string][] = [
  [/KAKAOTALK/i, '카카오톡 인앱'],
  [/NAVER\(inapp|NAVER\//, '네이버 앱'],
  [/Instagram/, '인스타그램 인앱'],
  [/FBAN|FBAV/, '페이스북 인앱'],
  [/Line\//, '라인 인앱'],
  [/Whale\//, '네이버 웨일'],
  [/SamsungBrowser\//, '삼성 인터넷'],
  [/Edg(e|A|iOS)?\//, 'Edge'],
  [/OPR\/|Opera/, 'Opera'],
  [/Firefox\/|FxiOS\//, 'Firefox'],
  [/CriOS\/|Chrome\//, 'Chrome'],
  [/Safari\//, 'Safari'],
]

function osOf(ua: string): string {
  const ios = ua.match(/(?:iPhone|iPad|iPod).*? OS (\d+)(?:_(\d+))?/)
  if (ios) return `iOS ${ios[1]}${ios[2] ? `.${ios[2]}` : ''}`
  const android = ua.match(/Android (\d+(?:\.\d+)?)/)
  if (android) return `Android ${android[1]}`
  if (/Android/.test(ua)) return 'Android'
  /* Windows 11 도 UA 에는 'Windows NT 10.0' 으로 적힌다 — 10/11 을 가를 수 없다 */
  if (/Windows NT 10/.test(ua)) return 'Windows 10/11'
  if (/Windows/.test(ua)) return 'Windows'
  /* macOS 버전은 브라우저가 10_15_7 로 고정해 보낸다 — 버전은 적지 않는다 */
  if (/Mac OS X|Macintosh/.test(ua)) return 'macOS'
  if (/CrOS/.test(ua)) return 'ChromeOS'
  if (/Linux/.test(ua)) return 'Linux'
  return '기타'
}

function deviceOf(ua: string): '모바일' | '태블릿' | 'PC' {
  if (/iPad|Tablet/.test(ua) || (/Android/.test(ua) && !/Mobile/.test(ua))) return '태블릿'
  if (/Mobi|iPhone|iPod|Android/.test(ua)) return '모바일'
  return 'PC'
}

export function parseUserAgent(raw: string | null | undefined): ParsedAgent {
  const ua = (raw ?? '').trim()
  if (!ua) return { browser: '알 수 없음', os: '알 수 없음', device: 'PC', isBot: false }

  if (BOT.test(ua)) {
    const name = BOT_NAMES.find(([re]) => re.test(ua))?.[1] ?? '자동 수집기'
    return { browser: name, os: osOf(ua), device: '봇', isBot: true }
  }

  const browser = BROWSERS.find(([re]) => re.test(ua))?.[1] ?? '기타'
  return { browser, os: osOf(ua), device: deviceOf(ua), isBot: false }
}
