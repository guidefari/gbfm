import { sendInviteEmail } from '@gbfm/email/sender'
import { eq } from 'drizzle-orm'
import { Effect } from 'effect'
import * as HttpStatusCodes from 'stoker/http-status-codes'
import { db } from '@/db'
import { user as usersTable, verification } from '@/db/auth.schema'
import {
  EMAIL_DELIVERY_STATUSES,
  EMAIL_NOTIFICATION_TYPES
} from '@/db/email.schema'
import type { AppRouteHandler } from '@/lib/types'
import {
  createEmailDeliveryLog,
  markEmailDeliveryLogAsFailed,
  markEmailDeliveryLogAsSent
} from '@/repositories/email-delivery-log.repository'
import { config } from '@/services/config.service'

import type { SendInviteRoute } from './invite.routes'

export const sendInviteHandler: AppRouteHandler<SendInviteRoute> = async (
  c
) => {
  const currentUser = c.get('user')

  if (currentUser.role !== 'admin') {
    return c.json({ error: 'Unauthorized' }, HttpStatusCodes.UNAUTHORIZED)
  }

  const { userId } = c.req.valid('json')

  const [targetUser] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1)

  if (!targetUser) {
    return c.json({ error: 'User not found' }, HttpStatusCodes.NOT_FOUND)
  }

  const token = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

  await db.insert(verification).values({
    id: crypto.randomUUID(),
    identifier: targetUser.email,
    value: token,
    expiresAt
  })

  const inviteUrl = `${config.urls.frontend}/auth/reset-password?token=${token}`

  const deliveryLog = await createEmailDeliveryLog({
    userId: targetUser.id,
    recipientEmail: targetUser.email,
    recipientName: targetUser.name,
    emailType: EMAIL_NOTIFICATION_TYPES.TRANSACTIONAL,
    templateName: 'invite',
    subject: "You've been invited to goosebumps.fm",
    status: EMAIL_DELIVERY_STATUSES.PENDING,
    metadata: { invitedBy: currentUser.id }
  })

  try {
    await sendInviteEmail({
      to: targetUser.email,
      name: targetUser.name,
      inviteUrl,
      role: targetUser.role ?? 'user'
    })

    await markEmailDeliveryLogAsSent(deliveryLog.id)

    return c.json(
      { success: true, emailId: deliveryLog.id },
      HttpStatusCodes.OK
    )
  } catch (error) {
    Effect.logError('[Invite] Failed to send invite email', {
      userId: targetUser.id,
      email: targetUser.email,
      emailLogId: deliveryLog.id,
      error: error instanceof Error ? error.message : String(error)
    }).pipe(Effect.runPromise)

    await markEmailDeliveryLogAsFailed(
      deliveryLog.id,
      error instanceof Error ? error.message : 'Unknown error'
    )

    return c.json(
      { error: 'Failed to send invite email' },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    )
  }
}
