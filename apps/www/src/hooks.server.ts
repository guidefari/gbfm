import { VPS_PROXY_TARGET } from '$app/env/private'
import { resolveRequestId } from '@gbfm/core/observability/request-id'
import type { Handle, HandleServerError } from '@sveltejs/kit/hooks'

import { anonymousPrincipal } from '@/lib/auth/principal'
import { resolvePrincipal } from '@/lib/server/auth/session'
import { log } from '@/services/logger'

const gatewayPrefixes = ['/api/', '/auth/', '/telemetry/'] as const

const isGatewayRequest = (pathname: string) =>
  pathname === '/rss.xml' || gatewayPrefixes.some((prefix) => pathname.startsWith(prefix))

export const handle: Handle = async ({ event, resolve }) => {
  const startedAt = performance.now()
  event.locals.requestId = resolveRequestId(event.request.headers.get('x-request-id'))
  event.locals.apiOrigin = VPS_PROXY_TARGET ?? 'http://127.0.0.1:3003'

  if (event.tracing.enabled) {
    event.tracing.root.setAttribute('gbfm.request_id', event.locals.requestId)
    event.tracing.root.setAttribute('gbfm.release', event.platform?.env.APP_RELEASE ?? 'local')
    event.tracing.root.setAttribute('service.name', 'www')
    event.tracing.root.setAttribute('http.request.method', event.request.method)
    event.tracing.root.setAttribute('http.route', event.route.id ?? '/unmatched')

    if (import.meta.env.DEV) {
      event.tracing.root.updateName(`www ${event.request.method} ${event.route.id ?? 'unknown'}`)
    }
  }

  const session = isGatewayRequest(event.url.pathname)
    ? { principal: anonymousPrincipal, setCookies: [] }
    : await resolvePrincipal(event)

  event.locals.principal = session.principal

  const resolved = await resolve(event)
  const response = new Response(resolved.body, resolved)

  for (const cookie of session.setCookies) response.headers.append('set-cookie', cookie)
  response.headers.set('x-request-id', event.locals.requestId)
  response.headers.append(
    'server-timing',
    `sveltekit;dur=${(performance.now() - startedAt).toFixed(1)}`,
  )

  log('info', 'www request completed', {
    requestId: event.locals.requestId,
    route: event.route.id ?? '/unmatched',
    method: event.request.method,
    status: response.status,
    durationMs: Math.round(performance.now() - startedAt),
    release: event.platform?.env.APP_RELEASE ?? 'local',
    service: 'www',
  })

  return response
}

export const handleError: HandleServerError = ({ error, event, kind }) => {
  log('error', 'sveltekit request failed', {
    operation: 'render-request',
    errorType: error instanceof Error ? error.name : 'UnknownError',
    requestId: event.locals.requestId,
    routeId: event.route.id,
    status: kind === 'unknown' ? 500 : error.status,
  })

  return { message: 'Something went wrong', requestId: event.locals.requestId }
}
