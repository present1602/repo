import 'server-only'
import bcrypt from 'bcryptjs'

/* 비밀번호 해싱과 임시 비밀번호 생성.

   세션(cookies)·DB를 끌어오는 designer-auth.ts 와 일부러 떼어놓았다.
   bcryptjs 는 내부에서 Date.now() 를 쓰는데, 그 모듈이 페이지 그래프에 들어가면
   Cache Components 가 프리렌더 중 불안정한 값으로 보고 빌드를 멈춘다.
   여기에 두면 서버 액션에서만 불려 들어온다. */

export function hashPassword(plain: string): string {
  return bcrypt.hashSync(plain, 10)
}

export function verifyPassword(plain: string, hash: string | null): boolean {
  if (!hash) return false
  try {
    return bcrypt.compareSync(plain, hash)
  } catch {
    return false
  }
}

/* 사람이 받아 적기 쉬운 임시 비밀번호.
   혼동되는 글자(O/0, l/1, I)를 뺀 10자리. */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'

export function generateTempPassword(len = 10): string {
  const bytes = new Uint8Array(len)
  crypto.getRandomValues(bytes)
  let out = ''
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length]
  return out
}
