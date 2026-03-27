import { Elysia } from 'elysia'
import sharp from 'sharp'
const AdmZip = require('adm-zip') as typeof import('adm-zip')

export const imageToolRoute = new Elysia()
  .get('/image-tool', () => Bun.file('src/views/image-tool.html'))
  .post('/image-tool', async ({ body, set }) => {
    const { files, quality, format, maxWidth, individualSettings } = body as any
    
    // Parse individual settings if provided
    let settingsArray: any[] = []
    if (individualSettings) {
      try {
        settingsArray = typeof individualSettings === 'string' ? JSON.parse(individualSettings) : individualSettings
      } catch (e) {
        console.error('Failed to parse individual settings', e)
      }
    }

    // Ensure files is an array even if only one file is uploaded
    const fileArray = Array.isArray(files) ? files : [files]
    
    if (!files || fileArray.length === 0) {
      set.status = 400
      return 'No files uploaded'
    }

    const processedImages: { name: string; buffer: Buffer }[] = []

    for (let i = 0; i < fileArray.length; i++) {
        const file = fileArray[i]
        if (!file || !file.name) continue
        
        const specificSetting = settingsArray.find(s => s.index === i) || {}
        
        let pipeline = sharp(await file.arrayBuffer())
        const metadata = await pipeline.metadata()

        // Determine quality, format and maxWidth (priority: individual > global > default)
        const targetQuality = parseInt(specificSetting.quality || quality || 100)
        const targetFormat = specificSetting.format || format || metadata.format || 'webp'
        const targetMaxWidth = parseInt(specificSetting.maxWidth || maxWidth || 0)

        // Resize if targetMaxWidth is provided and smaller than current width
        if (targetMaxWidth > 0 && metadata.width && metadata.width > targetMaxWidth) {
            pipeline = pipeline.resize({ width: targetMaxWidth, withoutEnlargement: true })
        }

        // Apply optimization based on format
        let outputBuffer: Buffer
        switch (targetFormat) {
            case 'jpeg':
            case 'jpg':
                outputBuffer = await pipeline.jpeg({ quality: targetQuality, mozjpeg: true }).toBuffer()
                break
            case 'png':
                outputBuffer = await pipeline.png({ effort: 4 }).toBuffer()
                break
            case 'webp':
                outputBuffer = await pipeline.webp({ quality: targetQuality }).toBuffer()
                break
            case 'avif':
                outputBuffer = await pipeline.avif({ quality: targetQuality }).toBuffer()
                break
            default:
                outputBuffer = await pipeline.toBuffer()
        }

        const originalName = file.name
        const nameWithoutExt = originalName.substring(0, originalName.lastIndexOf('.')) || originalName
        const finalExt = targetFormat === 'jpg' ? 'jpeg' : targetFormat
        const newName = `${nameWithoutExt}.${finalExt}`
        
        processedImages.push({ name: newName, buffer: outputBuffer })
    }

    if (processedImages.length === 0) {
        set.status = 400
        return 'No valid images processed'
    }

    const metadata = processedImages.map(img => ({
        name: img.name,
        size: img.buffer.length
    }))
    set.headers['X-Optimized-Metadata'] = JSON.stringify(metadata)

    if (processedImages.length === 1) {
      set.headers['Content-Type'] = `image/${processedImages[0].name.split('.').pop()}`
      set.headers['Content-Disposition'] = `attachment; filename="${processedImages[0].name}"`
      return processedImages[0].buffer
    } else {
      const zip = new AdmZip()
      for (const img of processedImages) {
        zip.addFile(img.name, img.buffer)
      }
      
      set.headers['Content-Type'] = 'application/zip'
      set.headers['Content-Disposition'] = 'attachment; filename="optimized_images_batch.zip"'
      return zip.toBuffer()
    }
  })
