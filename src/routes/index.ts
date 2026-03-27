import { Elysia } from 'elysia'
import { userRoute } from './user.route'
import { imageRoute } from './image.route'

export const routes = new Elysia({ prefix: '/api' })
  .use(userRoute)
  .use(imageRoute)
