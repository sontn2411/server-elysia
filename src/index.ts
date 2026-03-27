import { Elysia } from 'elysia'
import { html } from '@elysiajs/html'
import { cors } from '@elysiajs/cors'
import { swagger } from '@elysiajs/swagger'
import { staticPlugin } from '@elysiajs/static'
import { routes } from './routes'
import { AppError } from './utils/errors'
import { adminRoute } from './routes/admin.route'
import { imageToolRoute } from './routes/image-tool.route'

const app = new Elysia()
  .use(staticPlugin({
    prefix: '/'
  }))
  .use(html())
  .use(cors({
    exposeHeaders: ['X-Optimized-Metadata']
  }))
  .use(swagger())
  .error({
    APP_ERROR: AppError,
  })
  .onError(({ code, error, set }) => {
    // ... error handling remains same ...
    const err = error as any

    if (code === 'VALIDATION') {
      set.status = 422
      return {
        success: false,
        error: {
          status: 422,
          code: 'VALIDATION_ERROR',
          message: 'Invalid input data',
          details: err.all.map((e: any) => ({
            field: e.path.startsWith('/') ? e.path.substring(1) : e.path,
            message: e.message,
            summary: e.summary,
          })),
        },
      }
    }

    // Identify custom app errors
    const isAppError =
      err?._isAppError === true ||
      (err?.status !== undefined && err?.code !== undefined) ||
      [
        'AppError',
        'ConflictError',
        'BadRequestError',
        'NotFoundError',
      ].includes(err?.name)

    if (isAppError) {
      const status = err.status || 500
      const errorCode = err.code || 'APP_ERROR'

      set.status = status
      return {
        success: false,
        error: {
          status,
          code: errorCode,
          message: err.message || 'Error occurred',
          details: err.details,
        },
      }
    }

    console.error('Unhandled Error:', error)
    const message = (error as any)?.message || 'Internal Server Error'

    set.status = 500
    return {
      success: false,
      error: {
        status: 500,
        code: 'INTERNAL_SERVER_ERROR',
        message,
      },
    }
  })
  .use(adminRoute)
  .use(routes)
  .use(imageToolRoute)
  .listen(3000)

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`,
)
