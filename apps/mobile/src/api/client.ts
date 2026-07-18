import { Api } from '@gbfm/api/api'
import { Effect } from 'effect'
import { FetchHttpClient } from 'effect/unstable/http'
import { HttpApiClient } from 'effect/unstable/httpapi'
import { env } from '@/env'

const buildClient = () =>
  HttpApiClient.make(Api, { baseUrl: env.EXPO_PUBLIC_API_URL }).pipe(
    Effect.provide(FetchHttpClient.layer)
  )

export type ApiClient = Effect.Success<ReturnType<typeof buildClient>>

let client: ApiClient | undefined

export const getApiClient = Effect.gen(function* () {
  if (client) return client
  client = yield* buildClient()
  return client
})
