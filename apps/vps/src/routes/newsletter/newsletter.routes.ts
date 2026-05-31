import { createRoute } from '@hono/zod-openapi'
import * as HttpStatusCodes from 'stoker/http-status-codes'
import { jsonContent, jsonContentRequired } from 'stoker/openapi/helpers'
import { createErrorSchema } from 'stoker/openapi/schemas'
import {
  insertNewsletterSubscriberSchema,
  requestUnsubscribeResponseSchema,
  requestUnsubscribeSchema,
  subscribeResponseSchema,
  unsubscribeResponseSchema,
  unsubscribeSchema
} from '@/db/newsletter.schema'

const tags = ['Newsletter']

export const subscribe = createRoute({
  path: '/subscribe',
  method: 'post',
  request: {
    body: jsonContentRequired(insertNewsletterSubscriberSchema, 'Newsletter subscription data')
  },
  tags,
  responses: {
    [HttpStatusCodes.CREATED]: jsonContent(subscribeResponseSchema, 'Successfully subscribed'),
    [HttpStatusCodes.OK]: jsonContent(subscribeResponseSchema, 'Already subscribed'),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(insertNewsletterSubscriberSchema),
      'Validation error'
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      subscribeResponseSchema
        .partial()
        .extend({ error: insertNewsletterSubscriberSchema.shape.email }),
      'Failed to subscribe'
    )
  }
})

export const unsubscribe = createRoute({
  path: '/unsubscribe',
  method: 'post',
  request: {
    body: jsonContentRequired(unsubscribeSchema, 'Unsubscribe token')
  },
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(unsubscribeResponseSchema, 'Unsubscribed successfully'),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(unsubscribeResponseSchema, 'Token not found'),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(unsubscribeSchema),
      'Validation error'
    )
  }
})

export const requestUnsubscribe = createRoute({
  path: '/request-unsubscribe',
  method: 'post',
  request: {
    body: jsonContentRequired(requestUnsubscribeSchema, 'Email address')
  },
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      requestUnsubscribeResponseSchema,
      'Unsubscribe email sent if address is on the list'
    ),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(requestUnsubscribeSchema),
      'Validation error'
    )
  }
})

export type SubscribeRoute = typeof subscribe
export type UnsubscribeRoute = typeof unsubscribe
export type RequestUnsubscribeRoute = typeof requestUnsubscribe
