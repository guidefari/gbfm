import type { FullUser, LoginRequest } from '@gbfm/core/api'
import { Data, Effect, Schema } from 'effect'
import { FetchHttpClient, HttpClient, HttpClientRequest } from 'effect/unstable/http'
import { env } from '@/env'

export class LoginFailed extends Data.TaggedError('LoginFailed')<{
  readonly message: string
}> {}

export class SessionUnavailable extends Data.TaggedError('SessionUnavailable')<{
  readonly message: string
}> {}

export class SessionExpired extends Data.TaggedError('SessionExpired')<{}> {}

const BetterAuthUser = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  username: Schema.optional(Schema.NullOr(Schema.String)),
  email: Schema.String,
  emailVerified: Schema.Boolean,
  image: Schema.optional(Schema.NullOr(Schema.String)),
  createdAt: Schema.String,
  updatedAt: Schema.String
})

const BetterAuthLoginResponse = Schema.Struct({
  user: BetterAuthUser,
  token: Schema.String
})

const BetterAuthSessionResponse = Schema.Struct({ user: BetterAuthUser })

const toFullUser = (user: typeof BetterAuthUser.Type): FullUser => ({
  id: user.id,
  name: user.name,
  username: user.username ?? user.name,
  email: user.email,
  avatarUrl: user.image ?? null,
  verified: user.emailVerified,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt
})

export const login = (credentials: LoginRequest) =>
  Effect.gen(function* () {
    const client = yield* HttpClient.HttpClient
    const request = yield* HttpClientRequest.bodyJson(
      HttpClientRequest.post(`${env.EXPO_PUBLIC_API_URL}/auth/sign-in/email`),
      credentials
    )
    const response = yield* client.execute(request)

    if (response.status < 200 || response.status >= 300) {
      return yield* new LoginFailed({ message: `Login failed with status ${response.status}` })
    }

    const data = yield* response.json.pipe(
      Effect.flatMap(Schema.decodeUnknownEffect(BetterAuthLoginResponse))
    )
    return { user: toFullUser(data.user), sessionToken: data.token }
  }).pipe(Effect.provide(FetchHttpClient.layer))

export const getSession = (sessionToken: string) =>
  Effect.gen(function* () {
    const client = yield* HttpClient.HttpClient
    const request = HttpClientRequest.get(`${env.EXPO_PUBLIC_API_URL}/auth/get-session`).pipe(
      HttpClientRequest.setHeader('Authorization', `Bearer ${sessionToken}`)
    )
    const response = yield* client
      .execute(request)
      .pipe(
        Effect.mapError(() => new SessionUnavailable({ message: 'Unable to refresh session.' }))
      )

    if (response.status === 401) return yield* new SessionExpired()
    if (response.status < 200 || response.status >= 300) {
      return yield* new SessionUnavailable({ message: `Session check failed: ${response.status}` })
    }

    const data = yield* response.json.pipe(
      Effect.flatMap(Schema.decodeUnknownEffect(BetterAuthSessionResponse)),
      Effect.mapError(() => new SessionExpired())
    )
    return toFullUser(data.user)
  }).pipe(Effect.provide(FetchHttpClient.layer))
