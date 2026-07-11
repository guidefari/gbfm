import { Schema } from 'effect'
import { HttpApiEndpoint, HttpApiError, HttpApiGroup } from 'effect/unstable/httpapi'

const EmailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const Email = Schema.String.pipe(Schema.check(Schema.isPattern(EmailPattern)))

const UuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const Uuid = Schema.String.pipe(Schema.check(Schema.isPattern(UuidPattern)))

export const SubscribeInput = Schema.Struct({
  email: Email,
  name: Schema.optional(Schema.String),
  source: Schema.optional(Schema.String)
})
export type SubscribeInput = typeof SubscribeInput.Type

export const SubscribeResponse = Schema.Struct({
  subscribed: Schema.Boolean,
  email: Schema.String
})

export const UnsubscribeInput = Schema.Struct({
  token: Uuid
})
export type UnsubscribeInput = typeof UnsubscribeInput.Type

export const UnsubscribeResponse = Schema.Struct({
  success: Schema.Boolean
})

export const RequestUnsubscribeInput = Schema.Struct({
  email: Email
})
export type RequestUnsubscribeInput = typeof RequestUnsubscribeInput.Type

export const RequestUnsubscribeResponse = Schema.Struct({
  sent: Schema.Boolean
})

export const NewsletterGroup = HttpApiGroup.make('newsletter')
  .add(
    HttpApiEndpoint.post('subscribe', '/api/newsletter/subscribe', {
      payload: SubscribeInput,
      success: SubscribeResponse,
      error: HttpApiError.InternalServerError
    })
  )
  .add(
    HttpApiEndpoint.post('unsubscribe', '/api/newsletter/unsubscribe', {
      payload: UnsubscribeInput,
      success: UnsubscribeResponse,
      error: HttpApiError.NotFound
    })
  )
  .add(
    HttpApiEndpoint.post('requestUnsubscribe', '/api/newsletter/request-unsubscribe', {
      payload: RequestUnsubscribeInput,
      success: RequestUnsubscribeResponse
    })
  )
