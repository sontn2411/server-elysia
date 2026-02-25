import { eq, or } from 'drizzle-orm'
import { db } from '../configs/db'
import { users } from '../models/user.model'
import { ConflictError, BadRequestError } from '../utils/errors'

export class UserService {
  async getAllUsers() {
    return await db.select().from(users)
  }

  async register(data: any) {
    const { username, email, password } = data

    // Check full fields
    if (!username || !email || !password) {
      throw new BadRequestError('Username, Email, and Password are required')
    }

    // Check existing
    const existing = await db
      .select()
      .from(users)
      .where(or(eq(users.username, username), eq(users.email, email)))

    if (existing.length > 0) {
      throw new ConflictError('Username or Email already exists')
    }

    const hashedPassword = await Bun.password.hash(password, {
      algorithm: 'argon2id',
      memoryCost: 4, // mb
      timeCost: 3,
    })

    const newUser = {
      userId: crypto.randomUUID(),
      username,
      email,
      password: hashedPassword,
    }

    await db.insert(users).values(newUser)

    return {
      message: 'User registered successfully',
      user: {
        username: newUser.username,
        email: newUser.email,
      },
    }
  }

  async login(data: any) {
    const { identity, password } = data

    if (!identity || !password) {
      throw new BadRequestError('Identity and Password are required')
    }

    const user = await db
      .select()
      .from(users)
      .where(or(eq(users.username, identity), eq(users.email, identity)))

    if (user.length === 0) {
      throw {
        _isAppError: true,
        status: 401,
        code: 'UNAUTHORIZED',
        message: 'Invalid username/email or password',
      }
    }

    const isMatch = await Bun.password.verify(
      password,
      user[0].password,
      'argon2id',
    )
    if (!isMatch) {
      throw {
        _isAppError: true,
        status: 401,
        code: 'UNAUTHORIZED',
        message: 'Invalid username/email or password',
      }
    }

    return {
      userId: user[0].userId,
      username: user[0].username,
      email: user[0].email,
    }
  }

  async updateRefreshToken(userId: string, refreshToken: string | null) {
    await db.update(users).set({ refreshToken }).where(eq(users.userId, userId))
  }

  async getUserByRefreshToken(refreshToken: string) {
    const user = await db
      .select()
      .from(users)
      .where(eq(users.refreshToken, refreshToken))

    return user.length > 0 ? user[0] : null
  }

  async getUserById(userId: string) {
    const user = await db
      .select({
        id: users.id,
        userId: users.userId,
        username: users.username,
        email: users.email,
        refreshToken: users.refreshToken,
      })
      .from(users)
      .where(eq(users.userId, userId))

    return user.length > 0 ? user[0] : null
  }
}
