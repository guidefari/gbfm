import { Schema } from 'effect'

export const REMINDER_STATUSES = ['pending', 'processing', 'sent', 'failed'] as const

export const reminderStatusSchema = Schema.Literals(REMINDER_STATUSES)

export type ReminderStatus = Schema.Schema.Type<typeof reminderStatusSchema>

export const REMINDER_STATUS = {
  PENDING: REMINDER_STATUSES[0],
  PROCESSING: REMINDER_STATUSES[1],
  SENT: REMINDER_STATUSES[2],
  FAILED: REMINDER_STATUSES[3]
} as const
