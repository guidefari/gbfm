import { redirect } from '@sveltejs/kit'

import { requireDashboardAccess } from '@/lib/server/dashboard/guards'

import type { PageServerLoad } from './$types'

export const load: PageServerLoad = (event) => {
  requireDashboardAccess(event, 'creator')
  redirect(303, '/dashboard/content/mixes')
}
