// ============================================================
// BookmarksAI · 图标生成脚本（Node.js）
// 运行: node scripts/generate-icons.mjs
// ============================================================
import { createCanvas } from 'canvas'
import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const iconsDir = join(__dirname, '../public/icons')
mkdirSync(iconsDir, { recursive: true })

const SIZES = [16, 32, 48, 128]

for (const size of SIZES) {
  const canvas = createCanvas(size, size)
  const ctx = canvas.getContext('2d')

  // 背景圆角矩形
  const r = size * 0.2
  ctx.beginPath()
  ctx.moveTo(r, 0)
  ctx.lineTo(size - r, 0)
  ctx.quadraticCurveTo(size, 0, size, r)
  ctx.lineTo(size, size - r)
  ctx.quadraticCurveTo(size, size, size - r, size)
  ctx.lineTo(r, size)
  ctx.quadraticCurveTo(0, size, 0, size - r)
  ctx.lineTo(0, r)
  ctx.quadraticCurveTo(0, 0, r, 0)
  ctx.closePath()

  const bgGrad = ctx.createLinearGradient(0, 0, size, size)
  bgGrad.addColorStop(0, '#0d0d1f')
  bgGrad.addColorStop(1, '#111128')
  ctx.fillStyle = bgGrad
  ctx.fill()

  // 书签形状（中心）
  const bx = size * 0.25
  const by = size * 0.15
  const bw = size * 0.5
  const bh = size * 0.7
  const notchY = by + bh * 0.72
  const notchDepth = bh * 0.2

  ctx.beginPath()
  ctx.moveTo(bx, by)
  ctx.lineTo(bx + bw, by)
  ctx.lineTo(bx + bw, by + bh)
  ctx.lineTo(bx + bw * 0.5, notchY)
  ctx.lineTo(bx, by + bh)
  ctx.closePath()

  const bmGrad = ctx.createLinearGradient(bx, by, bx + bw, by + bh)
  bmGrad.addColorStop(0, '#6366f1')
  bmGrad.addColorStop(1, '#8b5cf6')
  ctx.fillStyle = bmGrad
  ctx.fill()

  // AI 星光点（右上角）
  if (size >= 32) {
    const sx = size * 0.72
    const sy = size * 0.18
    const sr = size * 0.08
    ctx.beginPath()
    ctx.arc(sx, sy, sr, 0, Math.PI * 2)
    ctx.fillStyle = '#a5b4fc'
    ctx.fill()
  }

  const buffer = canvas.toBuffer('image/png')
  writeFileSync(join(iconsDir, `icon${size}.png`), buffer)
  console.log(`✓ icon${size}.png`)
}

console.log('Icons generated in public/icons/')
