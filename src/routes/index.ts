import { Elysia } from 'elysia'
import { userRoute } from './user.route'

export const routes = new Elysia({ prefix: '/api' }).use(userRoute)
