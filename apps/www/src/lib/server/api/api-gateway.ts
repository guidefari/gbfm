import { context, propagation, SpanStatusCode, trace } from '@opentelemetry/api'
import type { RequestEvent } from '@sveltejs/kit'

import { log } from '@/services/logger'

const tracer = trace.getTracer('gbfm-www-api')

type ApiFetcher = {
  fetch(
    input: string,
    init?: {
      readonly method?: string
      readonly headers?: Readonly<Record<string, string>>
      readonly redirect?: RequestRedirect
      readonly body?: ArrayBuffer
    },
  ): Promise<{
    readonly headers: { forEach(callback: (value: string, key: string) => void): void }
    readonly status: number
    readonly statusText: string
    arrayBuffer(): Promise<ArrayBuffer>
  }>
}

type ApiRequestEvent = {
  readonly platform: { readonly env: { readonly API: ApiFetcher } } | undefined
  readonly request: Request
  readonly locals: { readonly apiOrigin: string; readonly requestId: string }
  readonly route?: RequestEvent['route'] | undefined
}

const traceHeaders = (headers: Headers) => {
  if (import.meta.env.DEV) {
    propagation.inject(context.active(), headers, {
      set: (carrier, key, value) => carrier.set(key, value),
    })
  }

  return headers
}

const profileApiRequest = async (
  event: Pick<ApiRequestEvent, 'locals' | 'route'>,
  operation: string,
  path: string,
  run: () => Promise<Response>,
): Promise<Response> => {
  if (!import.meta.env.DEV) return run()

  return tracer.startActiveSpan(operation, async (span) => {
    const startedAt = performance.now()
    span.setAttribute('gbfm.request_id', event.locals.requestId)
    span.setAttribute('gbfm.www.route', event.route?.id ?? 'unknown')
    span.setAttribute('url.path', path)

    try {
      const response = await run()
      span.setAttribute('http.response.status_code', response.status)
      log('info', 'www api request completed', {
        requestId: event.locals.requestId,
        route: event.route?.id,
        operation,
        path,
        status: response.status,
        durationMs: Math.round(performance.now() - startedAt),
      })

      return response
    } catch (error) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: 'API request failed' })
      log('error', 'www api request failed', {
        requestId: event.locals.requestId,
        route: event.route?.id,
        operation,
        path,
        durationMs: Math.round(performance.now() - startedAt),
      })
      throw error
    } finally {
      span.end()
    }
  })
}

const bindingRequest = async (request: Request, requestId: string) => {
  const url = new URL(request.url)
  url.protocol = 'https:'
  url.host = 'api.internal'
  const headers = new Headers(request.headers)
  headers.set('x-request-id', requestId)
  traceHeaders(headers)
  const body = request.body === null ? undefined : await request.arrayBuffer()

  const init: RequestInit = {
    method: request.method,
    headers,
    redirect: request.redirect,
    signal: request.signal,
  }

  if (body !== undefined) init.body = body

  return new Request(url, init)
}

const normalizeBindingResponse = async (
  response: Awaited<ReturnType<ApiFetcher['fetch']>>,
): Promise<Response> => {
  const headers = new Headers()
  response.headers.forEach((value, key) => headers.append(key, value))
  const body = [204, 205, 304].includes(response.status) ? null : await response.arrayBuffer()

  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

const fetchBinding = async (
  event: Pick<ApiRequestEvent, 'platform'>,
  request: Request,
): Promise<Response | null> => {
  const api = event.platform?.env.API

  if (!api) return null

  const headers: Record<string, string> = {}
  request.headers.forEach((value, key) => {
    headers[key] = value
  })
  const body = request.body === null ? undefined : await request.arrayBuffer()

  const response =
    body === undefined
      ? await api.fetch(request.url, {
          method: request.method,
          headers,
          redirect: request.redirect,
        })
      : await api.fetch(request.url, {
          method: request.method,
          headers,
          redirect: request.redirect,
          body,
        })

  return normalizeBindingResponse(response)
}

/** Forwards a SvelteKit request to the API Worker binding or local API server. */
export async function forwardApiRequest(event: RequestEvent): Promise<Response> {
  return profileApiRequest(
    event,
    'www.api.forward',
    new URL(event.request.url).pathname,
    async () => {
      const request = await bindingRequest(event.request, event.locals.requestId)
      const bindingResponse = await fetchBinding(event, request)

      if (bindingResponse) return bindingResponse

      const url = new URL(event.request.url)
      const target = new URL(`${url.pathname}${url.search}`, event.locals.apiOrigin)

      return fetch(new Request(target, request))
    },
  )
}

/** Performs a server-side request through the same API boundary as browser traffic. */
export async function apiRequest(
  event: ApiRequestEvent,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  return profileApiRequest(
    event,
    'www.api.request',
    new URL(path, event.request.url).pathname,
    async () => {
      const url = new URL(path, event.request.url)
      const headers = new Headers(init.headers)
      const cookie = event.request.headers.get('cookie')

      if (cookie) headers.set('cookie', cookie)
      headers.set('x-request-id', event.locals.requestId)
      traceHeaders(headers)

      const request = new Request(url, { ...init, headers })

      if (event.platform?.env.API) {
        const internal = new URL(request.url)
        internal.protocol = 'https:'
        internal.host = 'api.internal'
        const bindingResponse = await fetchBinding(event, new Request(internal, request))

        if (bindingResponse) return bindingResponse
      }

      const target = new URL(`${url.pathname}${url.search}`, event.locals.apiOrigin)

      return fetch(new Request(target, request))
    },
  )
}
