/* 서명 링크에 '이 이름으로 내려받기'를 붙인다.

   supabase-js 의 createSignedUrl(path, ttl, { download: name }) 은 이름을 두 번 인코딩해,
   한글 이름이 '%EC%8A…' 글자 그대로 저장됐다. 서명 링크 뒤에 한 번만 인코딩해 붙이면
   Storage 가 attachment; filename*=UTF-8''… 로 제대로 내려준다. */
export function withDownloadName(signedUrl: string, name: string): string {
  return `${signedUrl}${signedUrl.includes('?') ? '&' : '?'}download=${encodeURIComponent(name)}`
}
