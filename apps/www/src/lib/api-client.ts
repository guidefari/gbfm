import { Api } from '@gbfm/api/api'
import { Effect, Layer } from 'effect'
import { FetchHttpClient } from 'effect/unstable/http'
import { HttpApiClient } from 'effect/unstable/httpapi'

const VPS_BASE_URL = import.meta.env.VITE_VPS_BASE_URL || window.location.origin

const FetchLive = FetchHttpClient.layer.pipe(
  Layer.provide(Layer.succeed(FetchHttpClient.RequestInit, { credentials: 'include' }))
)

const buildClient = () => HttpApiClient.make(Api, { baseUrl: VPS_BASE_URL })

export type ApiClient = Effect.Success<ReturnType<typeof buildClient>>

let _client: ApiClient | null = null

export const getApiClient = async (): Promise<ApiClient> => {
  if (!_client) {
    // oxlint-disable-next-line effecttsgo/strict-effect-provide -- HTTP client construction is an execution boundary.
    _client = await Effect.runPromise(Effect.provide(buildClient(), FetchLive))
  }
  return _client
}
