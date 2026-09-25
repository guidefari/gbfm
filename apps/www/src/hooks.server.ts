import { resolveRequestId } from '@gbfm/core/observability/request-id'
import type { Handle, HandleServerError } from '@sveltejs/kit/hooks'

import { resolvePrincipal } from '@/lib/server/auth/session'
import { log } from '@/services/logger'

export const handle: Handle = async ({ event, resolve }) => {
  const startedAt = performance.now()
  event.locals.requestId = resolveRequestId(event.request.headers.get('x-request-id'))

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

  event.locals.principal = await resolvePrincipal(event)

  const resolved = await resolve(event)
  const response = new Response(resolved.body, resolved)
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
