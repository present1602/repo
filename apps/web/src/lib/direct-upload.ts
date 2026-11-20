import { createClient } from '@supabase/supabase-js'

/* 프로필·포트폴리오 이미지 버킷(0001_init.sql). 화면도 이름을 알아야 서명 주소로 올린다. */
export const DESIGNER_IMAGES_BUCKET = 'designer-images'

/* 서명 주소로 브라우저가 바로 올린다 — 서버 액션은 본문이 1MB 를 넘으면
   요청 자체를 버리고, 화면은 "This page couldn't load" 로 무너진다.
   주소는 서버가 경로를 정해 발급한다(upload.ts 의 signImageUpload). */
export async function uploadSigned(
  bucket: string,
  prep: { path: string; token: string },
  file: File,
): Promise<boolean> {
  const storage = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false },
  }).storage.from(bucket)

  const { error } = await storage.uploadToSignedUrl(prep.path, prep.token, file, {
    contentType: file.type || undefined,
  })
  if (error) console.error('[upload] 서명 업로드 실패:', error.message)
  return !error
}
