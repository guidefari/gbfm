import { eq } from 'drizzle-orm'
import { db } from '@/db'
import {
  emailDeliveryLogsTable,
  type InsertEmailDeliveryLog
} from '@/db/email.schema'

export class EmailDeliveryLogRepository {
  /**
   * Create a new email delivery log entry
   */
  static async create(log: InsertEmailDeliveryLog) {
    const [result] = await db
      .insert(emailDeliveryLogsTable)
      .values(log)
      .returning()
    return result
  }

  /**
   * Update an existing email delivery log
   */
  static async update(id: string, updates: Partial<InsertEmailDeliveryLog>) {
    const [result] = await db
      .update(emailDeliveryLogsTable)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(emailDeliveryLogsTable.id, id))
      .returning()
    return result
  }

  /**
   * Get email delivery logs for a specific author
   */
  static async getByAuthorId(authorId: string, limit = 50) {
    return db
      .select()
      .from(emailDeliveryLogsTable)
      .where(eq(emailDeliveryLogsTable.authorId, authorId))
      .orderBy(emailDeliveryLogsTable.createdAt)
      .limit(limit)
  }

  /**
   * Get email delivery logs by recipient email
   */
  static async getByRecipientEmail(email: string, limit = 50) {
    return db
      .select()
      .from(emailDeliveryLogsTable)
      .where(eq(emailDeliveryLogsTable.recipientEmail, email))
      .orderBy(emailDeliveryLogsTable.createdAt)
      .limit(limit)
  }

  /**
   * Mark an email as sent (after successful SES send)
   */
  static async markAsSent(id: string, sesMessageId?: string) {
    return EmailDeliveryLogRepository.update(id, {
      status: 'SENT',
      sentAt: new Date(),
      sesMessageId
    })
  }

  /**
   * Mark an email as failed
   */
  static async markAsFailed(id: string, errorMessage: string) {
    return EmailDeliveryLogRepository.update(id, {
      status: 'FAILED',
      errorMessage
    })
  }

  /**
   * Mark an email as delivered (via webhook)
   */
  static async markAsDelivered(sesMessageId: string) {
    const [log] = await db
      .select()
      .from(emailDeliveryLogsTable)
      .where(eq(emailDeliveryLogsTable.sesMessageId, sesMessageId))
      .limit(1)

    if (log) {
      return EmailDeliveryLogRepository.update(log.id, {
        status: 'DELIVERED',
        deliveredAt: new Date()
      })
    }
  }

  /**
   * Mark an email as bounced (via webhook)
   */
  static async markAsBounced(sesMessageId: string) {
    const [log] = await db
      .select()
      .from(emailDeliveryLogsTable)
      .where(eq(emailDeliveryLogsTable.sesMessageId, sesMessageId))
      .limit(1)

    if (log) {
      return EmailDeliveryLogRepository.update(log.id, {
        status: 'BOUNCED',
        bouncedAt: new Date()
      })
    }
  }

  /**
   * Mark an email as complained (spam complaint via webhook)
   */
  static async markAsComplained(sesMessageId: string) {
    const [log] = await db
      .select()
      .from(emailDeliveryLogsTable)
      .where(eq(emailDeliveryLogsTable.sesMessageId, sesMessageId))
      .limit(1)

    if (log) {
      return EmailDeliveryLogRepository.update(log.id, {
        status: 'COMPLAINED',
        complainedAt: new Date()
      })
    }
  }
}
