import { Api } from '@gbfm/api/api'
import { Data, Effect, ManagedRuntime } from 'effect'
import { FetchHttpClient, HttpClient } from 'effect/unstable/http'
import { HttpApiClient } from 'effect/unstable/httpapi'
import { env } from '@/env'

class HttpClientUnavailable extends Data.TaggedError('HttpClientUnavailable')<{
  readonly cause: unknown
}> {}

const httpRuntime = ManagedRuntime.make(FetchHttpClient.layer)

const getHttpClient = Effect.tryPromise({
  try: () => httpRuntime.runPromise(HttpClient.HttpClient),
  catch: (cause) => new HttpClientUnavailable({ cause })
})

const buildClient = (httpClient: HttpClient.HttpClient) =>
  HttpApiClient.make(Api, { baseUrl: env.EXPO_PUBLIC_API_URL }).pipe(
    Effect.provideService(HttpClient.HttpClient, httpClient)
  )

export type ApiClient = Effect.Success<ReturnType<typeof buildClient>>

let client: ApiClient | undefined

export const getApiClient = Effect.gen(function* () {
  if (client) return client
  client = yield* Effect.flatMap(getHttpClient, buildClient)
  return client
})

export { getHttpClient }
