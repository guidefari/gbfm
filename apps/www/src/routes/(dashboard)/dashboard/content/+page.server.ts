import { redirect } from '@sveltejs/kit'
import type { PageServerLoad } from './$types'
import { requireDashboardAccess } from '@/lib/server/dashboard/guards'
export const load: PageServerLoad = (event) => {
  requireDashboardAccess(event, 'creator')
  redirect(303, '/dashboard/content/mixes')
}
