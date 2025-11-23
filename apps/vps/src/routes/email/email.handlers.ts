import { sendMixNotificationEmail } from '@gbfm/email/sender'
import { and, eq } from 'drizzle-orm'
import * as HttpStatusCodes from 'stoker/http-status-codes'
import { db } from '@/db'
import { audioTable } from '@/db/audio.schema'
import {
  EMAIL_DELIVERY_STATUSES,
  EMAIL_NOTIFICATION_TYPES
} from '@/db/email.schema'
import { usersTable } from '@/db/user.schema'
import type { AppRouteHandler } from '@/lib/types'
import {
  createEmailDeliveryLog,
  markEmailDeliveryLogAsFailed,
  markEmailDeliveryLogAsSent
} from '@/repositories/email-delivery-log.repository'
import { canReceiveEmail } from '@/repositories/email-preferences.repository'

import type { SendMixNotificationRoute } from './email.routes'

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
      const username =
        metadata?.username || recipient.split('@')[0] || 'listener'

      // Look up user by email to check preferences
      const [user] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.email, recipient))
        .limit(1)

      // Check email preferences if author exists
      if (user) {
        const canReceive = await canReceiveEmail(
          user.id,
          EMAIL_NOTIFICATION_TYPES.MIX_RELEASE
        )

        if (!canReceive) {
          console.log(
            `Skipping ${recipient}: email preferences disabled for mix releases`
          )
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
        console.error(`Failed to send to ${recipient}:`, emailError)

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
