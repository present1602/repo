/* pdf.js 가 그릴 때 따로 받아 오는 파일을 public/pdfjs/ 로 복사한다.

   JPEG2000(JPX) 그림은 openjpeg.wasm 으로 푼다 — 이 파일 위치(wasmUrl)를
   못 찾으면 오류 없이 그 그림만 빠진 채 그려진다(폰 목업 속 화면이 비었다).
   pdfjs-dist 버전과 어긋나지 않게 npm install 때마다 다시 복사한다. */

import { cpSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const src = join(root, 'node_modules', 'pdfjs-dist')
const dest = join(root, 'public', 'pdfjs')

rmSync(dest, { recursive: true, force: true })
for (const dir of ['wasm', 'standard_fonts', 'iccs']) {
  cpSync(join(src, dir), join(dest, dir), { recursive: true })
}
console.log('[pdfjs] wasm·폰트 파일을 public/pdfjs/ 로 복사했습니다.')
