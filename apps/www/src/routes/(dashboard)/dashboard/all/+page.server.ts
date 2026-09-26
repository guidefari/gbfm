import { redirect } from '@sveltejs/kit'

import { requireDashboardAccess } from '@/lib/server/dashboard/guards'

import type { PageServerLoad } from './$types'

export const load: PageServerLoad = (event) => {
  requireDashboardAccess(event, 'admin')
  redirect(303, '/dashboard/all/mixes')
}
