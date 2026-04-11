import { Elysia, t } from 'elysia'
import { spawn } from 'child_process'
import path from 'path'
import fs from 'fs'

const YTDLP_PATH = process.env.YTDLP_PATH || 'yt-dlp'
const FFMPEG_PATH = process.env.FFMPEG_PATH || 'ffmpeg'
const DOWNLOAD_DIR = path.join(process.cwd(), 'tmp/youtube-downloads')

// Store file metadata for serving via GET
const pendingFiles: Map<
  string,
  { path: string; contentType: string; filename: string }
> = new Map()

// Store download progress for SSE
const downloadProgress: Map<
  string,
  {
    percent: number
    speed: string
    eta: string
    status: string
    startTime: number
    fileId: string | null
  }
> = new Map()

// Ensure download directory exists and clean orphaned files
if (!fs.existsSync(DOWNLOAD_DIR)) {
  fs.mkdirSync(DOWNLOAD_DIR, { recursive: true })
} else {
  // Clean files older than 1 hour on startup
  const files = fs.readdirSync(DOWNLOAD_DIR)
  const oneHourAgo = Date.now() - 60 * 60 * 1000
  let cleanedCount = 0

  for (const file of files) {
    const filePath = path.join(DOWNLOAD_DIR, file)
    const stat = fs.statSync(filePath)

    if (stat.mtimeMs < oneHourAgo) {
      try {
        fs.unlinkSync(filePath)
        cleanedCount++
      } catch (e) {
        // Skip files that can't be deleted
      }
    }
  }

  if (cleanedCount > 0) {
    console.log(
      `[youtube] Cleaned ${cleanedCount} orphaned file(s) from ${DOWNLOAD_DIR}`,
    )
  }
}

interface FormatConfig {
  format: string
  audioOnly: boolean
  quality: string
  ext: string
}

const FORMAT_MAP: Record<string, FormatConfig> = {
  'mp4-1080': {
    format:
      'bestvideo[height<=1080][vcodec^=avc1]+bestaudio[acodec^=mp4a]/bestvideo[height<=1080]+bestaudio/best[height<=1080]',
    audioOnly: false,
    quality: '1080p',
    ext: 'mp4',
  },
  'mp4-720': {
    format:
      'bestvideo[height<=720][vcodec^=avc1]+bestaudio[acodec^=mp4a]/bestvideo[height<=720]+bestaudio/best[height<=720]',
    audioOnly: false,
    quality: '720p',
    ext: 'mp4',
  },
  'mp4-480': {
    format:
      'bestvideo[height<=480][vcodec^=avc1]+bestaudio[acodec^=mp4a]/bestvideo[height<=480]+bestaudio/best[height<=480]',
    audioOnly: false,
    quality: '480p',
    ext: 'mp4',
  },
  'mp3-320': {
    format: 'bestaudio',
    audioOnly: true,
    quality: '320k',
    ext: 'mp3',
  },
  'mp3-128': {
    format: 'bestaudio',
    audioOnly: true,
    quality: '128k',
    ext: 'mp3',
  },
  best: {
    format: 'bestvideo+bestaudio/best',
    audioOnly: false,
    quality: 'best',
    ext: 'mp4',
  },
}

function sanitizeFilename(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 100)
}

// Estimate file size for a given height from available formats
function estimateSize(formats: any[], targetHeight: number): number | null {
  // Find video format with matching height that has filesize info
  const videoFormat = formats.find(
    (f) =>
      f.height === targetHeight &&
      f.filesize_approx !== undefined &&
      f.filesize_approx > 0,
  )

  if (videoFormat?.filesize_approx) {
    return videoFormat.filesize_approx
  }

  // Fallback: find closest height with filesize
  const withSize = formats
    .filter((f) => f.filesize_approx > 0 && f.height)
    .sort(
      (a, b) =>
        Math.abs(a.height - targetHeight) - Math.abs(b.height - targetHeight),
    )

  if (withSize.length > 0) {
    // Scale by pixel count ratio
    const ratio =
      (targetHeight * targetHeight) / (withSize[0].height * withSize[0].height)
    return Math.round(withSize[0].filesize_approx * ratio)
  }

  return null
}

