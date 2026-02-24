import { UserService } from '../services/user.service'

const userService = new UserService()

export const UserController = {
  getUsers: async () => {
    return await userService.getAllUsers()
  },
}
