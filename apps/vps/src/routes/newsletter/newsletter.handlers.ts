import {
  sendNewsletterAdminNotificationEmail,
  sendNewsletterUnsubscribeLinkEmail,
  sendNewsletterWelcomeEmail
} from '@gbfm/email/sender'
import * as Sentry from '@sentry/bun'
import { and, eq, isNull } from 'drizzle-orm'
import * as HttpStatusCodes from 'stoker/http-status-codes'
import { db } from '@/db'
import { newsletterSubscribersTable } from '@/db/newsletter.schema'
import type { AppRouteHandler } from '@/lib/types'
import { config } from '@/services/config.service'
import type {
  RequestUnsubscribeRoute,
  SubscribeRoute,
  UnsubscribeRoute
} from './newsletter.routes'

function notifyAdmin(
  event: 'subscribed' | 'unsubscribed',
  email: string
): void {
  if (!config.adminEmail) return
  sendNewsletterAdminNotificationEmail({
    to: config.adminEmail,
    event,
    email
  }).catch((err) => console.error('Admin newsletter notification failed:', err))
  Sentry.captureMessage(`newsletter.${event}: ${email}`, 'info')
}

export const subscribe: AppRouteHandler<SubscribeRoute> = async (c) => {
  const { email, name, source } = c.req.valid('json')
  const normalizedEmail = email.trim().toLowerCase()

  try {
    const result = await db
      .insert(newsletterSubscribersTable)
      .values({
        email: normalizedEmail,
        ...(name && { name: name.trim() }),
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

    const row = result[0]
    if (row?.unsubscribeToken) {
      const unsubscribeUrl = `${process.env.APP_URL ?? 'https://goosebumps.fm'}/unsubscribe?token=${row.unsubscribeToken}`
      sendNewsletterWelcomeEmail({ to: normalizedEmail, unsubscribeUrl }).catch(
        (err) => console.error('Newsletter welcome email failed:', err)
      )
    }

    notifyAdmin('subscribed', normalizedEmail)

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

export const unsubscribe: AppRouteHandler<UnsubscribeRoute> = async (c) => {
  const { token } = c.req.valid('json')

  const result = await db
    .update(newsletterSubscribersTable)
    .set({ unsubscribedAt: new Date() })
    .where(eq(newsletterSubscribersTable.unsubscribeToken, token))
    .returning({
      id: newsletterSubscribersTable.id,
      email: newsletterSubscribersTable.email
    })

  if (result.length === 0) {
    return c.json({ success: false }, HttpStatusCodes.NOT_FOUND)
  }

  notifyAdmin('unsubscribed', result[0]?.email ?? token)

  return c.json({ success: true }, HttpStatusCodes.OK)
}

export const requestUnsubscribe: AppRouteHandler<
  RequestUnsubscribeRoute
> = async (c) => {
  const { email } = c.req.valid('json')
  const normalizedEmail = email.trim().toLowerCase()

  const [row] = await db
    .select({ unsubscribeToken: newsletterSubscribersTable.unsubscribeToken })
    .from(newsletterSubscribersTable)
    .where(
      and(
        eq(newsletterSubscribersTable.email, normalizedEmail),
        isNull(newsletterSubscribersTable.unsubscribedAt)
      )
    )
    .limit(1)

  if (row?.unsubscribeToken) {
    const unsubscribeUrl = `${process.env.APP_URL ?? 'https://goosebumps.fm'}/unsubscribe?token=${row.unsubscribeToken}`
    sendNewsletterUnsubscribeLinkEmail({
      to: normalizedEmail,
      unsubscribeUrl
    }).catch((err) => console.error('Request unsubscribe email failed:', err))
  }

  return c.json({ sent: true }, HttpStatusCodes.OK)
}
