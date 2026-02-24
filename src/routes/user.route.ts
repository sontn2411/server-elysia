import { Elysia } from 'elysia'
import { UserController } from '../controllers/user.controller'

export const userRoute = new Elysia({ prefix: '/users' }).get('/', () =>
  UserController.getUsers(),
)
