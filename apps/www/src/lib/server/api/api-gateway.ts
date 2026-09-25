import { VPS_PROXY_TARGET } from '$app/env/private'
import { context, propagation, SpanStatusCode, trace } from '@opentelemetry/api'
import type { RequestEvent } from '@sveltejs/kit'

const localApiOrigin = () => VPS_PROXY_TARGET ?? 'http://127.0.0.1:3003'
const tracer = trace.getTracer('gbfm-www-api')

const traceHeaders = (headers: Headers) => {
  if (import.meta.env.DEV) {
    propagation.inject(context.active(), headers, {
      set: (carrier, key, value) => carrier.set(key, value)
    })
  }
  return headers
}

const profileApiRequest = async (
  event: Pick<RequestEvent, 'locals'> & { route?: RequestEvent['route'] },
  operation: string,
  path: string,
  run: () => Promise<Response>
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
      console.info('www api request completed', {
        requestId: event.locals.requestId,
        route: event.route?.id,
        operation,
        path,
        status: response.status,
        durationMs: Math.round(performance.now() - startedAt)
      })
      return response
    } catch (error) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: 'API request failed' })
      console.error('www api request failed', {
        requestId: event.locals.requestId,
        route: event.route?.id,
        operation,
        path,
        durationMs: Math.round(performance.now() - startedAt)
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
  return new Request(url, {
    method: request.method,
    headers,
    body,
    redirect: request.redirect,
    signal: request.signal
  })
}

const normalizeBindingResponse = async (
  response: Awaited<ReturnType<NonNullable<App.Platform['env']['API']>['fetch']>>
): Promise<Response> => {
  const headers = new Headers()
  response.headers.forEach((value, key) => headers.append(key, value))
  return new Response(await response.arrayBuffer(), {
    status: response.status,
    statusText: response.statusText,
    headers
  })
}

const fetchBinding = async (
  event: Pick<RequestEvent, 'platform'>,
  request: Request
): Promise<Response | null> => {
  const api = event.platform?.env.API
  if (!api) return null

  const headers: Record<string, string> = {}
  request.headers.forEach((value, key) => {
    headers[key] = value
  })
  const body = request.body === null ? undefined : await request.arrayBuffer()
  const response = await api.fetch(request.url, {
    method: request.method,
    headers,
    body,
    redirect: request.redirect
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
      const target = new URL(`${url.pathname}${url.search}`, localApiOrigin())
      return fetch(new Request(target, request))
    }
  )
}

/** Performs a server-side request through the same API boundary as browser traffic. */
export async function apiRequest(
  event: Pick<RequestEvent, 'platform' | 'request' | 'locals'>,
  path: string,
  init: RequestInit = {}
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

      const target = new URL(`${url.pathname}${url.search}`, localApiOrigin())
      return fetch(new Request(target, request))
    }
  )
}
