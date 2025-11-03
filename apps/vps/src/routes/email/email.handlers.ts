import { sendMixNotificationEmail } from '@gbfm/email/sender'
import { and, eq } from 'drizzle-orm'
import * as HttpStatusCodes from 'stoker/http-status-codes'
import { db } from '@/db'
import { audioTable } from '@/db/audio.schema'
import type { AppRouteHandler } from '@/lib/types'

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
  const errors: string[] = []

  try {
    for (const recipient of recipients) {
      const username =
        metadata?.username || recipient.split('@')[0] || 'listener'

      try {
        await sendMixNotificationEmail({
          to: recipient,
          username,
          mixTitle: metadata?.mixTitle || mix.title,
          artistName: metadata?.artistName || 'Guide Fari',
          mixUrl,
          coverImageUrl,
          releaseDate
        })

        sentTo.push(recipient)
      } catch (emailError) {
        console.error(`Failed to send to ${recipient}:`, emailError)
        errors.push(recipient)
      }
    }

    if (sentTo.length === 0) {
      return c.json(
        { error: 'Failed to send any emails' },
        HttpStatusCodes.INTERNAL_SERVER_ERROR
      )
    }

    return c.json(
      {
        success: true,
        sentTo,
        emailIds: sentTo.map(() => 'ses-sent'),
        message: `Successfully sent ${sentTo.length} notification(s)${errors.length > 0 ? ` (${errors.length} failed)` : ''}`
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
