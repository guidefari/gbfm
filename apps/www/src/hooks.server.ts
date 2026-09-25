import type { Handle, HandleServerError } from '@sveltejs/kit/hooks'
import { resolvePrincipal } from '@/lib/server/auth/session'

export const handle: Handle = async ({ event, resolve }) => {
  const incomingRequestId = event.request.headers.get('x-request-id')
  event.locals.requestId = incomingRequestId ?? crypto.randomUUID()
  event.locals.principal = await resolvePrincipal(event)

  const startedAt = performance.now()
  const resolved = await resolve(event)
  const response = new Response(resolved.body, resolved)
  response.headers.set('x-request-id', event.locals.requestId)
  response.headers.append(
    'server-timing',
    `sveltekit;dur=${(performance.now() - startedAt).toFixed(1)}`
  )
  return response
}

export const handleError: HandleServerError = ({ error, event, kind }) => {
  console.error('sveltekit request failed', {
    operation: 'render-request',
    errorType: error instanceof Error ? error.name : 'UnknownError',
    errorMessage: error instanceof Error ? error.message : 'Unknown error',
    requestId: event.locals.requestId,
    routeId: event.route.id,
    status: kind === 'unknown' ? 500 : error.status
  })
  return { message: 'Something went wrong', requestId: event.locals.requestId }
}
