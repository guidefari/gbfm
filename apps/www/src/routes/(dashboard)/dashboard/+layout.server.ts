import type { LayoutServerLoad } from './$types'
import { requireDashboardAccess } from '@/lib/server/dashboard/guards'

export const load: LayoutServerLoad = (event) => requireDashboardAccess(event, 'member')
