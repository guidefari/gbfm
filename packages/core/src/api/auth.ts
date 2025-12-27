import { Data, Effect } from 'effect'
import { z } from 'zod'

const isDev = process.env.NODE_ENV === 'development'

function logError(
  context: string,
  error: unknown,
  details?: Record<string, unknown>
) {
  if (!isDev) return

  console.error(`[Auth Error - ${context}]`, {
    error:
      error instanceof Error
        ? {
            message: error.message,
            name: error.name,
            stack: error.stack
          }
        : error,
    ...details
  })
}

class AuthError extends Data.TaggedError('AuthError')<{
  message: string
  cause?: unknown
}> {}

class NetworkError extends Data.TaggedError('NetworkError')<{
  message: string
  status: number
}> {}

export const userSchema = z.object({
  id: z.string(),
  name: z.string(),
  username: z.string().nullable(),
  email: z.email(),
  avatarUrl: z.string().nullable()
})

export type User = z.infer<typeof userSchema>

export const fullUserSchema = userSchema.extend({
  verified: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string()
})

export type FullUser = z.infer<typeof fullUserSchema>

export const loginRequestSchema = z.object({
  email: z.email(),
  password: z.string().min(1)
})

export type LoginRequest = z.infer<typeof loginRequestSchema>

export const loginResponseSchema = z.object({
  user: fullUserSchema,
  accessToken: z.string(),
  refreshToken: z.string()
})

export type LoginResponse = z.infer<typeof loginResponseSchema>

export const refreshTokenRequestSchema = z.object({
  refreshToken: z.string()
})

export type RefreshTokenRequest = z.infer<typeof refreshTokenRequestSchema>

export const refreshTokenResponseSchema = z.object({
  accessToken: z.string()
})

export type RefreshTokenResponse = z.infer<typeof refreshTokenResponseSchema>

export async function login(
  baseUrl: string,
  credentials: LoginRequest
): Promise<LoginResponse> {
  if (isDev) {
    console.log('[Auth - Login]', {
      url: `${baseUrl}/auth/signin`,
      email: credentials.email
    })
  }

  return Effect.gen(function* () {
    const response = yield* Effect.tryPromise({
      try: () =>
        fetch(`${baseUrl}/api/auth/sign-in-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(credentials)
        }),
      catch: (error) => {
        logError('Login Fetch Failed', error, {
          url: `${baseUrl}/auth/signin`,
          email: credentials.email
        })
        return new NetworkError({
          message:
            error instanceof Error
              ? error.message
              : 'Failed to connect to authentication server',
          status: 0
        })
      }
    })

    if (isDev) {
      console.log('[Auth - Login Response]', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
      })
    }

    if (!response.ok) {
      const errorData = yield* Effect.tryPromise({
        try: () => response.json(),
        catch: () => {
          logError('Login Error Response Parse Failed', null, {
            status: response.status,
            statusText: response.statusText
          })
          return new AuthError({
            message: `Login failed: ${response.statusText}`
          })
        }
      })

      if (isDev) {
        console.error('[Auth - Login Error Response]', errorData)
      }

      const errorMessage = z
        .object({ message: z.string() })
        .safeParse(errorData)

      return yield* Effect.fail(
        new AuthError({
          message: errorMessage.success
            ? errorMessage.data.message
            : `Login failed: ${response.statusText}`
        })
      )
    }

    const data = yield* Effect.tryPromise({
      try: () => response.json(),
      catch: (error) => {
        logError('Login Response Parse Failed', error, {
          status: response.status
        })
        return new AuthError({
          message: 'Failed to parse login response',
          cause: error
        })
      }
    })

    if (isDev) {
      const tempData = z
        .object({
          user: z.record(z.string(), z.unknown()).optional(),
          accessToken: z.unknown().optional(),
          refreshToken: z.unknown().optional()
        })
        .safeParse(data)

      console.log('[Auth - Login Data]', {
        hasUser: tempData.success && !!tempData.data.user,
        hasAccessToken: tempData.success && !!tempData.data.accessToken,
        hasRefreshToken: tempData.success && !!tempData.data.refreshToken,
        userKeys:
          tempData.success && tempData.data.user
            ? Object.keys(tempData.data.user)
            : []
      })
    }

    // Map Better Auth response to legacy format
    const validatedData = z.object({
      user: z.object({
        id: z.string(),
        name: z.string(),
        email: z.string(),
        emailVerified: z.boolean(),
        image: z.string().nullable().optional(),
        createdAt: z.string().or(z.date()),
        updatedAt: z.string().or(z.date()),
      }),
      token: z.string()
    }).safeParse(data)

    if (!validatedData.success) {
      logError('Login Response Validation Failed', validatedData.error, {
        receivedData: data
      })
      return yield* Effect.fail(
        new AuthError({
          message: 'Invalid login response format from Better Auth',
          cause: validatedData.error
        })
      )
    }

    const { user: baUser, token } = validatedData.data

    const mappedResponse: LoginResponse = {
      user: {
        id: baUser.id,
        name: baUser.name,
        username: baUser.name,
        email: baUser.email,
        avatarUrl: baUser.image || null,
        verified: baUser.emailVerified,
        createdAt: typeof baUser.createdAt === 'string' ? baUser.createdAt : baUser.createdAt.toISOString(),
        updatedAt: typeof baUser.updatedAt === 'string' ? baUser.updatedAt : baUser.updatedAt.toISOString(),
      },
      accessToken: token,
      refreshToken: token
    }

    if (isDev) {
      console.log('[Auth - Login Success]')
    }

    return mappedResponse
  }).pipe(Effect.runPromise)
}

export async function refreshAccessToken(
  baseUrl: string,
  refreshToken: string
): Promise<RefreshTokenResponse> {
  if (isDev) {
    console.log('[Auth - Refresh Token]', {
      url: `${baseUrl}/auth/refresh-token`,
      tokenLength: refreshToken.length
    })
  }

  return Effect.gen(function* () {
    const response = yield* Effect.tryPromise({
      try: () =>
        fetch(`${baseUrl}/auth/refresh-token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ refreshToken })
        }),
      catch: (error) => {
        logError('Refresh Token Fetch Failed', error, {
          url: `${baseUrl}/auth/refresh-token`
        })
        return new NetworkError({
          message:
            error instanceof Error
              ? error.message
              : 'Failed to connect to token refresh endpoint',
          status: 0
        })
      }
    })

    if (isDev) {
      console.log('[Auth - Refresh Token Response]', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
      })
    }

    if (!response.ok) {
      logError('Refresh Token Failed', null, {
        status: response.status,
        statusText: response.statusText
      })
      return yield* Effect.fail(
        new AuthError({
          message: `Token refresh failed: ${response.statusText}`
        })
      )
    }

    const data = yield* Effect.tryPromise({
      try: () => response.json(),
      catch: (error) => {
        logError('Refresh Token Response Parse Failed', error, {
          status: response.status
        })
        return new AuthError({
          message: 'Failed to parse token refresh response',
          cause: error
        })
      }
    })

    if (isDev) {
      const tempData = z
        .object({
          accessToken: z.unknown().optional()
        })
        .safeParse(data)

      console.log('[Auth - Refresh Token Data]', {
        hasAccessToken: tempData.success && !!tempData.data.accessToken
      })
    }

    const parseResult = refreshTokenResponseSchema.safeParse(data)

    if (!parseResult.success) {
      logError('Refresh Token Response Validation Failed', parseResult.error, {
        receivedData: data
      })
      return yield* Effect.fail(
        new AuthError({
          message: 'Invalid token refresh response format',
          cause: parseResult.error
        })
      )
    }

    if (isDev) {
      console.log('[Auth - Refresh Token Success]')
    }

    return parseResult.data
  }).pipe(Effect.runPromise)
}

