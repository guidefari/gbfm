import { Data, Effect, Layer, type Schema } from 'effect'
import {
  FetchHttpClient,
  HttpClient,
  HttpClientRequest,
  HttpClientResponse,
  type HttpMethod,
} from 'effect/unstable/http'

type DashboardRequestInput = string | URL

type DashboardRequestInit = {
  readonly method?: HttpMethod.HttpMethod
  readonly headers?: HeadersInit
  readonly body?: string | FormData
}

export class DashboardRequestError extends Data.TaggedError('DashboardRequestError')<{
  readonly status?: number
  readonly cause?: unknown
}> {
  override get message() {
    return this.status === undefined ? 'Request failed' : `Request failed (${this.status})`
  }
}

const fetchLayer = () =>
  FetchHttpClient.layer.pipe(
    Layer.provide(Layer.succeed(FetchHttpClient.Fetch, globalThis.fetch)),
    Layer.provide(Layer.succeed(FetchHttpClient.RequestInit, { credentials: 'include' })),
  )

const requestUrl = (input: DashboardRequestInput) =>
  input instanceof URL ? input : new URL(input, globalThis.location?.origin)

const makeRequest = (input: DashboardRequestInput, init: DashboardRequestInit = {}) =>
  Effect.try({
    try: () => {
      const request = HttpClientRequest.make(init.method ?? 'GET')(requestUrl(input), {
        headers: init.headers,
      })

      if (init.body === undefined) return request

      if (init.body instanceof FormData) return HttpClientRequest.bodyFormData(request, init.body)

      return HttpClientRequest.bodyText(
        request,
        init.body,
        new Headers(init.headers).get('content-type') ?? undefined,
      )
    },
    catch: (cause) => new DashboardRequestError({ cause }),
  })

const dashboardRequest = Effect.fn('Dashboard.request')(function* (
  input: DashboardRequestInput,
  init?: DashboardRequestInit,
) {
  const request = yield* makeRequest(input, init)
  const client = yield* HttpClient.HttpClient

  const response = yield* client
    .execute(request)
    .pipe(
      Effect.mapError((cause) =>
        cause.response === undefined
          ? new DashboardRequestError({ cause })
          : new DashboardRequestError({ status: cause.response.status, cause }),
      ),
    )

  if (response.status < 200 || response.status >= 300) {
    return yield* new DashboardRequestError({ status: response.status })
  }

  return response
})

const runRequest = <A, E>(effect: Effect.Effect<A, E, HttpClient.HttpClient>) => {
  // oxlint-disable-next-line effecttsgo/strict-effect-provide -- This Promise facade is the browser execution boundary.
  return Effect.runPromise(effect.pipe(Effect.provide(fetchLayer())))
}

export async function dashboardJson<S extends Schema.ConstraintDecoder<unknown>>(
  schema: S,
  input: DashboardRequestInput,
  init?: DashboardRequestInit,
): Promise<S['Type']> {
  return runRequest(
    dashboardRequest(input, init).pipe(Effect.flatMap(HttpClientResponse.schemaBodyJson(schema))),
  )
}

export const dashboardCommand = (input: DashboardRequestInput, init: DashboardRequestInit) =>
  runRequest(dashboardRequest(input, init).pipe(Effect.asVoid))

export const jsonRequest = (
  method: HttpMethod.HttpMethod,
  body: Schema.Json,
): DashboardRequestInit => ({
  method,
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
})
