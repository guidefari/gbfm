import { error } from '@sveltejs/kit'
import type { PageServerLoad } from './$types'
import { requireDashboardAccess } from '@/lib/server/dashboard/guards'
const types = ['artist', 'album', 'track', 'playlist', 'label']
export const load = ((event) => {
  requireDashboardAccess(event, 'admin')
  if (!types.includes(event.params.entityType)) error(404, 'Unknown music entity')
  return { entityType: event.params.entityType, id: event.params.id }
}) satisfies PageServerLoad
