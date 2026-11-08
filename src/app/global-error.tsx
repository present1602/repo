'use client'

import './globals.css'
import { ErrorScreen } from '@/components/error-screen'

/* 루트 레이아웃까지 실패했을 때 — 레이아웃을 대신하므로 html·body 를 직접 둔다.
   글꼴(Geist)은 레이아웃이 붙이는 것이라 여기서는 시스템 글꼴로 나간다 */
export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="flex min-h-screen flex-col bg-white text-neutral-900">
        <title>오류 · SOOM</title>
        <ErrorScreen error={error} retry={retry} />
      </body>
    </html>
  )
}
