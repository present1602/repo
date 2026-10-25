import 'server-only'
import { createClient } from '@supabase/supabase-js'

/* 서버 전용 클라이언트.
   service_role 키는 RLS를 우회하므로 절대 클라이언트로 내보내지 않는다.
   NEXT_PUBLIC_ 접두사를 붙이면 브라우저 번들에 포함된다. */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

export const supabaseConfigured = Boolean(url && key)

export const supabaseAdmin = supabaseConfigured
  ? createClient(url!, key!, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null

export const DESIGNER_IMAGES_BUCKET = 'designer-images'

/* 문의 첨부 — 작업 이미지와 섞지 않는다(012_inquiries.sql).
   저쪽은 공개 버킷이라 주소만 알면 누구나 열 수 있는데, 문의 첨부는
   사업 자료일 수 있어 비공개로 두고 서명 링크로만 연다. */
export const INQUIRY_FILES_BUCKET = 'inquiry-files'
