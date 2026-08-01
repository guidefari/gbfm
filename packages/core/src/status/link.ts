import { Schema } from 'effect'

export const LINK_STATUSES = ['verified', 'rejected'] as const

export const linkStatusSchema = Schema.Literals(LINK_STATUSES)

export type LinkStatus = Schema.Schema.Type<typeof linkStatusSchema>

export const LINK_STATUS = {
  VERIFIED: LINK_STATUSES[0],
  REJECTED: LINK_STATUSES[1]
} as const
