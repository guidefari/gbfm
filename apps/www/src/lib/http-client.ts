import type * as Effect from 'effect/Effect'
import { log as defaultLog } from '@/services/logger'

export type HttpRequestInput = RequestInfo | URL

export type HttpFailureContext = Readonly<Record<string, string | number | boolean | undefined>>

export type ApiFailureInput = {
  error: unknown
  input: HttpRequestInput
  init: RequestInit
  context?: HttpFailureContext
}

type FetcherOptions = {
  request?: (input: HttpRequestInput, init?: RequestInit) => Promise<Response>
  onUnauthorized?: () => void
  reportFailure?: (failure: ApiFailureInput) => Effect.Effect<void>
  runEffect?: (effect: Effect.Effect<void>) => Promise<void>
  logError?: (cause: unknown, context?: HttpFailureContext) => void
}

export function getRequestUrl(input: HttpRequestInput) {
  if (input instanceof URL) return input.toString()
  if (input instanceof Request) return input.url
  return input
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
  logError = (error, context) => defaultLog('error', 'HTTP request failed', { error, ...context })
}: FetcherOptions = {}) {
  const runFailureReport = (
    cause: unknown,
    input: HttpRequestInput,
    init: RequestInit,
    context: HttpFailureContext = {}
  ) => {
    if (!reportFailure || !runEffect) return

    void runEffect(reportFailure({ error: cause, input, init, context })).catch((reportError) =>
      logError(reportError, { failureType: 'report_failure' })
    )
  }

  return async function fetcher<T>(input: HttpRequestInput, init: RequestInit = {}): Promise<T> {
    try {
      const isFormData = init.body instanceof FormData
      const headers = new Headers(init.headers)
      if (!isFormData && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json')
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

      logError(error, { url: getRequestUrl(input), method: getRequestMethod(input, init) })
      throw error
    }
  }
}
