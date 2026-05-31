import { Schema } from 'effect'

export const EMAIL_DELIVERY_STATUSES = {
  PENDING: 'PENDING',
  SENT: 'SENT',
  DELIVERED: 'DELIVERED',
  BOUNCED: 'BOUNCED',
  COMPLAINED: 'COMPLAINED',
  FAILED: 'FAILED'
} as const

export const EMAIL_DELIVERY_STATUS_VALUES = [
  'PENDING',
  'SENT',
  'DELIVERED',
  'BOUNCED',
  'COMPLAINED',
  'FAILED'
] as const

export const emailDeliveryStatusSchema = Schema.Literals(EMAIL_DELIVERY_STATUS_VALUES)

export type EmailDeliveryStatus = Schema.Schema.Type<typeof emailDeliveryStatusSchema>
