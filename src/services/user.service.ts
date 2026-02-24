import { db } from '../configs/db'
import { users } from '../models/user.model'

export class UserService {
  async getAllUsers() {
    return await db.select().from(users)
  }
}
