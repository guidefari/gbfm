import { Data, Effect, Schema } from 'effect'
import { FetchHttpClient, HttpClient, HttpClientRequest } from 'effect/unstable/http'
import type { FullUser, LoginRequest, LoginResponse } from '@gbfm/core/api'
import { env } from '@/env'

export class LoginFailed extends Data.TaggedError('LoginFailed')<{
  readonly message: string
}> {}

const BetterAuthLoginResponse = Schema.Struct({
  user: Schema.Struct({
    id: Schema.String,
    name: Schema.String,
    email: Schema.String,
    emailVerified: Schema.Boolean,
    image: Schema.optional(Schema.NullOr(Schema.String)),
    createdAt: Schema.String,
    updatedAt: Schema.String
  }),
  token: Schema.String
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
    const user: FullUser = {
      id: data.user.id,
      name: data.user.name,
      username: data.user.name,
      email: data.user.email,
      avatarUrl: data.user.image ?? null,
      verified: data.user.emailVerified,
      createdAt: data.user.createdAt,
      updatedAt: data.user.updatedAt
    }

    return {
      user,
      accessToken: data.token,
      refreshToken: data.token
    } satisfies LoginResponse
  }).pipe(Effect.provide(FetchHttpClient.layer))
