import { submitLocalRequestLog } from '@gbfm/core/observability/local-loki'
import { resolveRequestId } from '@gbfm/core/observability/request-id'
import { Effect } from 'effect'
import * as Server from 'foldkit/experimental/server'

import { apiRequest, endpointFor } from './server/api'
import { renderResponse } from './server/request-dispatch'
import { routeTemplate } from './telemetry/privacy'

export { apiRequest, endpointFor }

/** One request-owned correlation ID covers SSR, actions, redirects, and API forwarding. Logs exclude raw URLs and payloads. */
export const renderPage = async (request: Request): Promise<Server.EntryResult> => {
  const startedAt = performance.now()
  const requestId = resolveRequestId(request.headers.get('x-request-id'))
  const owned = new Request(request)
  owned.headers.set('x-request-id', requestId)

  const attributes = {
    service: 'www',
    requestId,
    route: routeTemplate(undefined, new URL(request.url).pathname),
    method: request.method,
    release: import.meta.env.PROD ? import.meta.env.FOLDKIT_BUILD_ID : 'local',
  }

  try {
    const result = import.meta.env.DEV
      ? Server.Responded(
          await (
            await import('./telemetry/local-request-tracing')
          ).traceLocalRequest(owned, async (traced) => (await renderResponse(traced)).response),
        )
      : await renderResponse(owned)

    const response = new Response(result.response.body, result.response)
    response.headers.set('x-request-id', requestId)
    await Effect.runPromise(
      Effect.logInfo({
        ...attributes,
        operation: 'request.completed',
        status: response.status,
        durationMs: Math.round(performance.now() - startedAt),
      }),
    )

    if (import.meta.env.DEV && new URL(request.url).pathname !== '/telemetry/browser')
      submitLocalRequestLog({
        service: 'www',
        method: request.method,
        route: attributes.route,
        requestId,
        status: response.status,
        durationMs: Math.round(performance.now() - startedAt),
      })

    return Server.Responded(response)
  } catch (cause) {
    if (request.signal.aborted) throw cause
    await Effect.runPromise(
      Effect.logError({
        ...attributes,
        operation: 'request.failed',
        status: 500,
        durationMs: Math.round(performance.now() - startedAt),
      }),
    )

    if (import.meta.env.DEV && new URL(request.url).pathname !== '/telemetry/browser')
      submitLocalRequestLog({
        service: 'www',
        method: request.method,
        route: attributes.route,
        requestId,
        status: 500,
        durationMs: Math.round(performance.now() - startedAt),
      })

    return Server.Responded(
      new Response(`Something went wrong. Request ID: ${requestId}`, {
        status: 500,
        headers: {
          'content-type': 'text/plain; charset=utf-8',
          'cache-control': 'private, no-store',
          'x-request-id': requestId,
        },
      }),
    )
  }
}
