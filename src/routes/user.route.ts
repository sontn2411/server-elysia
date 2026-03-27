import { Elysia, t } from 'elysia'
import { jwt } from '@elysiajs/jwt'
import { rateLimit } from 'elysia-rate-limit'
import { UserController } from '../controllers/user.controller'

export const userRoute = new Elysia({ prefix: '/users' })
  .use(
    jwt({
      name: 'accessJwt',
      secret: process.env.JWT_ACCESS_SECRET || 'access-secret',
      exp: '7d',
    }),
  )
  .use(
    jwt({
      name: 'refreshJwt',
      secret: process.env.JWT_REFRESH_SECRET || 'refresh-secret',
      exp: '30d',
    }),
  )
  .use(
    rateLimit({
      max: 1000,
      duration: 60000, // 1000 requests per minute
      countFailedRequest: false,
      generator: (req, server) => {
        // use IP for rate limiting, with localhost bypass for dev
        const ip = server?.requestIP(req)?.address || req.headers.get('x-forwarded-for') || 'global';
        if (ip === '127.0.0.1' || ip === '::1') return ''; // Bypass limit for localhost
        return ip;
      },
      skip: (req) => {
        // Skip rate limit for the Image Tool routes to ensure large uploads/downloads aren't blocked
        const url = new URL(req.url);
        return url.pathname.startsWith('/image-tool');
      }
    }),
  )
  .get('/', () => UserController.getUsers())
  .post('/register', UserController.register, {
    body: t.Object({
      username: t.String({
        minLength: 3,
        maxLength: 50,
        pattern: '^[a-zA-Z0-9_]+$',
      }),
      email: t.String({ format: 'email', maxLength: 100 }),
      password: t.String({ minLength: 6, maxLength: 100 }),
    }),
  })
  .post('/login', UserController.login, {
    body: t.Object({
      identity: t.String({ minLength: 3, maxLength: 100 }),
      password: t.String({ minLength: 6, maxLength: 100 }),
    }),
  })
  .post('/google-login', UserController.googleLogin, {
    body: t.Object({
      token: t.String(),
    }),
  })
  .post('/refresh', UserController.refresh, {
    body: t.Object({
      refreshToken: t.String(),
    }),
  })
  .get('/profile', UserController.getProfile)