export async function getProfile(
  baseUrl: string,
  accessToken: string
): Promise<User> {
  if (isDev) {
    console.log('[Auth - Get Profile]', {
      url: `${baseUrl}/auth/profile`,
      tokenLength: accessToken.length
    })
  }

  return Effect.gen(function* () {
    const response = yield* Effect.tryPromise({
      try: () =>
        fetch(`${baseUrl}/auth/profile`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`
          }
        }),
      catch: (error) => {
        logError('Get Profile Fetch Failed', error, {
          url: `${baseUrl}/auth/profile`
        })
        return new NetworkError({
          message:
            error instanceof Error
              ? error.message
              : 'Failed to connect to profile endpoint',
          status: 0
        })
      }
    })

    if (isDev) {
      console.log('[Auth - Get Profile Response]', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
      })
    }

    if (!response.ok) {
      logError('Get Profile Failed', null, {
        status: response.status,
        statusText: response.statusText
      })
      return yield* Effect.fail(
        new AuthError({
          message: `Failed to fetch profile: ${response.statusText}`
        })
      )
    }

    const data = yield* Effect.tryPromise({
      try: () => response.json(),
      catch: (error) => {
        logError('Get Profile Response Parse Failed', error)
        return new AuthError({
          message: 'Failed to parse profile response',
          cause: error
        })
      }
    })

    if (isDev) {
      const isObject = typeof data === 'object' && data !== null
      console.log('[Auth - Get Profile Raw Data]', {
        hasUser: isObject && 'user' in data,
        dataKeys: isObject ? Object.keys(data) : []
      })
    }

    const profileData = z.object({ user: z.unknown() }).safeParse(data)

    if (!profileData.success) {
      logError('Get Profile Response Structure Invalid', profileData.error, {
        receivedData: data
      })
      return yield* Effect.fail(
        new AuthError({
          message: 'Invalid profile response structure',
          cause: profileData.error
        })
      )
    }

    const userParseResult = userSchema.safeParse(profileData.data.user)

    if (!userParseResult.success) {
      logError('Get Profile User Data Invalid', userParseResult.error, {
        receivedUser: profileData.data.user
      })
      return yield* Effect.fail(
        new AuthError({
          message: 'Invalid user data format',
          cause: userParseResult.error
        })
      )
    }

    if (isDev) {
      console.log('[Auth - Get Profile Success]', {
        userId: userParseResult.data.id,
        username: userParseResult.data.username
      })
    }

    return userParseResult.data
  }).pipe(Effect.runPromise)
}
