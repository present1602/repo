'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

export function SignOutButton() {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const signOut = async () => {
    setLoading(true)
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
    await supabase.auth.signOut()
    /* 레이아웃이 서버에서 로그인 여부를 다시 읽어야 사이드바가 사라진다 */
    router.refresh()
    router.replace('/admin/login')
  }

  return (
    <button
      onClick={signOut}
      disabled={loading}
      className="rounded-md px-2.5 py-1.5 text-xs font-medium text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900 disabled:opacity-50"
    >
      {loading ? '로그아웃 중…' : '로그아웃'}
    </button>
  )
}
