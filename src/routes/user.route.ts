import { Elysia, t } from 'elysia'
import { jwt } from '@elysiajs/jwt'
import { rateLimit } from 'elysia-rate-limit'
import { UserController } from '../controllers/user.controller'

export const userRoute = new Elysia({ prefix: '/users' })
  .use(
    jwt({
      name: 'accessJwt',
      secret: process.env.JWT_ACCESS_SECRET || 'access-secret',
      exp: '1d',
    }),
  )
  .use(
    jwt({
      name: 'refreshJwt',
      secret: process.env.JWT_REFRESH_SECRET || 'refresh-secret',
      exp: '7d',
    }),
  )
  .use(
    rateLimit({
      max: 10,
      duration: 60000, // 10 requests per minute
      countFailedRequest: true,
      generator: (req) => {
        // use IP for rate limiting
        return (
          req.headers.get('x-forwarded-for') ||
          req.headers.get('cf-connecting-ip') ||
          'global'
        )
      },
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
  .post('/refresh', UserController.refresh, {
    body: t.Object({
      refreshToken: t.String(),
    }),
  })
  .get('/profile', UserController.getProfile)
