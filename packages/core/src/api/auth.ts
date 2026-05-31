import { Data, Effect } from 'effect'
import { z } from 'zod'

function logAuthEvent(
  level: 'info' | 'warn' | 'error',
  message: string,
  details?: Record<string, unknown>
) {
  const logData = {
    message,
    context: 'auth',
    ...details
  }

  if (level === 'error') {
    Effect.logError(`[Auth] ${message}`, logData).pipe(Effect.runPromise)
  } else if (level === 'warn') {
    Effect.logWarning(`[Auth] ${message}`, logData).pipe(Effect.runPromise)
  } else {
    Effect.logInfo(`[Auth] ${message}`, logData).pipe(Effect.runPromise)
  }
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

export async function login(baseUrl: string, credentials: LoginRequest): Promise<LoginResponse> {
  logAuthEvent('info', 'Login attempt', {
    url: `${baseUrl}/auth/signin`,
    email: credentials.email
  })

  return Effect.gen(function* () {
    const response = yield* Effect.tryPromise({
      try: () =>
        fetch(`${baseUrl}/auth/sign-in-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(credentials)
        }),
      catch: (error) => {
        logAuthEvent('error', 'Login fetch failed', {
          url: `${baseUrl}/auth/signin`,
          email: credentials.email,
          error: error instanceof Error ? error.message : String(error)
        })
        return new NetworkError({
          message:
            error instanceof Error ? error.message : 'Failed to connect to authentication server',
          status: 0
        })
      }
    })

    logAuthEvent('info', 'Login response received', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok
    })

    if (!response.ok) {
      const errorData = yield* Effect.tryPromise({
        try: () => response.json(),
        catch: () => {
          logAuthEvent('error', 'Login error response parse failed', {
            status: response.status,
            statusText: response.statusText
          })
          return new AuthError({
            message: `Login failed: ${response.statusText}`
          })
        }
      })

      logAuthEvent('warn', 'Login error response', { errorData })

      const errorMessage = z.object({ message: z.string() }).safeParse(errorData)

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
        logAuthEvent('error', 'Login response parse failed', {
          status: response.status,
          error: error instanceof Error ? error.message : String(error)
        })
        return new AuthError({
          message: 'Failed to parse login response',
          cause: error
        })
      }
    })

    logAuthEvent('info', 'Login data parsed successfully')

    // Map Better Auth response to legacy format
    const validatedData = z
      .object({
        user: z.object({
          id: z.string(),
          name: z.string(),
          email: z.string(),
          emailVerified: z.boolean(),
          image: z.string().nullable().optional(),
          createdAt: z.string().or(z.date()),
          updatedAt: z.string().or(z.date())
        }),
        token: z.string()
      })
      .safeParse(data)

    if (!validatedData.success) {
      logAuthEvent('error', 'Login response validation failed', {
        receivedData: data,
        validationError: validatedData.error.message
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
        createdAt:
          typeof baUser.createdAt === 'string' ? baUser.createdAt : baUser.createdAt.toISOString(),
        updatedAt:
          typeof baUser.updatedAt === 'string' ? baUser.updatedAt : baUser.updatedAt.toISOString()
      },
      accessToken: token,
      refreshToken: token
    }

    logAuthEvent('info', 'Login successful', {
      userId: mappedResponse.user.id,
      email: mappedResponse.user.email
    })

    return mappedResponse
  }).pipe(Effect.runPromise)
}

export async function refreshAccessToken(
  baseUrl: string,
  refreshToken: string
): Promise<RefreshTokenResponse> {
  logAuthEvent('info', 'Token refresh attempt', {
    url: `${baseUrl}/auth/refresh-token`,
    tokenLength: refreshToken.length
  })

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
        logAuthEvent('error', 'Refresh token fetch failed', {
          url: `${baseUrl}/auth/refresh-token`,
          error: error instanceof Error ? error.message : String(error)
        })
        return new NetworkError({
          message:
            error instanceof Error ? error.message : 'Failed to connect to token refresh endpoint',
          status: 0
        })
      }
    })

    logAuthEvent('info', 'Token refresh response received', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok
    })

    if (!response.ok) {
      logAuthEvent('warn', 'Refresh token failed', {
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
        logAuthEvent('error', 'Refresh token response parse failed', {
          status: response.status,
          error: error instanceof Error ? error.message : String(error)
        })
        return new AuthError({
          message: 'Failed to parse token refresh response',
          cause: error
        })
      }
    })

    logAuthEvent('info', 'Token refresh data parsed successfully')

    const parseResult = refreshTokenResponseSchema.safeParse(data)

    if (!parseResult.success) {
      logAuthEvent('error', 'Refresh token response validation failed', {
        receivedData: data,
        validationError: parseResult.error.message
      })
      return yield* Effect.fail(
        new AuthError({
          message: 'Invalid token refresh response format',
          cause: parseResult.error
        })
      )
    }

    logAuthEvent('info', 'Token refresh successful')

    return parseResult.data
  }).pipe(Effect.runPromise)
}

export async function getProfile(baseUrl: string, accessToken: string): Promise<User> {
  logAuthEvent('info', 'Profile fetch attempt', {
    url: `${baseUrl}/auth/profile`,
    tokenLength: accessToken.length
  })

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
        logAuthEvent('error', 'Get profile fetch failed', {
          url: `${baseUrl}/auth/profile`,
          error: error instanceof Error ? error.message : String(error)
        })
        return new NetworkError({
          message: error instanceof Error ? error.message : 'Failed to connect to profile endpoint',
          status: 0
        })
      }
    })

    logAuthEvent('info', 'Profile fetch response received', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok
    })

    if (!response.ok) {
      logAuthEvent('warn', 'Get profile failed', {
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
        logAuthEvent('error', 'Get profile response parse failed', {
          error: error instanceof Error ? error.message : String(error)
        })
        return new AuthError({
          message: 'Failed to parse profile response',
          cause: error
        })
      }
    })

    logAuthEvent('info', 'Profile data parsed successfully')

    const profileData = z.object({ user: z.unknown() }).safeParse(data)

    if (!profileData.success) {
      logAuthEvent('error', 'Get profile response structure invalid', {
        receivedData: data,
        validationError: profileData.error.message
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
      logAuthEvent('error', 'Get profile user data invalid', {
        receivedUser: profileData.data.user,
        validationError: userParseResult.error.message
      })
      return yield* Effect.fail(
        new AuthError({
          message: 'Invalid user data format',
          cause: userParseResult.error
        })
      )
    }

    logAuthEvent('info', 'Profile fetch successful', {
      userId: userParseResult.data.id,
      username: userParseResult.data.username
    })

    return userParseResult.data
  }).pipe(Effect.runPromise)
}
