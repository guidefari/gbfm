import type { PageServerLoad } from './$types'
import { requireDashboardAccess } from '@/lib/server/dashboard/guards'
export const load: PageServerLoad = (event) => requireDashboardAccess(event, 'creator')
