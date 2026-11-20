/* 잡힌 에러를 화면에 띄울 말로 바꾼다 — 전역 에러 토스트(error-toast.tsx)와
   에러 화면(app/error.tsx · global-error.tsx)이 같이 쓴다.

   운영에서는 서버 쪽 에러 내용이 브라우저로 넘어오지 않는다(Next 가 감추고 digest 만 준다).
   그래서 서버가 무엇 때문에 실패했는지는 알 수 없고, 브라우저에서 보이는 모양으로만 가른다.

   클라이언트 컴포넌트도 쓰므로 server-only 모듈에 두지 않는다. */

export type ErrorKind =
  /* 인터넷이 끊겼거나 요청이 서버에 닿지 못했다 */
  | 'network'
  /* 보낸 내용이 서버 액션 한도(1MB)를 넘었다 */
  | 'too_large'
  /* 새 버전이 배포돼 열어 둔 화면의 코드가 서버와 맞지 않는다 — 새로고침하면 풀린다 */
  | 'stale'
  /* 그 밖의 서버 오류 */
  | 'server'

export type DescribedError = {
  kind: ErrorKind
  title: string
  message: string
  /* 서버 로그와 맞춰 볼 식별자(error.digest) — 문의할 때 알려 달라고 보여준다 */
  code: string | null
  /* 새로고침 버튼을 보여줄지 */
  reload: boolean
}

function textOf(err: unknown): string {
  if (err instanceof Error) return `${err.name} ${err.message}`
  return typeof err === 'string' ? err : ''
}

function kindOf(err: unknown): ErrorKind {
  const t = textOf(err)
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return 'network'
  if (/body exceeded|payload too large|\b413\b/i.test(t)) return 'too_large'
  if (
    /failed to find server action|server action .* was not found|ChunkLoadError|loading chunk|dynamically imported module/i.test(
      t,
    )
  ) {
    return 'stale'
  }
  /* 크롬 'Failed to fetch', 파이어폭스 'NetworkError', 사파리 'Load failed' */
  if (/failed to fetch|networkerror|load failed|network request failed/i.test(t)) return 'network'
  return 'server'
}

/* what — 무엇을 하다 실패했는지('프로필 이미지 저장'). 있으면 제목에 넣는다 */
export function describeError(err: unknown, what?: string): DescribedError {
  const kind = kindOf(err)
  const digest =
    err && typeof err === 'object' && 'digest' in err && typeof err.digest === 'string' ? err.digest : null
  const failed = what ? `${what}에 실패했습니다` : '요청을 처리하지 못했습니다'

  switch (kind) {
    case 'network':
      return {
        kind,
        title: failed,
        message: '인터넷 연결을 확인한 뒤 다시 시도해 주세요.',
        code: null,
        reload: false,
      }
    case 'too_large':
      return {
        kind,
        title: failed,
        message: '보내는 파일이 너무 큽니다. 더 작은 파일로 다시 시도해 주세요.',
        code: null,
        reload: false,
      }
    case 'stale':
      return {
        kind,
        title: '사이트가 업데이트되었습니다',
        message: '새로고침한 뒤 다시 시도해 주세요. 입력하던 내용은 다시 적어야 할 수 있습니다.',
        code: null,
        reload: true,
      }
    default:
      return {
        kind,
        title: failed,
        message: '일시적인 서버 오류입니다. 잠시 후 다시 시도해 주세요. 계속되면 manager@soom.it 으로 알려 주세요.',
        code: digest,
        reload: false,
      }
  }
}
