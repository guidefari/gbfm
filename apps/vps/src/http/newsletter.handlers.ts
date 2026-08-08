import { Api } from '@gbfm/api/api'
import {
  sendNewsletterAdminNotificationEmail,
  sendNewsletterUnsubscribeLinkEmail,
  sendNewsletterWelcomeEmail
} from '@gbfm/email/sender'
import * as Sentry from '@sentry/bun'
import { and, eq, isNull } from 'drizzle-orm'
import { Effect } from 'effect'
import { HttpApiBuilder, HttpApiError } from 'effect/unstable/httpapi'
import { Database } from '@/db/layer'
import { newsletterSubscribersTable } from '@/db/newsletter.schema'
import { DatabaseError, getErrorMessage } from '@/errors'
import { dieOnDatabaseError as makeDieOnDatabaseError } from '@/http/handler-utils'
import { globalUnsubscribe } from '@/repositories/email-preferences.repository'
import { config } from '@/services/config.service'

const dieOnDatabaseError = makeDieOnDatabaseError('newsletter')

function notifyAdmin(event: 'subscribed' | 'unsubscribed', email: string): void {
  if (!config.adminEmail) return
  sendNewsletterAdminNotificationEmail({
    to: config.adminEmail,
    event,
    email
  }).catch((err) => console.error('Admin newsletter notification failed:', err))
  Sentry.addBreadcrumb({
    category: 'newsletter',
    message: `newsletter.${event}`,
    level: 'info',
    data: { email }
  })
}

export const NewsletterHandlersLive = HttpApiBuilder.group(Api, 'newsletter', (handlers) =>
  handlers
    .handle('subscribe', ({ payload }) =>
      Effect.gen(function* () {
        const db = yield* Database
        const normalizedEmail = payload.email.trim().toLowerCase()

        const result = yield* dieOnDatabaseError(
          Effect.tryPromise({
            try: () =>
              db
                .insert(newsletterSubscribersTable)
                .values({
                  email: normalizedEmail,
                  ...(payload.name && { name: payload.name.trim() }),
                  source: payload.source || 'subscribe_page'
                })
                .onConflictDoNothing({ target: newsletterSubscribersTable.email })
                .returning(),
            catch: (error) =>
              new DatabaseError({
                message: `Failed to subscribe to newsletter: ${getErrorMessage(error)}`,
                operation: 'insert',
                table: 'newsletter_subscribers'
              })
          })
        )

        if (result.length === 0) {
          return { subscribed: false, email: normalizedEmail }
        }

        const row = result[0]
        if (row?.unsubscribeToken) {
          const unsubscribeUrl = `${process.env.APP_URL ?? 'https://goosebumps.fm'}/unsubscribe?token=${row.unsubscribeToken}`
          sendNewsletterWelcomeEmail({ to: normalizedEmail, unsubscribeUrl }).catch((err) =>
            console.error('Newsletter welcome email failed:', err)
          )
        }

        notifyAdmin('subscribed', normalizedEmail)

        return { subscribed: true, email: normalizedEmail }
      })
    )
    .handle('unsubscribe', ({ payload }) =>
      Effect.gen(function* () {
        const db = yield* Database
        const result = yield* dieOnDatabaseError(
          Effect.tryPromise({
            try: () =>
              db
                .update(newsletterSubscribersTable)
                .set({ unsubscribedAt: new Date() })
                .where(eq(newsletterSubscribersTable.unsubscribeToken, payload.token))
                .returning({
                  id: newsletterSubscribersTable.id,
                  email: newsletterSubscribersTable.email,
                  userId: newsletterSubscribersTable.userId
                }),
            catch: (error) =>
              new DatabaseError({
                message: `Failed to unsubscribe from newsletter: ${getErrorMessage(error)}`,
                operation: 'update',
                table: 'newsletter_subscribers'
              })
          })
        )

        if (result.length === 0) {
          return yield* new HttpApiError.NotFound()
        }

        const linkedUserId = result[0]?.userId
        if (linkedUserId) {
          yield* Effect.promise(() =>
            globalUnsubscribe(linkedUserId, db).catch((err) =>
              console.error('Failed to propagate newsletter unsubscribe to user preferences:', err)
            )
          )
        }

        notifyAdmin('unsubscribed', result[0]?.email ?? payload.token)

        return { success: true }
      })
    )
    .handle('requestUnsubscribe', ({ payload }) =>
      Effect.gen(function* () {
        const db = yield* Database
        const normalizedEmail = payload.email.trim().toLowerCase()

        const [row] = yield* dieOnDatabaseError(
          Effect.tryPromise({
            try: () =>
              db
                .select({ unsubscribeToken: newsletterSubscribersTable.unsubscribeToken })
                .from(newsletterSubscribersTable)
                .where(
                  and(
                    eq(newsletterSubscribersTable.email, normalizedEmail),
                    isNull(newsletterSubscribersTable.unsubscribedAt)
                  )
                )
                .limit(1),
            catch: (error) =>
              new DatabaseError({
                message: `Failed to look up newsletter subscriber: ${getErrorMessage(error)}`,
                operation: 'select',
                table: 'newsletter_subscribers'
              })
          })
        )

        if (row?.unsubscribeToken) {
          const unsubscribeUrl = `${process.env.APP_URL ?? 'https://goosebumps.fm'}/unsubscribe?token=${row.unsubscribeToken}`
          sendNewsletterUnsubscribeLinkEmail({
            to: normalizedEmail,
            unsubscribeUrl
          }).catch((err) => console.error('Request unsubscribe email failed:', err))
        }

        return { sent: true }
      })
    )
)
