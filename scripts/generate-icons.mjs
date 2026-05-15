// ============================================================
// BookmarkMind AI · 图标生成脚本
// 运行: node scripts/generate-icons.mjs
// 说明: 从 public/icons/bookmarkmind-logo-300.png 生成扩展图标
// 依赖: 系统已安装 ffmpeg
// ============================================================
import { execFileSync } from 'node:child_process'
import { mkdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const iconsDir = join(__dirname, '../public/icons')
mkdirSync(iconsDir, { recursive: true })

const source = join(iconsDir, 'bookmarkmind-logo-300.png')
const SIZES = [16, 32, 48, 128]

if (!existsSync(source)) {
  throw new Error(`Missing source logo: ${source}`)
}

for (const size of SIZES) {
  const output = join(iconsDir, `icon${size}.png`)
  execFileSync(
    'ffmpeg',
    [
      '-y',
      '-i',
      source,
      '-vf',
      `scale=${size}:${size}`,
      '-update',
      '1',
      '-frames:v',
      '1',
      output,
    ],
    { stdio: 'inherit' },
  )
  console.log(`✓ icon${size}.png`)
}

console.log(`Icons generated from ${source}`)
