'use client'

import { ErrorScreen } from '@/components/error-screen'

/* 사이트 안 모든 화면의 에러 경계 — 상단 바·푸터(루트 레이아웃)는 그대로 두고 본문만 바꾼다 */
export default function Error({ error, retry }: { error: unknown; retry: () => void }) {
  return <ErrorScreen error={error} retry={retry} />
}
