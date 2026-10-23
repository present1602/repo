/* 이름이 비어 있는 동안 쓸 표시명 — 이메일 앞부분.
   화면마다 다르게 처리하면 같은 계정이 서로 다른 이름으로 보인다.
   서버·클라이언트 양쪽에서 쓰므로 server-only 모듈에 두지 않는다. */
export function displayName(d: { name: string | null; email: string }): string {
  return d.name?.trim() || d.email.split('@')[0]
}

/* 공개 화면용 — 이메일을 모르는 자리에서 쓴다.

   탐색·상세는 로그인 없이 보이므로 이메일을 내려보내지 않는다.
   이름이 비어 있으면 이메일 앞부분조차 쓸 수 없으니 '이름 미입력' 대신
   중립적인 표시를 쓴다 — 공개 화면에 디버그용 문구가 보이면 안 된다. */
export function displayNameOf(d: { name: string | null }): string {
  return d.name?.trim() || '이름 미입력 디자이너'
}
