import { sendMixNotificationEmail } from '@gbfm/email/sender'
import { and, eq } from 'drizzle-orm'
import { Effect } from 'effect'
import * as HttpStatusCodes from 'stoker/http-status-codes'
import { db } from '@/db'
import { audioTable } from '@/db/audio.schema'
import { user as usersTable } from '@/db/auth.schema'
import {
  EMAIL_DELIVERY_STATUSES,
  EMAIL_NOTIFICATION_TYPES,
  type SelectEmailDeliveryLog,
  selectEmailDeliveryLogSchema
} from '@/db/email.schema'
import type { AppRouteHandler } from '@/lib/types'
import {
  createEmailDeliveryLog,
  getAdminEmailLogs,
  markEmailDeliveryLogAsFailed,
  markEmailDeliveryLogAsSent
} from '@/repositories/email-delivery-log.repository'
import { canReceiveEmail } from '@/repositories/email-preferences.repository'

import type {
  GetEmailLogsRoute,
  SendMixNotificationRoute
} from './email.routes'

const EMAIL_TYPE_NORMALIZATION_MAP: Record<string, string> = {
  TRANSACTIONAL: EMAIL_NOTIFICATION_TYPES.TRANSACTIONAL,
  MIX_RELEASE: EMAIL_NOTIFICATION_TYPES.MIX_RELEASE,
  MIXRELEASE: EMAIL_NOTIFICATION_TYPES.MIX_RELEASE,
  MIX_NOTIFICATION: EMAIL_NOTIFICATION_TYPES.MIX_RELEASE,
  MUSIC_REMINDER: EMAIL_NOTIFICATION_TYPES.MIX_RELEASE,
  PROMOTIONAL: EMAIL_NOTIFICATION_TYPES.PROMOTIONAL,
  SYSTEM: EMAIL_NOTIFICATION_TYPES.SYSTEM
}

const EMAIL_STATUS_NORMALIZATION_MAP: Record<string, string> = {
  PENDING: EMAIL_DELIVERY_STATUSES.PENDING,
  SENT: EMAIL_DELIVERY_STATUSES.SENT,
  DELIVERED: EMAIL_DELIVERY_STATUSES.DELIVERED,
  BOUNCED: EMAIL_DELIVERY_STATUSES.BOUNCED,
  COMPLAINED: EMAIL_DELIVERY_STATUSES.COMPLAINED,
  FAILED: EMAIL_DELIVERY_STATUSES.FAILED,
  SUCCESS: EMAIL_DELIVERY_STATUSES.SENT,
  FAILURE: EMAIL_DELIVERY_STATUSES.FAILED
}

