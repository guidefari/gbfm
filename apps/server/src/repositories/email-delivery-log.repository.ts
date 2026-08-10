import { EMAIL_DELIVERY_STATUSES, type EmailDeliveryStatus } from '@gbfm/core/status'
import { and, desc, eq, gte, ilike, lt, type SQL, sql } from 'drizzle-orm'
import type { DatabaseClient } from '@/db/layer'
import { emailDeliveryLogsTable, type InsertEmailDeliveryLog } from '@/db/email.schema'
import { createPaginationMetadata } from '@/lib/pagination'

export type GetAdminEmailLogsParams = {
  limit: number
  offset: number
  status?: EmailDeliveryStatus
  recipientEmail?: string
  dateFrom?: string
  dateTo?: string
}

export async function createEmailDeliveryLog(
  log: InsertEmailDeliveryLog,
  database: DatabaseClient
) {
  const [result] = await database.insert(emailDeliveryLogsTable).values(log).returning()
  if (!result) {
    throw new Error('Failed to create email delivery log')
  }
  return result
}

export async function updateEmailDeliveryLog(
  id: string,
  updates: Partial<InsertEmailDeliveryLog>,
  database: DatabaseClient
) {
  const [result] = await database
    .update(emailDeliveryLogsTable)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(emailDeliveryLogsTable.id, id))
    .returning()
  return result
}

export async function getEmailDeliveryLogsByUserId(
  userId: string,
  database: DatabaseClient,
  limit: number = 50
) {
  return database
    .select()
    .from(emailDeliveryLogsTable)
    .where(eq(emailDeliveryLogsTable.userId, userId))
    .orderBy(emailDeliveryLogsTable.createdAt)
    .limit(limit)
}

export async function getEmailDeliveryLogsByRecipientEmail(
  email: string,
  database: DatabaseClient,
  limit: number = 50
) {
  return database
    .select()
    .from(emailDeliveryLogsTable)
    .where(eq(emailDeliveryLogsTable.recipientEmail, email))
    .orderBy(emailDeliveryLogsTable.createdAt)
    .limit(limit)
}

export async function markEmailDeliveryLogAsSent(
  id: string,
  database: DatabaseClient,
  sesMessageId?: string
) {
  return updateEmailDeliveryLog(
    id,
    {
      status: EMAIL_DELIVERY_STATUSES.SENT,
      sentAt: new Date(),
      sesMessageId
    },
    database
  )
}

export async function markEmailDeliveryLogAsFailed(
  id: string,
  errorMessage: string,
  database: DatabaseClient
) {
  return updateEmailDeliveryLog(
    id,
    {
      status: EMAIL_DELIVERY_STATUSES.FAILED,
      errorMessage
    },
    database
  )
}

export async function markEmailDeliveryLogAsDelivered(
  sesMessageId: string,
  database: DatabaseClient
) {
  const [log] = await database
    .select()
    .from(emailDeliveryLogsTable)
    .where(eq(emailDeliveryLogsTable.sesMessageId, sesMessageId))
    .limit(1)

  if (log) {
    return updateEmailDeliveryLog(
      log.id,
      {
        status: EMAIL_DELIVERY_STATUSES.DELIVERED,
        deliveredAt: new Date()
      },
      database
    )
  }
}

export async function markEmailDeliveryLogAsBounced(
  sesMessageId: string,
  database: DatabaseClient
) {
  const [log] = await database
    .select()
    .from(emailDeliveryLogsTable)
    .where(eq(emailDeliveryLogsTable.sesMessageId, sesMessageId))
    .limit(1)

  if (log) {
    return updateEmailDeliveryLog(
      log.id,
      {
        status: EMAIL_DELIVERY_STATUSES.BOUNCED,
        bouncedAt: new Date()
      },
      database
    )
  }
}

export async function markEmailDeliveryLogAsComplained(
  sesMessageId: string,
  database: DatabaseClient
) {
  const [log] = await database
    .select()
    .from(emailDeliveryLogsTable)
    .where(eq(emailDeliveryLogsTable.sesMessageId, sesMessageId))
    .limit(1)

  if (log) {
    return updateEmailDeliveryLog(
      log.id,
      {
        status: EMAIL_DELIVERY_STATUSES.COMPLAINED,
        complainedAt: new Date()
      },
      database
    )
  }
}

export async function getAdminEmailLogs(
  { limit, offset, status, recipientEmail, dateFrom, dateTo }: GetAdminEmailLogsParams,
  database: DatabaseClient
) {
  const filters: SQL[] = []

  if (status) {
    filters.push(eq(emailDeliveryLogsTable.status, status))
  }

  if (recipientEmail) {
    filters.push(ilike(emailDeliveryLogsTable.recipientEmail, `%${recipientEmail}%`))
  }

  if (dateFrom) {
    filters.push(gte(emailDeliveryLogsTable.createdAt, new Date(`${dateFrom}T00:00:00.000Z`)))
  }

  if (dateTo) {
    const nextUtcDay = new Date(`${dateTo}T00:00:00.000Z`)
    nextUtcDay.setUTCDate(nextUtcDay.getUTCDate() + 1)
    filters.push(lt(emailDeliveryLogsTable.createdAt, nextUtcDay))
  }

  const whereClause = filters.length > 0 ? and(...filters) : undefined

  const data = await database
    .select()
    .from(emailDeliveryLogsTable)
    .where(whereClause)
    .orderBy(desc(emailDeliveryLogsTable.createdAt))
    .limit(limit)
    .offset(offset)

  const countRows = await database
    .select({ total: sql<number>`count(*)`.mapWith(Number) })
    .from(emailDeliveryLogsTable)
    .where(whereClause)

  const total = countRows[0]?.total ?? 0

  return {
    data,
    pagination: createPaginationMetadata(total, limit, offset)
  }
}
