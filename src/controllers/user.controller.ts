import { UserService } from '../services/user.service'

const userService = new UserService()

export const UserController = {
  getUsers: async () => {
    return await userService.getAllUsers()
  },
  register: async ({ body }: any) => {
    return await userService.register(body)
  },
  login: async ({ body, accessJwt, refreshJwt }: any) => {
    const user = await userService.login(body)

    const accessToken = await accessJwt.sign({
      sub: user.userId,
      username: user.username,
    })

    const rawRefreshToken = await refreshJwt.sign({
      sub: user.userId,
    })
    const refreshToken = Buffer.from(rawRefreshToken).toString('base64url')

    await userService.updateRefreshToken(user.userId, refreshToken)

    return {
      message: 'Login successful',
      accessToken,
      refreshToken,
      user: {
        username: user.username,
        email: user.email,
      },
    }
  },
  googleLogin: async ({ body, accessJwt, refreshJwt }: any) => {
    const { token } = body
    const user = await userService.googleLogin(token)

    const accessToken = await accessJwt.sign({
      sub: user.userId,
      username: user.username,
    })

    const rawRefreshToken = await refreshJwt.sign({
      sub: user.userId,
    })
    const refreshToken = Buffer.from(rawRefreshToken).toString('base64url')

    await userService.updateRefreshToken(user.userId, refreshToken)

    return {
      message: 'Google login successful',
      accessToken,
      refreshToken,
      user: {
        username: user.username,
        email: user.email,
      },
    }
  },
  refresh: async ({ body: { refreshToken }, refreshJwt, accessJwt }: any) => {
    let rawRefreshToken = refreshToken
    try {
      rawRefreshToken = Buffer.from(refreshToken, 'base64url').toString('utf-8')
    } catch (e) {
      // Will fail verification below
    }

    const payload = await refreshJwt.verify(rawRefreshToken)

    if (!payload) {
      throw {
        _isAppError: true,
        status: 401,
        code: 'UNAUTHORIZED',
        message: 'Invalid or expired refresh token',
      }
    }

    const user = await userService.getUserByRefreshToken(refreshToken)

    if (!user) {
      if (payload && payload.sub) {
        await userService.updateRefreshToken(payload.sub as string, null)
      }

      throw {
        _isAppError: true,
        status: 401,
        code: 'UNAUTHORIZED',
        message:
          'Refresh token reused. Security breach detected. All tokens revoked.',
      }
    }

    const newAccessToken = await accessJwt.sign({
      sub: user.userId,
      username: user.username,
    })

    const newRawRefreshToken = await refreshJwt.sign({
      sub: user.userId,
    })
    const newRefreshToken =
      Buffer.from(newRawRefreshToken).toString('base64url')

    await userService.updateRefreshToken(user.userId, newRefreshToken)

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    }
  },
  getProfile: async ({ headers, accessJwt }: any) => {
    const authHeader = headers['authorization']

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw {
        _isAppError: true,
        status: 401,
        code: 'UNAUTHORIZED',
        message: 'Missing or invalid authorization header',
      }
    }

    const token = authHeader.split(' ')[1]
    const payload = await accessJwt.verify(token)

    if (!payload || !payload.sub) {
      throw {
        _isAppError: true,
        status: 401,
        code: 'UNAUTHORIZED',
        message: 'Invalid or expired access token',
      }
    }

    const userProfile = await userService.getUserById(payload.sub as string)

    if (!userProfile) {
      throw {
        _isAppError: true,
        status: 404,
        code: 'USER_NOT_FOUND',
        message: 'User does not exist',
      }
    }

    const { refreshToken: _, ...safeProfile } = userProfile

    return {
      message: 'Get profile successful',
      profile: safeProfile,
      refreshToken: userProfile.refreshToken,
    }
  },
}
