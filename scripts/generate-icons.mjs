import { readFile, writeFile } from 'node:fs/promises'
import sharp from 'sharp'

// Keep raster icons in sync with the editable SVG, without relying on fonts.
const app = new URL('../src/app/', import.meta.url)
const svg = await readFile(new URL('icon.svg', app), 'utf8')
const source = await sharp(Buffer.from(svg)).resize(1024, 1024).png().toBuffer()
const sizes = [16, 32, 48, 64, 128, 256]
const images = await Promise.all(
  sizes.map((size) => sharp(source).resize(size, size).png().toBuffer()),
)

// ICO directory followed by a PNG payload for each supported size.
const header = Buffer.alloc(6 + sizes.length * 16)
header.writeUInt16LE(1, 2)
header.writeUInt16LE(sizes.length, 4)
let offset = header.length
for (let index = 0; index < sizes.length; index++) {
  const entry = 6 + index * 16
  const size = sizes[index]
  const image = images[index]
  header.writeUInt8(size === 256 ? 0 : size, entry)
  header.writeUInt8(size === 256 ? 0 : size, entry + 1)
  header.writeUInt16LE(1, entry + 4)
  header.writeUInt16LE(32, entry + 6)
  header.writeUInt32LE(image.length, entry + 8)
  header.writeUInt32LE(offset, entry + 12)
  offset += image.length
}
await writeFile(new URL('favicon.ico', app), Buffer.concat([header, ...images]))

// iOS applies its own corner mask, so the touch icon uses a full-bleed background.
await sharp(Buffer.from(svg.replace('rx="16"', 'rx="0"')))
  .resize(180, 180)
  .flatten({ background: '#7c3aed' })
  .png()
  .toFile(new URL('apple-icon.png', app).pathname)

console.log('Generated favicon.ico (16–256px) and apple-icon.png (180px) from icon.svg')
