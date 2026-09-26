import { requireDashboardAccess } from '@/lib/server/dashboard/guards'

import type { LayoutServerLoad } from './$types'

export const load: LayoutServerLoad = (event) => requireDashboardAccess(event, 'member')
