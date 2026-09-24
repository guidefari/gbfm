import { Api } from '@gbfm/api/api'
import { Effect } from 'effect'
import { HttpApiBuilder } from 'effect/unstable/httpapi'

export const TelemetryHandlersLive = HttpApiBuilder.group(Api, 'telemetry', (handlers) =>
  handlers.handle('recordNavigationTiming', ({ payload }) => {
    const attributes = {
      'navigation.from': payload.fromRoute,
      'navigation.to': payload.toRoute,
      'navigation.type': payload.navigationType,
      'navigation.direction': payload.direction,
      'navigation.status': payload.status,
      'navigation.total_ms': payload.totalMs
    }
    if (payload.preparationMs !== undefined) {
      Object.assign(attributes, { 'navigation.preparation_ms': payload.preparationMs })
    }
    if (payload.swapMs !== undefined) {
      Object.assign(attributes, { 'navigation.swap_ms': payload.swapMs })
    }
    if (payload.pageLoadMs !== undefined) {
      Object.assign(attributes, { 'navigation.page_load_ms': payload.pageLoadMs })
    }

    return Effect.succeed(true).pipe(
      Effect.withSpan('client.navigation', {
        attributes
      })
    )
  })
)
