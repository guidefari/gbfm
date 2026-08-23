import { Data, Effect, Result, Schema } from 'effect'

type AuthLogValue = string | number | boolean | null | undefined

function logAuthEvent(
  level: 'info' | 'warn' | 'error',
  message: string,
  details?: Readonly<Record<string, AuthLogValue>>
) {
  const logData = {
    message,
    context: 'auth',
    ...details
  }

  if (level === 'error') {
    void Effect.logError(`[Auth] ${message}`, logData).pipe(Effect.runPromise)
  } else if (level === 'warn') {
    void Effect.logWarning(`[Auth] ${message}`, logData).pipe(Effect.runPromise)
  } else {
    void Effect.logInfo(`[Auth] ${message}`, logData).pipe(Effect.runPromise)
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

const EmailPattern =
  /^(?!\.)(?!.*\.\.)([A-Za-z0-9_'+\-.]*)[A-Za-z0-9_+-]@([A-Za-z0-9][A-Za-z0-9-]*\.)+[A-Za-z]{2,}$/
const Email = Schema.String.pipe(Schema.check(Schema.isPattern(EmailPattern)))

export const userSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  username: Schema.NullOr(Schema.String),
  email: Email,
  avatarUrl: Schema.NullOr(Schema.String)
})

export type User = typeof userSchema.Type

export const fullUserSchema = userSchema.pipe(
  Schema.fieldsAssign({
    verified: Schema.Boolean,
    createdAt: Schema.String,
    updatedAt: Schema.String
  })
)

export type FullUser = typeof fullUserSchema.Type

export const loginRequestSchema = Schema.Struct({
  email: Email,
  password: Schema.NonEmptyString
})

export type LoginRequest = typeof loginRequestSchema.Type

export const loginResponseSchema = Schema.Struct({
  user: fullUserSchema,
  accessToken: Schema.String,
  refreshToken: Schema.String
})

export type LoginResponse = typeof loginResponseSchema.Type

export const refreshTokenRequestSchema = Schema.Struct({
  refreshToken: Schema.String
})

export type RefreshTokenRequest = typeof refreshTokenRequestSchema.Type

export const refreshTokenResponseSchema = Schema.Struct({
  accessToken: Schema.String
})

export type RefreshTokenResponse = typeof refreshTokenResponseSchema.Type

const serializedDateSchema = Schema.Union([Schema.String, Schema.flip(Schema.DateFromString)])
const errorResponseSchema = Schema.Struct({ message: Schema.String })
const betterAuthLoginResponseSchema = Schema.Struct({
  user: Schema.Struct({
    id: Schema.String,
    name: Schema.String,
    email: Schema.String,
    emailVerified: Schema.Boolean,
    image: Schema.optional(Schema.NullOr(Schema.String)),
    createdAt: serializedDateSchema,
    updatedAt: serializedDateSchema
  }),
  token: Schema.String
})
const profileResponseSchema = Schema.Struct({ user: Schema.Unknown })

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

      const errorMessage = Schema.decodeUnknownResult(errorResponseSchema)(errorData)
      logAuthEvent('warn', 'Login error response', {
        status: response.status,
        message: Result.isSuccess(errorMessage)
          ? errorMessage.success.message
          : 'Unrecognized error response'
      })

      return yield* Effect.fail(
        new AuthError({
          message: Result.isSuccess(errorMessage)
            ? errorMessage.success.message
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

    const validatedData = Schema.decodeUnknownResult(betterAuthLoginResponseSchema)(data)

    if (Result.isFailure(validatedData)) {
      logAuthEvent('error', 'Login response validation failed', {
        validationError: validatedData.failure.message
      })
      return yield* Effect.fail(
        new AuthError({
          message: 'Invalid login response format from Better Auth',
          cause: validatedData.failure
        })
      )
    }

    const { user: baUser, token } = validatedData.success

    const mappedResponse: LoginResponse = {
      user: {
        id: baUser.id,
        name: baUser.name,
        username: baUser.name,
        email: baUser.email,
        avatarUrl: baUser.image || null,
        verified: baUser.emailVerified,
        createdAt: baUser.createdAt,
        updatedAt: baUser.updatedAt
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

    const parseResult = Schema.decodeUnknownResult(refreshTokenResponseSchema)(data)

    if (Result.isFailure(parseResult)) {
      logAuthEvent('error', 'Refresh token response validation failed', {
        validationError: parseResult.failure.message
      })
      return yield* Effect.fail(
        new AuthError({
          message: 'Invalid token refresh response format',
          cause: parseResult.failure
        })
      )
    }

    logAuthEvent('info', 'Token refresh successful')

    return parseResult.success
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

    const profileData = Schema.decodeUnknownResult(profileResponseSchema)(data)

    if (Result.isFailure(profileData)) {
      logAuthEvent('error', 'Get profile response structure invalid', {
        validationError: profileData.failure.message
      })
      return yield* Effect.fail(
        new AuthError({
          message: 'Invalid profile response structure',
          cause: profileData.failure
        })
      )
    }

    const userParseResult = Schema.decodeUnknownResult(userSchema)(profileData.success.user)

    if (Result.isFailure(userParseResult)) {
      logAuthEvent('error', 'Get profile user data invalid', {
        validationError: userParseResult.failure.message
      })
      return yield* Effect.fail(
        new AuthError({
          message: 'Invalid user data format',
          cause: userParseResult.failure
        })
      )
    }

    logAuthEvent('info', 'Profile fetch successful', {
      userId: userParseResult.success.id,
      username: userParseResult.success.username
    })

    return userParseResult.success
  }).pipe(Effect.runPromise)
}
