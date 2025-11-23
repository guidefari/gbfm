import { eq } from 'drizzle-orm'
import { db } from '@/db'
import {
  emailDeliveryLogsTable,
  type InsertEmailDeliveryLog
} from '@/db/email.schema'

export async function createEmailDeliveryLog(log: InsertEmailDeliveryLog) {
  const [result] = await db
    .insert(emailDeliveryLogsTable)
    .values(log)
    .returning()
  if (!result) {
    throw new Error('Failed to create email delivery log')
  }
  return result
}

export async function updateEmailDeliveryLog(
  id: string,
  updates: Partial<InsertEmailDeliveryLog>
) {
  const [result] = await db
    .update(emailDeliveryLogsTable)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(emailDeliveryLogsTable.id, id))
    .returning()
  return result
}

export async function getEmailDeliveryLogsByAuthorId(
  authorId: string,
  limit = 50
) {
  return db
    .select()
    .from(emailDeliveryLogsTable)
    .where(eq(emailDeliveryLogsTable.authorId, authorId))
    .orderBy(emailDeliveryLogsTable.createdAt)
    .limit(limit)
}

export async function getEmailDeliveryLogsByRecipientEmail(
  email: string,
  limit = 50
) {
  return db
    .select()
    .from(emailDeliveryLogsTable)
    .where(eq(emailDeliveryLogsTable.recipientEmail, email))
    .orderBy(emailDeliveryLogsTable.createdAt)
    .limit(limit)
}

export async function markEmailDeliveryLogAsSent(
  id: string,
  sesMessageId?: string
) {
  return updateEmailDeliveryLog(id, {
    status: 'SENT',
    sentAt: new Date(),
    sesMessageId
  })
}

export async function markEmailDeliveryLogAsFailed(
  id: string,
  errorMessage: string
) {
  return updateEmailDeliveryLog(id, {
    status: 'FAILED',
    errorMessage
  })
}

export async function markEmailDeliveryLogAsDelivered(sesMessageId: string) {
  const [log] = await db
    .select()
    .from(emailDeliveryLogsTable)
    .where(eq(emailDeliveryLogsTable.sesMessageId, sesMessageId))
    .limit(1)

  if (log) {
    return updateEmailDeliveryLog(log.id, {
      status: 'DELIVERED',
      deliveredAt: new Date()
    })
  }
}

export async function markEmailDeliveryLogAsBounced(sesMessageId: string) {
  const [log] = await db
    .select()
    .from(emailDeliveryLogsTable)
    .where(eq(emailDeliveryLogsTable.sesMessageId, sesMessageId))
    .limit(1)

  if (log) {
    return updateEmailDeliveryLog(log.id, {
      status: 'BOUNCED',
      bouncedAt: new Date()
    })
  }
}

export async function markEmailDeliveryLogAsComplained(sesMessageId: string) {
  const [log] = await db
    .select()
    .from(emailDeliveryLogsTable)
    .where(eq(emailDeliveryLogsTable.sesMessageId, sesMessageId))
    .limit(1)

  if (log) {
    return updateEmailDeliveryLog(log.id, {
      status: 'COMPLAINED',
      complainedAt: new Date()
    })
  }
}
