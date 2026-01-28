import { createRoute } from '@hono/zod-openapi'
import * as HttpStatusCodes from 'stoker/http-status-codes'
import { jsonContent, jsonContentRequired } from 'stoker/openapi/helpers'
import { createErrorSchema } from 'stoker/openapi/schemas'
import {
  insertNewsletterSubscriberSchema,
  subscribeResponseSchema
} from '@/db/newsletter.schema'

const tags = ['Newsletter']

export const subscribe = createRoute({
  path: '/subscribe',
  method: 'post',
  request: {
    body: jsonContentRequired(
      insertNewsletterSubscriberSchema,
      'Newsletter subscription data'
    )
  },
  tags,
  responses: {
    [HttpStatusCodes.CREATED]: jsonContent(
      subscribeResponseSchema,
      'Successfully subscribed'
    ),
    [HttpStatusCodes.OK]: jsonContent(
      subscribeResponseSchema,
      'Already subscribed'
    ),
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

export type SubscribeRoute = typeof subscribe
