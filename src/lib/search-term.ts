/* 검색어가 "걸러도 될 만큼" 입력됐는지 판단한다.

   한글은 두 글자, 영문·숫자는 세 글자부터 거른다. 기준이 다른 이유는
   한 글자가 담는 정보량이 다르기 때문이다 — '김서'는 이미 이름을 좁히지만
   'ki'는 kim·king·kitchen 어디에나 걸려 목록이 줄지 않는다.

   클라이언트 컴포넌트가 쓰므로 server-only 모듈에 두지 않는다. */

export const MIN_HANGUL = 2
export const MIN_LATIN = 3

/* 한글 음절(가–힣)과 자모(ㄱ–ㅣ) 둘 다 센다.
   조합 중인 글자('ㄱ')도 한 글자로 쳐야 입력 도중 기준이 흔들리지 않는다. */
const HANGUL_RE = /[가-힣ㄱ-ㅣ]/

/* 공백·기호를 뺀 실제 글자 수 — '김 서'를 두 글자로 본다 */
function letters(s: string): string {
  return s.replace(/[\s\p{P}\p{S}]/gu, '')
}

/* 이 검색어로 목록을 걸러야 하는가.
   비어 있거나 기준에 못 미치면 거짓 — 호출부는 전체를 그대로 보여준다. */
export function isSearchable(raw: string): boolean {
  const s = letters(raw)
  if (s.length === 0) return false

  /* 한글이 하나라도 섞여 있으면 한글 기준을 쓴다.
     '김a'처럼 섞어 치는 중에 기준이 3글자로 올라가면,
     두 글자를 쳤는데도 목록이 안 걸러져 고장으로 보인다. */
  return s.length >= (HANGUL_RE.test(s) ? MIN_HANGUL : MIN_LATIN)
}

/* 아직 기준에 못 미칠 때 입력칸 아래에 띄울 안내.
   비어 있으면 아무 말도 하지 않는다 — 입력 전부터 잔소리할 필요는 없다. */
export function searchHint(raw: string): string | null {
  const s = letters(raw)
  if (s.length === 0 || isSearchable(raw)) return null

  return HANGUL_RE.test(s)
    ? `한글은 ${MIN_HANGUL}글자부터 검색됩니다`
    : `영문·숫자는 ${MIN_LATIN}글자부터 검색됩니다`
}

/* 대소문자와 앞뒤 공백을 무시하고 포함 여부를 본다.
   한글은 대소문자가 없지만 영문 이름·제목이 섞이므로 함께 낮춘다. */
export function matches(haystack: string | null | undefined, needle: string): boolean {
  if (!haystack) return false
  return haystack.toLowerCase().includes(needle.trim().toLowerCase())
}
