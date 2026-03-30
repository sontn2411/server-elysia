import { Elysia } from 'elysia'
import sharp from 'sharp'
import { spawn } from 'child_process'
import path from 'path'
const AdmZip = require('adm-zip') as typeof import('adm-zip')

const MAX_MB = 50
const MAX_BYTES = MAX_MB * 1024 * 1024
const MAX_FILES = 50

interface Opts {
  quality: number; format: string
  maxWidth: number; maxHeight: number; resizeFit: string; background: string
  stripExif: boolean; grayscale: boolean
  rotate: number; flipH: boolean; flipV: boolean
  blur: number; sharpen: boolean
  brightness: number; saturation: number; hue: number
  removeBg: boolean
}

const parseBool = (v: any) => v === true || v === 'true' || v === '1'
const parseNum = (v: any, d: number) => { const n = parseFloat(v); return isNaN(n) ? d : n }

function buildOpts(per: any, g: any): Opts {
  // brightness/saturation come in as -100..+100 from UI, convert to 0..2 multiplier
  const bVal = parseNum(per.brightness ?? g.brightness, 0)
  const sVal = parseNum(per.saturation ?? g.saturation, 0)
  return {
    quality:    parseInt(per.quality    || g.quality    || 100),
    format:     per.format    || g.format    || '',
    maxWidth:   parseInt(per.maxWidth   || g.maxWidth   || 0),
    maxHeight:  parseInt(per.maxHeight  || g.maxHeight  || 0),
    resizeFit:  per.resizeFit  || g.resizeFit  || 'inside',
    background: per.background || g.background || '',
    stripExif:  parseBool(per.stripExif  ?? g.stripExif),
    grayscale:  parseBool(per.grayscale  ?? g.grayscale),
    rotate:     parseInt(per.rotate     || g.rotate     || 0),
    flipH:      parseBool(per.flipH      ?? g.flipH),
    flipV:      parseBool(per.flipV      ?? g.flipV),
    blur:       parseNum(per.blur        || g.blur,      0),
    sharpen:    parseBool(per.sharpen    ?? g.sharpen),
    removeBg:   parseBool(per.removeBg   ?? g.removeBg),
    brightness: (bVal + 100) / 100,   // 0→0,  0→1,  +100→2
    saturation: (sVal + 100) / 100,
    hue:        parseInt(per.hue        || g.hue        || 0),
  }
}

async function processImage(input: Buffer | ArrayBuffer, originalFmt: string, opts: Opts): Promise<{ buffer: Buffer; ext: string }> {
  let imgSource: Buffer | ArrayBuffer = Buffer.isBuffer(input) ? input : Buffer.from(input)

  if (opts.removeBg) {
    try {
      console.log(`[AI] Bắt đầu xóa nền (Tiến trình riêng biệt)... Kích thước file gốc: ${Buffer.byteLength(imgSource as Buffer)} bytes`)
      const mime = originalFmt === 'jpg' ? 'image/jpeg' : `image/${originalFmt || 'png'}`

      const aiResult = await new Promise<Buffer>((resolve, reject) => {
        const workerPath = path.resolve(process.cwd(), 'src/workers/ai-bg-removal.ts')
        const proc = spawn('bun', [workerPath, mime])
        
        const outChunks: Buffer[] = []
        let errStr = ''

        proc.stdout.on('data', chunk => outChunks.push(chunk))
        proc.stderr.on('data', chunk => errStr += chunk.toString())
        
        proc.on('close', code => {
          if (code === 0) resolve(Buffer.concat(outChunks))
          else reject(new Error('AI Worker failed: ' + errStr))
        })
        proc.on('error', err => reject(err))

        proc.stdin.write(Buffer.isBuffer(imgSource) ? imgSource : Buffer.from(imgSource))
        proc.stdin.end()
      })
      
      console.log(`[AI] Xóa nền an toàn thành công. Kích thước file kết quả: ${aiResult.byteLength} bytes`)
      
      if (aiResult.byteLength < 8) throw new Error("Empty or very short buffer returned")
      
      const isPNG = aiResult[0] === 0x89 && aiResult[1] === 0x50 && aiResult[2] === 0x4e && aiResult[3] === 0x47
      if (!isPNG) {
        throw new Error("Dữ liệu trả về không phải định dạng PNG hợp lệ")
      }
      
      imgSource = aiResult
    } catch (e) {
      console.error('[AI] Lỗi khi xóa nền:', e)
    }
  }

  let p = sharp(imgSource).rotate() // auto-orient from EXIF

  if (opts.rotate)  p = p.rotate(opts.rotate)
  if (opts.flipH)   p = p.flop()
  if (opts.flipV)   p = p.flip()

  const ro: any = { withoutEnlargement: true, fit: opts.resizeFit }
  if (opts.maxWidth  > 0) ro.width  = opts.maxWidth
  if (opts.maxHeight > 0) ro.height = opts.maxHeight
  if (ro.width || ro.height) p = p.resize(ro)

  if (opts.background) p = p.flatten({ background: opts.background })
  if (opts.grayscale)  p = p.grayscale()

  if (opts.brightness !== 1 || opts.saturation !== 1 || opts.hue !== 0) {
    p = p.modulate({ brightness: opts.brightness, saturation: opts.saturation, hue: opts.hue })
  }

  if (opts.blur    > 0) p = p.blur(Math.max(0.3, Math.min(100, opts.blur)))
  if (opts.sharpen)     p = p.sharpen()
  if (opts.stripExif)   p = p.withMetadata({})

  const fmt = opts.format || originalFmt || 'webp'
  let buf: Buffer
  switch (fmt) {
    case 'jpeg': case 'jpg': buf = await p.jpeg({ quality: opts.quality, mozjpeg: true }).toBuffer(); break
    case 'png':  buf = await p.png({ effort: 4 }).toBuffer(); break
    case 'webp': buf = await p.webp({ quality: opts.quality }).toBuffer(); break
    case 'avif': buf = await p.avif({ quality: opts.quality }).toBuffer(); break
    case 'gif':  buf = await p.gif().toBuffer(); break
    case 'tiff': buf = await p.tiff({ quality: opts.quality }).toBuffer(); break
    default:     buf = await p.toBuffer(); break
  }

  return { buffer: buf, ext: fmt === 'jpg' ? 'jpeg' : fmt }
}

