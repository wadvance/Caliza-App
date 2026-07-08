const fs = require('fs')
const path = require('path')
const zlib = require('zlib')

const ICONS = [
  { name: 'icon-192x192.png', size: 192 },
  { name: 'icon-512x512.png', size: 512 },
  { name: 'favicon.png', size: 32 },
]

function createPNG(size) {
  const raw = Buffer.alloc(size * (size * 4 + 1))
  const bg = [15, 15, 35]
  const accent = [66, 133, 244]
  const highlight = [255, 107, 129]
  const white = [200, 200, 220]

  for (let y = 0; y < size; y++) {
    const row = y * (size * 4 + 1)
    raw[row] = 0
    for (let x = 0; x < size; x++) {
      const p = row + 1 + x * 4
      const nx = x / size
      const ny = y / size
      const cx = nx - 0.5
      const cy = ny - 0.5
      const dist = Math.sqrt(cx * cx + cy * cy)

      // Background gradient
      const grad = 1 - dist * 0.6
      raw[p] = Math.round(bg[0] * grad)
      raw[p + 1] = Math.round(bg[1] * grad)
      raw[p + 2] = Math.round(bg[2] * grad + 20)
      raw[p + 3] = 255

      // Mountain shape
      const mountainH = 0.08
      const m1 = Math.max(0, mountainH - Math.abs(ny - 0.62) * 0.8 + Math.abs(nx - 0.3) * 0.3)
      const m2 = Math.max(0, mountainH - Math.abs(ny - 0.58) * 0.7 + Math.abs(nx + 0.25) * 0.25)
      if (m1 > 0 || m2 > 0) {
        const m = Math.max(m1, m2) * 8
        raw[p] = Math.round(accent[0] * m + bg[0] * (1 - m))
        raw[p + 1] = Math.round(accent[1] * m + bg[1] * (1 - m))
        raw[p + 2] = Math.round(accent[2] * m + bg[2] * (1 - m))
      }

      // Circle (globe/stone)
      if (dist < 0.22) {
        const alpha = 1 - dist / 0.22
        raw[p] = Math.round(white[0] * alpha * 0.8 + raw[p] * (1 - alpha * 0.8))
        raw[p + 1] = Math.round(white[1] * alpha * 0.8 + raw[p + 1] * (1 - alpha * 0.8))
        raw[p + 2] = Math.round(white[2] * alpha * 0.8 + raw[p + 2] * (1 - alpha * 0.8))
      }

      // Cross mark
      const lineW = 0.015
      if (Math.abs(cx) < lineW && Math.abs(cy) < 0.18) {
        raw[p] = highlight[0]
        raw[p + 1] = highlight[1]
        raw[p + 2] = highlight[2]
      }
      if (Math.abs(cy) < lineW && Math.abs(cx) < 0.18) {
        raw[p] = highlight[0]
        raw[p + 1] = highlight[1]
        raw[p + 2] = highlight[2]
      }
    }
  }

  const compressed = zlib.deflateSync(raw)
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

  function chunk(type, data) {
    const len = Buffer.alloc(4)
    len.writeUInt32BE(data.length)
    const t = Buffer.from(type)
    const crcData = Buffer.concat([t, data])
    const crc = crc32(crcData)
    const c = Buffer.alloc(4)
    c.writeUInt32BE(crc)
    return Buffer.concat([len, t, data, c])
  }

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0

  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', compressed), chunk('IEND', Buffer.alloc(0))])
}

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i]
    for (let j = 0; j < 8; j++) c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0)
  }
  return (c ^ 0xffffffff) >>> 0
}

const assetsDir = path.join(__dirname, '..', 'src', 'assets')
if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true })

for (const icon of ICONS) {
  const fp = path.join(assetsDir, icon.name)
  fs.writeFileSync(fp, createPNG(icon.size))
  console.log(`Created ${icon.name} (${icon.size}x${icon.size})`)
}