function normalizeLogToken(value: string | null | undefined) {
  return (value ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function normalizeEmailLogRecord(
  log: SelectEmailDeliveryLog
): SelectEmailDeliveryLog {
  const normalizedTypeToken = normalizeLogToken(log.emailType)
  const normalizedStatusToken = normalizeLogToken(log.status)

  return {
    ...log,
    emailType:
      EMAIL_TYPE_NORMALIZATION_MAP[normalizedTypeToken] ??
      EMAIL_NOTIFICATION_TYPES.SYSTEM,
    status:
      EMAIL_STATUS_NORMALIZATION_MAP[normalizedStatusToken] ??
      EMAIL_DELIVERY_STATUSES.FAILED
  }
}

export const sendMixNotification: AppRouteHandler<
  SendMixNotificationRoute
> = async (c) => {
  const { recipients, mixSlug, metadata } = c.req.valid('json')

  const [mix] = await db
    .select()
    .from(audioTable)
    .where(and(eq(audioTable.slug, mixSlug), eq(audioTable.type, 'mix')))
    .limit(1)

  if (!mix) {
    return c.json(
      { error: `Mix not found: ${mixSlug}` },
      HttpStatusCodes.NOT_FOUND
    )
  }

  const mixUrl = `https://goosebumps.fm/mixes/${mix.slug}`
  const coverImageUrl = metadata?.coverImageUrl || mix.thumbnailUrl || undefined

  const releaseDate =
    metadata?.releaseDate ||
    (mix.createdAt
      ? new Date(mix.createdAt).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        })
      : new Date().toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        }))

  const sentTo: string[] = []
  const skipped: string[] = []
  const errors: string[] = []
  const emailIds: string[] = []

  try {
    for (const recipient of recipients) {
      // Look up user by email to check preferences
      const [user] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.email, recipient))
        .limit(1)

      const username =
        user?.name ||
        metadata?.username ||
        recipient.split('@')[0] ||
        'listener'

      // Check email preferences if author exists
      if (user) {
        const canReceive = await canReceiveEmail(
          user.id,
          EMAIL_NOTIFICATION_TYPES.MIX_RELEASE
        )

        if (!canReceive) {
          Effect.annotateCurrentSpan('totalRecipients', recipients.length).pipe(
            Effect.runPromise
          )
          Effect.annotateCurrentSpan('mixSlug', mixSlug).pipe(Effect.runPromise)
          Effect.annotateCurrentSpan(
            'mixTitle',
            metadata?.mixTitle || mix.title
          ).pipe(Effect.runPromise)

          Effect.logInfo('[Email] Sending mix notification emails', {
            totalRecipients: recipients.length,
            mixSlug,
            mixTitle: metadata?.mixTitle || mix.title
          }).pipe(Effect.runPromise)
          skipped.push(recipient)
          continue
        }
      }

      const mixTitle = metadata?.mixTitle || mix.title
      const subject = `New mix: ${mixTitle}`

      // Create email delivery log entry
      const deliveryLog = await createEmailDeliveryLog({
        userId: user?.id,
        recipientEmail: recipient,
        recipientName: username,
        emailType: EMAIL_NOTIFICATION_TYPES.MIX_RELEASE,
        templateName: 'mix-notification',
        subject,
        status: EMAIL_DELIVERY_STATUSES.PENDING,
        metadata: {
          mixId: mix.id,
          mixSlug: mix.slug,
          mixTitle,
          artistName: metadata?.artistName || 'Guide Fari',
          coverImageUrl,
          releaseDate
        }
      })

      try {
        await sendMixNotificationEmail({
          to: recipient,
          username,
          mixTitle,
          artistName: metadata?.artistName || 'Guide Fari',
          mixUrl,
          coverImageUrl,
          releaseDate
        })

        // Mark as sent in the log
        await markEmailDeliveryLogAsSent(deliveryLog.id)

        sentTo.push(recipient)
        emailIds.push(deliveryLog.id)
      } catch (emailError) {
        Effect.logError('[Email] Failed to send mix notification email', {
          recipient,
          userId: user?.id,
          mixSlug,
          mixTitle: metadata?.mixTitle || mix.title,
          emailLogId: deliveryLog.id,
          error:
            emailError instanceof Error
              ? emailError.message
              : String(emailError)
        }).pipe(Effect.runPromise)

        // Mark as failed in the log
        await markEmailDeliveryLogAsFailed(
          deliveryLog.id,
          emailError instanceof Error
            ? emailError.message
            : 'Unknown error occurred'
        )

        errors.push(recipient)
      }
    }

    if (sentTo.length === 0 && skipped.length === 0) {
      return c.json(
        { error: 'Failed to send any emails' },
        HttpStatusCodes.INTERNAL_SERVER_ERROR
      )
    }

    return c.json(
      {
        success: true,
        sentTo,
        emailIds,
        message: `Successfully sent ${sentTo.length} notification(s)${
          skipped.length > 0
            ? ` (${skipped.length} skipped due to preferences)`
            : ''
        }${errors.length > 0 ? ` (${errors.length} failed)` : ''}`
      },
      HttpStatusCodes.OK
    )
  } catch (error) {
    console.error('Failed to send mix notification emails:', error)
    return c.json(
      { error: 'Failed to send emails' },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    )
  }
}

export const getEmailLogs: AppRouteHandler<GetEmailLogsRoute> = async (c) => {
  const query = c.req.valid('query')

  try {
    const result = await getAdminEmailLogs(query)
    const data = result.data.map((log) =>
      selectEmailDeliveryLogSchema.parse(normalizeEmailLogRecord(log))
    )
    return c.json({ data, pagination: result.pagination }, HttpStatusCodes.OK)
  } catch (error) {
    console.error('Failed to fetch email logs:', error)
    return c.json(
      { error: 'Failed to fetch email logs' },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    )
  }
}