function parseYtDlpProgress(
  data: string,
): { percent: number; speed: string; eta: string } | null {
  // yt-dlp progress format: [download]  50.0% of ~ 50.00MiB at    2.50MiB/s ETA 00:10
  // or: [download]  75.0% of    5.00MiB at    1.20MiB/s ETA 00:05
  // or: [download]  100% of    5.00MiB in    00:02
  const match = data.match(
    /\[download\]\s+([\d.]+)%.*?at\s+([^\s]+).*?ETA\s+([^\s\n]+)/,
  )
  if (match) {
    return {
      percent: parseFloat(match[1]),
      speed: match[2],
      eta: match[3],
    }
  }
  // Check for "100%" without ETA (final line)
  if (data.includes('[download]') && data.includes('100%')) {
    return { percent: 100, speed: '', eta: '00:00' }
  }
  return null
}

async function runYtDlp(
  args: string[],
  onData?: (data: string) => void,
): Promise<{ stdout: string; stderr: string; code: number }> {
  console.log('[yt-dlp] Spawning with args:', args.join(' '))

  return new Promise((resolve, reject) => {
    const proc = spawn(YTDLP_PATH, args)

    let stdout = ''
    let stderr = ''

    proc.stdout.on('data', (chunk) => {
      const text = chunk.toString()
      stdout += text
      if (onData) onData(text)
    })

    proc.stderr.on('data', (chunk) => {
      const text = chunk.toString()
      stderr += text
      if (onData) onData(text)
    })

    proc.on('close', (code) => {
      console.log(`[yt-dlp] Process closed with code: ${code}`)
      console.log(`[yt-dlp] Stderr: ${stderr.substring(0, 500)}`)
      resolve({ stdout, stderr, code: code ?? 0 })
    })

    proc.on('error', (err) => {
      console.error('[yt-dlp] Process error:', err.message)
      reject(err)
    })
  })
}

