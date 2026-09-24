import { Schema } from 'effect'
import { HttpApiEndpoint, HttpApiGroup } from 'effect/unstable/httpapi'

const RouteName = Schema.String.check(Schema.isLengthBetween(1, 128))
const NavigationLabel = Schema.String.check(Schema.isLengthBetween(1, 32))
const Milliseconds = Schema.Finite.check(Schema.isBetween({ minimum: 0, maximum: 60_000 }))

export const NavigationTimingInput = Schema.Struct({
  fromRoute: RouteName,
  toRoute: RouteName,
  navigationType: NavigationLabel,
  direction: NavigationLabel,
  status: Schema.Literals(['ok', 'cancelled', 'timeout']),
  preparationMs: Schema.optional(Milliseconds),
  swapMs: Schema.optional(Milliseconds),
  pageLoadMs: Schema.optional(Milliseconds),
  totalMs: Milliseconds
})
export type NavigationTimingInput = typeof NavigationTimingInput.Type

export const TelemetryGroup = HttpApiGroup.make('telemetry').add(
  HttpApiEndpoint.post('recordNavigationTiming', '/api/telemetry/navigation', {
    payload: NavigationTimingInput,
    success: Schema.Boolean
  })
)
