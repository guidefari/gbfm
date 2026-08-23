import type { AdminOverviewResponse } from '@gbfm/api/admin'

export type AdminOverview = AdminOverviewResponse
export type AdminOverviewContentBreakdown = AdminOverview['publishing']['mixes']
