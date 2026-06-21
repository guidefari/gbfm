import type * as Effect from 'effect/Effect'

export type HttpRequestInput = RequestInfo | URL

export type ApiFailureInput = {
  error: unknown
  input: HttpRequestInput
  init: RequestInit
  context?: Record<string, unknown>
}

type FetcherOptions = {
  request?: (input: HttpRequestInput, init?: RequestInit) => Promise<Response>
  onUnauthorized?: () => void
  reportFailure?: (failure: ApiFailureInput) => Effect.Effect<void>
  runEffect?: (effect: Effect.Effect<void>) => Promise<void>
  logError?: (error: unknown) => void
}

export function getRequestUrl(input: HttpRequestInput) {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.toString()
  return input.url
}

export function getRequestMethod(input: HttpRequestInput, init: RequestInit) {
  if (init.method) return init.method
  if (input instanceof Request) return input.method
  return 'GET'
}

export function createFetcher({
  request = (input, init) => fetch(input, init),
  onUnauthorized = () => {
    window.location.href = '/auth/sign-in'
  },
  reportFailure,
  runEffect,
  logError = console.error
}: FetcherOptions = {}) {
  const runFailureReport = (
    error: unknown,
    input: HttpRequestInput,
    init: RequestInit,
    context: Record<string, unknown> = {}
  ) => {
    if (!reportFailure || !runEffect) return

    void runEffect(reportFailure({ error, input, init, context })).catch(logError)
  }

  return async function fetcher<T>(input: HttpRequestInput, init: RequestInit = {}): Promise<T> {
    try {
      const isFormData = init.body instanceof FormData
      const headers = {
        ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
        ...init.headers
      }

      const res = await request(input, {
        ...init,
        headers,
        credentials: 'include'
      })

      if (res.status === 401) {
        onUnauthorized()
        throw new Error('Unauthorized')
      }

      if (!res.ok) {
        const errorText = await res.text()
        const error = new Error(`HTTP ${res.status}: ${errorText || res.statusText}`)

        if (res.status >= 500) {
          runFailureReport(error, input, init, {
            status: res.status,
            statusText: res.statusText,
            failureType: 'server_response'
          })
        }

        throw error
      }

      const text = await res.text()
      const parsed: T = text ? JSON.parse(text) : undefined
      return parsed
    } catch (error) {
      if (error instanceof TypeError) {
        runFailureReport(error, input, init, { failureType: 'network' })
      }

      logError(error)
      throw error
    }
  }
}