export const youtubeRoute = new Elysia()
  // Serve YouTube Downloader UI
  .get('/youtube', () => Bun.file('src/views/youtube.html'))

  // SSE endpoint for real-time download progress
  .get('/youtube/progress/:taskId', ({ params, set }) => {
    const { taskId } = params

    set.headers['Content-Type'] = 'text/event-stream'
    set.headers['Cache-Control'] = 'no-cache'
    set.headers['Connection'] = 'keep-alive'

    const stream = new ReadableStream({
      start(controller) {
        // Send initial message
        controller.enqueue(
          `data: ${JSON.stringify({ status: 'starting', percent: 0 })}\n\n`,
        )

        // Poll for progress updates
        const interval = setInterval(() => {
          const progress = downloadProgress.get(taskId)
          if (progress) {
            const elapsed = ((Date.now() - progress.startTime) / 1000).toFixed(
              0,
            )
            const payload: any = {
              status: progress.status,
              percent: progress.percent,
              speed: progress.speed,
              eta: progress.eta,
              elapsed: `${elapsed}s`,
            }

            // Include fileId when completed
            if (progress.status === 'completed' && progress.fileId) {
              payload.fileId = progress.fileId
            }

            controller.enqueue(`data: ${JSON.stringify(payload)}\n\n`)
          }

          // Check if download is complete
          const progressData = downloadProgress.get(taskId)
          if (
            !progressData ||
            progressData.status === 'completed' ||
            progressData.status === 'error'
          ) {
            clearInterval(interval)
            controller.enqueue(
              `data: ${JSON.stringify({ status: 'done' })}\n\n`,
            )
            controller.close()
            // Keep progress in Map for 30s so client can poll again
            setTimeout(() => downloadProgress.delete(taskId), 30000)
          }
        }, 500)
      },
    })

    return new Response(stream)
  })

  // Serve downloaded file via fileId (GET endpoint for native browser download)
  .get('/youtube/file/:fileId', async ({ params, set }) => {
    const { fileId } = params
    const fileInfo = pendingFiles.get(fileId)

    if (!fileInfo) {
      set.status = 404
      return 'File not found or expired'
    }

    if (!fs.existsSync(fileInfo.path)) {
      pendingFiles.delete(fileId)
      set.status = 404
      return 'File has been deleted'
    }

    set.headers['Content-Type'] = fileInfo.contentType
    set.headers['Content-Disposition'] =
      `attachment; filename="${fileInfo.filename}"`

    // Clean up after serving (schedule with delay)
    pendingFiles.delete(fileId)
    setTimeout(() => {
      try {
        if (fs.existsSync(fileInfo.path)) {
          fs.unlinkSync(fileInfo.path)
        }
      } catch (e) {
        // File already deleted
      }
    }, 10000)

    return Bun.file(fileInfo.path)
  })

  // Get video info
  .post(
    '/youtube/info',
    async ({ body, set }) => {
      const { url } = body

      if (!url) {
        set.status = 400
        return 'URL is required'
      }

      try {
        const { stdout, code } = await runYtDlp([
          '--dump-json',
          '--no-playlist',
          '--no-warnings',
          url,
        ])

        if (code !== 0) {
          set.status = 400
          return `Không thể lấy thông tin video. Kiểm tra lại URL hoặc đảm bảo yt-dlp đã được cài đặt.`
        }

        const info = JSON.parse(stdout)

        // Format upload date to readable string
        let uploadDate = null
        if (info.upload_date) {
          const dateStr = info.upload_date.toString()
          uploadDate = `${dateStr.substring(6, 8)}/${dateStr.substring(4, 6)}/${dateStr.substring(0, 4)}`
        }

        // Get best thumbnail
        const bestThumbnail =
          info.thumbnails?.find((t: any) => t.url && t.width >= 480) ||
          info.thumbnails?.pop()

        // Estimate file sizes per format
        const fileSizes = info.formats
          ? {
              'mp4-1080': estimateSize(info.formats, 1080),
              'mp4-720': estimateSize(info.formats, 720),
              'mp4-480': estimateSize(info.formats, 480),
            }
          : null

        return {
          title: info.title || 'Unknown',
          author: info.channel || info.uploader || 'Unknown',
          channel_url: info.channel_url || info.channel_follower_count || null,
          duration:
            info.duration_string || `${Math.floor(info.duration / 60)} phút`,
          duration_seconds: info.duration || 0,
          thumbnail: info.thumbnail || bestThumbnail?.url || '',
          id: info.id,
          // Extended info
          view_count: info.view_count || null,
          like_count: info.like_count || null,
          upload_date: uploadDate,
          description: info.description?.substring(0, 300) || null,
          categories: info.categories || info.tags?.slice(0, 5) || [],
          live_status: info.live_status || 'not_live',
          resolution: info.resolution || null,
          fps: info.fps || null,
          age_limit: info.age_limit || null,
          channel_follower_count: info.channel_follower_count || null,
          file_sizes: fileSizes,
        }
      } catch (error: any) {
        console.error('YouTube info error:', error)
        set.status = 500
        return error.message || 'Lỗi khi lấy thông tin video'
      }
    },
    {
      body: t.Object({
        url: t.String(),
      }),
    },
  )

  // Download video - returns taskId immediately, runs yt-dlp in background
  .post(
    '/youtube/download',
    async ({ body, set }) => {
      const { url, format = 'mp4-1080' } = body
      const formatConfig = FORMAT_MAP[format]

      if (!formatConfig) {
        set.status = 400
        return 'Định dạng không hợp lệ'
      }

      if (!url) {
        set.status = 400
        return 'URL là bắt buộc'
      }

      const timestamp = Date.now()
      const taskId = `task_${timestamp}`

      // Initialize progress tracking
      downloadProgress.set(taskId, {
        percent: 0,
        speed: '',
        eta: '',
        status: 'starting',
        startTime: Date.now(),
        fileId: null as string | null,
      })

      // Return taskId immediately so client can connect SSE
      set.status = 202

      // Run yt-dlp in background (fire and forget)
      ;(async () => {
        try {
          // Step 1: Get video title
          console.log(`[youtube/background] Fetching video info: ${url}`)
          const { stdout: infoJson, code: infoCode } = await runYtDlp([
            '--dump-json',
            '--no-playlist',
            '--no-warnings',
            url,
          ])

          if (infoCode !== 0) {
            console.error(`[youtube/background] Failed to get video info`)
            downloadProgress.set(taskId, {
              percent: 0,
              speed: '',
              eta: '',
              status: 'error',
              startTime: downloadProgress.get(taskId)?.startTime || Date.now(),
              fileId: null,
            })
            return
          }

          const videoInfo = JSON.parse(infoJson)
          const rawTitle = videoInfo.title || 'Unknown'
          const sanitizedTitle = sanitizeFilename(rawTitle)
          const outputTemplate = path.join(
            DOWNLOAD_DIR,
            `${timestamp}_${sanitizedTitle}`,
          )

          console.log(`[youtube/background] Title: ${rawTitle}`)

          const ytDlpArgs = [
            '--newline',
            '--no-playlist',
            '--no-warnings',
            '-f',
            formatConfig.format,
            '-o',
            outputTemplate,
          ]

          // Add format-specific options
          if (formatConfig.audioOnly) {
            ytDlpArgs.push(
              '-x',
              '--audio-format',
              'mp3',
              '--audio-quality',
              formatConfig.quality,
              '--no-mtime',
            )
          } else {
            ytDlpArgs.push(
              '--merge-output-format',
              'mp4',
              '--recode-video',
              'mp4',
              '--no-mtime',
            )
          }

          ytDlpArgs.push(url)

          console.log(
            `[youtube/background] Starting download: url=${url}, format=${format}`,
          )

          const { code, stderr } = await runYtDlp(ytDlpArgs, (data) => {
            const progress = parseYtDlpProgress(data)
            if (progress) {
              const current = downloadProgress.get(taskId)
              if (current) {
                downloadProgress.set(taskId, {
                  ...current,
                  ...progress,
                  status:
                    progress.percent >= 100 ? 'processing' : 'downloading',
                })
              }
            }
          })

          if (code !== 0) {
            console.error(
              `[youtube/background] yt-dlp failed (code=${code}). Stderr:`,
              stderr,
            )
            downloadProgress.set(taskId, {
              percent: 0,
              speed: '',
              eta: '',
              status: 'error',
              startTime: downloadProgress.get(taskId)?.startTime || Date.now(),
              fileId: null,
            })
            return
          }

          // Find the downloaded file
          const files = fs
            .readdirSync(DOWNLOAD_DIR)
            .filter((f) => f.startsWith(`${timestamp}`))

          console.log(`[youtube/background] Found files:`, files)

          if (files.length === 0) {
            downloadProgress.set(taskId, {
              percent: 0,
              speed: '',
              eta: '',
              status: 'error',
              startTime: downloadProgress.get(taskId)?.startTime || Date.now(),
              fileId: null,
            })
            return
          }

          // Find the actual video/audio file and rename if needed
          let downloadedFile = path.join(DOWNLOAD_DIR, files[0])

          if (files[0].endsWith('.mp4_') || files[0].endsWith('.webm_')) {
            const properName = files[0].replace(/\.(mp4|webm)_$/, '.mp4')
            const properPath = path.join(DOWNLOAD_DIR, properName)
            console.log(
              `[youtube/background] Renaming ${files[0]} → ${properName}`,
            )
            fs.renameSync(downloadedFile, properPath)
            downloadedFile = properPath
          } else if (files[0].endsWith('.mp3_')) {
            const properName = files[0].replace(/\.mp3_$/, '.mp3')
            const properPath = path.join(DOWNLOAD_DIR, properName)
            console.log(
              `[youtube/background] Renaming ${files[0]} → ${properName}`,
            )
            fs.renameSync(downloadedFile, properPath)
            downloadedFile = properPath
          }

          // Generate fileId and store file info
          const fileId = crypto.randomUUID()
          const ext = formatConfig.audioOnly ? 'mp3' : 'mp4'
          const outputFilename = `${sanitizedTitle}_${timestamp}.${ext}`
          pendingFiles.set(fileId, {
            path: downloadedFile,
            contentType: formatConfig.audioOnly ? 'audio/mpeg' : 'video/mp4',
            filename: outputFilename,
          })

          console.log(
            `[youtube/background] File ready: ${downloadedFile}, fileId: ${fileId}`,
          )

          // Mark as completed with fileId
          downloadProgress.set(taskId, {
            percent: 100,
            speed: '',
            eta: '00:00',
            status: 'completed',
            startTime: downloadProgress.get(taskId)?.startTime || Date.now(),
            fileId,
          })

          // Auto-cleanup: delete file after 5 minutes regardless of whether client downloaded it
          setTimeout(
            () => {
              try {
                if (fs.existsSync(downloadedFile)) {
                  fs.unlinkSync(downloadedFile)
                  console.log(
                    `[youtube/background] Auto-cleaned: ${downloadedFile}`,
                  )
                }
                pendingFiles.delete(fileId)
              } catch (e) {
                // File already deleted or doesn't exist
              }
            },
            5 * 60 * 1000,
          ) // 5 minutes
        } catch (error: any) {
          console.error('[youtube/background] Error:', error)
          downloadProgress.set(taskId, {
            percent: 0,
            speed: '',
            eta: '',
            status: 'error',
            startTime: Date.now(),
            fileId: null,
          })
        }
      })()

      // Return taskId immediately
      return { taskId }
    },
    {
      body: t.Object({
        url: t.String(),
        format: t.Optional(t.String()),
      }),
    },
  )
