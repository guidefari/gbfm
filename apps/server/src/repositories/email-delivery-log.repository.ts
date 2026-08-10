import { EMAIL_DELIVERY_STATUSES, type EmailDeliveryStatus } from '@gbfm/core/status'
import { and, desc, eq, gte, ilike, lt, type SQL, sql } from 'drizzle-orm'
import type { DatabaseClient } from '@/db/layer'
import {
  emailDeliveryLogsTable,
  type EmailDeliveryFailureCategory,
  type EmailDeliveryMetadata,
  type EmailDeliveryProvider,
  type EmailNotificationType
} from '@/db/email.schema'
import { createPaginationMetadata } from '@/lib/pagination'

/** Filters for the admin delivery-log listing. */
export interface GetAdminEmailLogsParams {
  readonly limit: number
  readonly offset: number
  readonly status?: EmailDeliveryStatus
  readonly recipientEmail?: string
  readonly dateFrom?: string
  readonly dateTo?: string
}

/** A requested PENDING-to-terminal transition that found no PENDING row. */
export class EmailDeliveryLogTransitionError extends Error {
  readonly _tag = 'EmailDeliveryLogTransitionError' as const

  /** Creates a transition error for the guarded terminal operation. */
  constructor(readonly transition: 'mark-sent' | 'mark-failed') {
    super(`Email delivery log ${transition} transition requires a PENDING row`)
  }
}

/** The fields needed to persist one pending delivery attempt. */
export interface CreatePendingEmailDeliveryLogInput {
  readonly userId?: string
  readonly recipientEmail: string
  readonly recipientName?: string
  readonly emailType: EmailNotificationType
  readonly templateName: string
  readonly subject: string
  readonly metadata?: EmailDeliveryMetadata
}

/** Creates the PENDING row before the provider receives a message. */
export async function createPendingEmailDeliveryLog(
  input: CreatePendingEmailDeliveryLogInput,
  database: DatabaseClient
) {
  const [result] = await database
    .insert(emailDeliveryLogsTable)
    .values({ ...input, status: EMAIL_DELIVERY_STATUSES.PENDING })
    .returning({ id: emailDeliveryLogsTable.id })

  if (!result) throw new Error('Email delivery log insert returned no row')
  return result
}

/** Stores the provider receipt after an accepted delivery. */
export async function markEmailDeliveryLogAsSent(
  id: string,
  receipt: {
    readonly provider: EmailDeliveryProvider
    readonly providerMessageId: string
    readonly acceptedAt: Date
  },
  database: DatabaseClient
) {
  const [result] = await database
    .update(emailDeliveryLogsTable)
    .set({
      status: EMAIL_DELIVERY_STATUSES.SENT,
      provider: receipt.provider,
      providerMessageId: receipt.providerMessageId,
      sentAt: receipt.acceptedAt,
      updatedAt: receipt.acceptedAt
    })
    .where(
      and(
        eq(emailDeliveryLogsTable.id, id),
        eq(emailDeliveryLogsTable.status, EMAIL_DELIVERY_STATUSES.PENDING)
      )
    )
    .returning({ id: emailDeliveryLogsTable.id })

  if (!result) throw new EmailDeliveryLogTransitionError('mark-sent')
  return result
}

/** Stores a safe transport failure category without provider error text. */
export async function markEmailDeliveryLogAsFailed(
  id: string,
  failureCategory: EmailDeliveryFailureCategory,
  failedAt: Date,
  database: DatabaseClient
) {
  const [result] = await database
    .update(emailDeliveryLogsTable)
    .set({
      status: EMAIL_DELIVERY_STATUSES.FAILED,
      failureCategory,
      updatedAt: failedAt
    })
    .where(
      and(
        eq(emailDeliveryLogsTable.id, id),
        eq(emailDeliveryLogsTable.status, EMAIL_DELIVERY_STATUSES.PENDING)
      )
    )
    .returning({ id: emailDeliveryLogsTable.id })

  if (!result) throw new EmailDeliveryLogTransitionError('mark-failed')
  return result
}

/** Lists delivery logs for one user. */
export async function getEmailDeliveryLogsByUserId(
  userId: string,
  database: DatabaseClient,
  limit = 50
) {
  return database
    .select()
    .from(emailDeliveryLogsTable)
    .where(eq(emailDeliveryLogsTable.userId, userId))
    .orderBy(emailDeliveryLogsTable.createdAt)
    .limit(limit)
}

/** Lists delivery logs for one recipient address. */
export async function getEmailDeliveryLogsByRecipientEmail(
  email: string,
  database: DatabaseClient,
  limit = 50
) {
  return database
    .select()
    .from(emailDeliveryLogsTable)
    .where(eq(emailDeliveryLogsTable.recipientEmail, email))
    .orderBy(emailDeliveryLogsTable.createdAt)
    .limit(limit)
}

/** Lists delivery logs for the admin API. */
export async function getAdminEmailLogs(
  { limit, offset, status, recipientEmail, dateFrom, dateTo }: GetAdminEmailLogsParams,
  database: DatabaseClient
) {
  const filters: Array<SQL> = []

  if (status) filters.push(eq(emailDeliveryLogsTable.status, status))
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

  return { data, pagination: createPaginationMetadata(total, limit, offset) }
}
