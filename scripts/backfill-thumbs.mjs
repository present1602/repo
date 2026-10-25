/* 썸네일이 없는 작업에 썸네일을 만들어 채운다 (010_work_thumbnails.sql).

   한 번 돌리면 끝나는 일회성 도구다. 앞으로 올리는 작업은 업로드할 때
   브라우저에서 썸네일을 함께 만들어 보낸다(make-thumb.ts).

   실행:
     node scripts/backfill-thumbs.mjs --dry     무엇을 할지만 본다
     node scripts/backfill-thumbs.mjs           실제로 만든다

   여러 번 돌려도 안전하다 — 이미 thumb_url 이 있는 작업은 건너뛴다. */

import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { createClient } = require('@supabase/supabase-js')
const sharp = require('sharp')

/* make-thumb.ts 와 같은 값을 쓴다 — 둘이 어긋나면 백필한 것과
   새로 올린 것의 크기가 달라진다. */
const THUMB_MAX = 1200
const QUALITY = 82

const DRY = process.argv.includes('--dry')

/* ─────────── 설정 ─────────── */

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]
    }),
)

const BUCKET = 'designer-images'
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

/* ─────────── 대상 조회 ─────────── */

const { data: rows, error } = await db
  .from('designer_works')
  .select('id, designer_id, image_url, thumb_url, crop_x, crop_y, crop_w, crop_h')
  .is('thumb_url', null)
  .order('created_at', { ascending: true })

if (error) {
  console.error('조회 실패:', error.message)
  if (error.message.includes('thumb_url')) {
    console.error('→ 010_work_thumbnails.sql 을 먼저 실행해 주세요.')
  }
  process.exit(1)
}

console.log(`썸네일이 없는 작업: ${rows.length}개${DRY ? ' (미리보기만)' : ''}\n`)
if (rows.length === 0) process.exit(0)

/* ─────────── 한 장씩 처리 ─────────── */

let made = 0
let skipped = 0
const problems = []

for (let i = 0; i < rows.length; i++) {
  const w = rows[i]
  const tag = `[${i + 1}/${rows.length}]`

  try {
    const res = await fetch(w.image_url)
    if (!res.ok) throw new Error(`원본을 받지 못했습니다 (HTTP ${res.status})`)
    const input = Buffer.from(await res.arrayBuffer())

    let img = sharp(input, { failOn: 'none' })
    const meta = await img.metadata()
    if (!meta.width || !meta.height) throw new Error('이미지 크기를 읽지 못했습니다')

    /* 영역을 잡아 둔 작업은 그 부분만 자른다 — 0~1 비율을 픽셀로 환산한다.
       화면(make-thumb.ts)과 같은 규칙이라 결과가 같아야 한다. */
    const hasCrop =
      w.crop_x != null && w.crop_y != null && w.crop_w != null && w.crop_h != null

    let sw = meta.width
    let sh = meta.height

    if (hasCrop) {
      const left = Math.round(w.crop_x * meta.width)
      const top = Math.round(w.crop_y * meta.height)
      sw = Math.max(1, Math.min(Math.round(w.crop_w * meta.width), meta.width - left))
      sh = Math.max(1, Math.min(Math.round(w.crop_h * meta.height), meta.height - top))
      img = img.extract({ left, top, width: sw, height: sh })
    }

    /* 긴 변을 THUMB_MAX 로 — 원본이 이미 작으면 키우지 않는다 */
    const scale = Math.min(1, THUMB_MAX / Math.max(sw, sh))
    const dw = Math.max(1, Math.round(sw * scale))
    const dh = Math.max(1, Math.round(sh * scale))

    const out = await img.resize(dw, dh).webp({ quality: QUALITY }).toBuffer()

    const saved = ((1 - out.length / input.length) * 100).toFixed(0)
    console.log(
      `${tag} ${w.id.slice(0, 8)} ${meta.width}×${meta.height} → ${dw}×${dh}  ` +
        `${(input.length / 1024).toFixed(0)}KB → ${(out.length / 1024).toFixed(0)}KB (${saved}% 절감)` +
        (hasCrop ? ' · 영역 적용' : ''),
    )

    if (DRY) {
      made++
      continue
    }

    /* 업로드 경로는 업로드 화면과 같게 둔다 — 같은 디자이너 폴더 아래 thumbs/ */
    const path = `works/${w.designer_id}/thumbs/${w.id}.webp`
    const { error: upErr } = await db.storage
      .from(BUCKET)
      .upload(path, out, { contentType: 'image/webp', upsert: true })

    if (upErr) throw new Error(`업로드 실패: ${upErr.message}`)

    const { data: pub } = db.storage.from(BUCKET).getPublicUrl(path)

    const { error: dbErr } = await db
      .from('designer_works')
      .update({ thumb_url: pub.publicUrl })
      .eq('id', w.id)

    if (dbErr) throw new Error(`DB 기록 실패: ${dbErr.message}`)

    made++
  } catch (e) {
    skipped++
    const msg = e instanceof Error ? e.message : String(e)
    problems.push(`${w.id}: ${msg}`)
    console.log(`${tag} ${w.id.slice(0, 8)} 건너뜀 — ${msg}`)
  }
}

/* ─────────── 결과 ─────────── */

console.log(`\n${DRY ? '만들 수 있는 썸네일' : '만든 썸네일'}: ${made}개`)
if (skipped > 0) {
  console.log(`건너뛴 작업: ${skipped}개`)
  for (const p of problems.slice(0, 10)) console.log(`  ${p}`)
  if (problems.length > 10) console.log(`  … 외 ${problems.length - 10}개`)
}

if (!DRY && skipped > 0) {
  console.log('\n건너뛴 작업은 thumb_url 이 비어 있어 목록에서 원본을 씁니다.')
  console.log('원본이 깨진 것이 아니라면 다시 실행해 보세요.')
}