export const imageToolRoute = new Elysia()
  .get('/image-tool', () => Bun.file('src/views/image-tool.html'))

  // ── Process from URL ─────────────────────────────────────────
  .post('/image-tool/from-url', async ({ body, set }) => {
    const b = body as any
    if (!b.url) { set.status = 400; return 'URL không hợp lệ' }

    let imgBuf: ArrayBuffer
    try {
      const res = await fetch(b.url, { signal: AbortSignal.timeout(15000) })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const ct = res.headers.get('content-type') || ''
      if (!ct.startsWith('image/')) throw new Error('URL không phải hình ảnh')
      imgBuf = await res.arrayBuffer()
    } catch (e: any) { set.status = 400; return `Không thể tải ảnh: ${e.message}` }

    const meta = await sharp(imgBuf).metadata()
    const opts = buildOpts(b, {})
    if (!opts.format) opts.format = meta.format || 'webp'

    const { buffer, ext } = await processImage(imgBuf, meta.format || 'jpeg', opts)
    const base = (new URL(b.url).pathname.split('/').pop() || 'image').replace(/\.[^.]+$/, '')
    const name = `${b.outputPrefix || ''}${base}${b.outputSuffix || ''}.${ext}`

    set.headers['Content-Type'] = `image/${ext}`
    set.headers['Content-Disposition'] = `attachment; filename="${name}"`
    set.headers['X-Optimized-Metadata'] = JSON.stringify([{ name, size: buffer.length }])
    return buffer
  })

  // ── Process uploaded files ────────────────────────────────────
  .post('/image-tool', async ({ body, set }) => {
    const b = body as any
    let settingsArr: any[] = []
    try { settingsArr = JSON.parse(b.individualSettings || '[]') } catch {}

    const fileArray = Array.isArray(b.files) ? b.files : [b.files]
    if (!b.files || fileArray.length === 0) { set.status = 400; return 'No files uploaded' }
    if (fileArray.length > MAX_FILES) { set.status = 400; return `Tối đa ${MAX_FILES} file mỗi lần.` }

    const results: { name: string; buffer: Buffer }[] = []

    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i]
      if (!file?.name) continue
      if (file.size > MAX_BYTES) { set.status = 400; return `"${file.name}" vượt quá ${MAX_MB}MB.` }

      const sp = settingsArr.find((s: any) => s.index === i) || {}
      const fileBuf = await file.arrayBuffer()
      const meta = await sharp(fileBuf).metadata()
      const opts = buildOpts(sp, b)
      if (!opts.format) opts.format = meta.format || 'webp'

      const { buffer, ext } = await processImage(fileBuf, meta.format || 'jpeg', opts)
      const base = file.name.replace(/\.[^.]+$/, '')
      results.push({ name: `${b.outputPrefix || ''}${base}${b.outputSuffix || ''}.${ext}`, buffer })
    }

    if (results.length === 0) { set.status = 400; return 'No valid images processed' }

    set.headers['X-Optimized-Metadata'] = JSON.stringify(results.map(r => ({ name: r.name, size: r.buffer.length })))

    if (results.length === 1) {
      set.headers['Content-Type'] = `image/${results[0].name.split('.').pop()}`
      set.headers['Content-Disposition'] = `attachment; filename="${results[0].name}"`
      return results[0].buffer
    }

    const zip = new AdmZip()
    for (const r of results) zip.addFile(r.name, r.buffer)
    set.headers['Content-Type'] = 'application/zip'
    set.headers['Content-Disposition'] = 'attachment; filename="optimized_images_batch.zip"'
    return zip.toBuffer()
  })
