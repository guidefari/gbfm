import { Schema } from 'effect'

export const LINK_STATUSES = ['pending_review', 'verified', 'rejected'] as const

export const linkStatusSchema = Schema.Literals(LINK_STATUSES)

export type LinkStatus = Schema.Schema.Type<typeof linkStatusSchema>

export const LINK_STATUS = {
  PENDING_REVIEW: LINK_STATUSES[0],
  VERIFIED: LINK_STATUSES[1],
  REJECTED: LINK_STATUSES[2]
} as const
