import { Schema } from 'effect'
import { HttpApiEndpoint, HttpApiGroup } from 'effect/unstable/httpapi'
import { ReadinessCheckFailedError } from './errors'

export const HealthLiveResponse = Schema.Struct({
  ok: Schema.Literal(true)
})
export type HealthLiveResponse = typeof HealthLiveResponse.Type

export const HealthReadyResponse = Schema.Struct({
  dbConnected: Schema.Literal(true)
})
export type HealthReadyResponse = typeof HealthReadyResponse.Type

export const HealthGroup = HttpApiGroup.make('health').add(
  HttpApiEndpoint.get('live', '/health/live', {
    success: HealthLiveResponse
  }),
  HttpApiEndpoint.get('ready', '/health/ready', {
    success: HealthReadyResponse,
    error: ReadinessCheckFailedError
  }),
  HttpApiEndpoint.get('check', '/health', {
    success: HealthReadyResponse,
    error: ReadinessCheckFailedError
  })
)
