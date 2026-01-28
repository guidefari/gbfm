import * as HttpStatusCodes from 'stoker/http-status-codes'
import { db } from '@/db'
import { newsletterSubscribersTable } from '@/db/newsletter.schema'
import type { AppRouteHandler } from '@/lib/types'
import type { SubscribeRoute } from './newsletter.routes'

export const subscribe: AppRouteHandler<SubscribeRoute> = async (c) => {
  const { email, source } = c.req.valid('json')
  const normalizedEmail = email.trim().toLowerCase()

  try {
    const result = await db
      .insert(newsletterSubscribersTable)
      .values({
        email: normalizedEmail,
        source: source || 'subscribe_page'
      })
      .onConflictDoNothing({ target: newsletterSubscribersTable.email })
      .returning()

    if (result.length === 0) {
      return c.json(
        { subscribed: false, email: normalizedEmail },
        HttpStatusCodes.OK
      )
    }

    return c.json(
      { subscribed: true, email: normalizedEmail },
      HttpStatusCodes.CREATED
    )
  } catch (error) {
    console.error('Newsletter subscription error:', error)
    return c.json(
      { error: 'Failed to subscribe' },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    )
  }
}
