'use client'

import { logout } from '@/app/studio/actions'

/* 로그아웃 — 좌측 메뉴 아래와 설정 탭 계정 칸에 둔다.
   한 번 눌러 바로 나가지 않게 묻는다. 모양은 놓이는 자리가 정한다. */
export function LogoutButton({ className }: { className: string }) {
  return (
    <form
      action={logout}
      onSubmit={(e) => {
        if (!confirm('로그아웃하시겠습니까?')) e.preventDefault()
      }}
    >
      <button className={className}>로그아웃</button>
    </form>
  )
}
