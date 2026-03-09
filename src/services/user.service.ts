import { eq, or } from 'drizzle-orm'
import { db } from '../configs/db'
import { users } from '../models/user.model'
import { ConflictError, BadRequestError } from '../utils/errors'
import { OAuth2Client } from 'google-auth-library'

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID)

export class UserService {
  async getAllUsers() {
    return await db.select().from(users)
  }

  async googleLogin(idToken: string) {
    if (!idToken) {
      throw new BadRequestError('ID Token is required')
    }

    try {
      const ticket = await googleClient.verifyIdToken({
        idToken,
        audience: process.env.GOOGLE_CLIENT_ID,
      })
      const payload = ticket.getPayload()

      if (!payload || !payload.email) {
        throw new BadRequestError('Invalid Google Token payload')
      }

      const { email, name } = payload

      // Check if user exists
      const existingUser = await db
        .select()
        .from(users)
        .where(eq(users.email, email))

      if (existingUser.length > 0) {
        // User exists, login
        if (existingUser[0].status === 'LOCKED') {
          throw {
            _isAppError: true,
            status: 403,
            code: 'FORBIDDEN',
            message: 'Your account has been locked',
          }
        }
        return {
          userId: existingUser[0].userId,
          username: existingUser[0].username,
          email: existingUser[0].email,
        }
      }

      // User does not exist, auto-register
      let baseUsername =
        name?.replace(/\s+/g, '').toLowerCase() || email.split('@')[0]
      let uniqueUsername = baseUsername
      let isUnique = false
      let suffix = 0

      while (!isUnique) {
        const usernameCheck = await db
          .select()
          .from(users)
          .where(eq(users.username, uniqueUsername))
        if (usernameCheck.length === 0) {
          isUnique = true
        } else {
          suffix++
          uniqueUsername = `${baseUsername}_${suffix}`
        }
      }

      const randomPassword = crypto.randomUUID() + crypto.randomUUID()
      const hashedPassword = await Bun.password.hash(randomPassword, {
        algorithm: 'argon2id',
        memoryCost: 4,
        timeCost: 3,
      })

      const newUser = {
        userId: crypto.randomUUID(),
        username: uniqueUsername,
        email,
        password: hashedPassword,
        status: 'ACTIVE' as const,
      }

      await db.insert(users).values(newUser)

      return {
        userId: newUser.userId,
        username: newUser.username,
        email: newUser.email,
      }
    } catch (error) {
      console.error('Google verification error:', error)
      throw {
        _isAppError: true,
        status: 401,
        code: 'UNAUTHORIZED',
        message: 'Invalid Google token',
      }
    }
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
      status: 'ACTIVE' as const,
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
        status: 403,
        code: 'FORBIDDEN',
        message: 'Invalid username/email or password',
      }
    }

    if (user[0].status === 'LOCKED') {
      throw {
        _isAppError: true,
        status: 403,
        code: 'FORBIDDEN',
        message: 'Your account has been locked',
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
        status: 403,
        code: 'FORBIDDEN',
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
        isAdmin: users.isAdmin,
      })
      .from(users)
      .where(eq(users.userId, userId))

    return user.length > 0 ? user[0] : null
  }
}
