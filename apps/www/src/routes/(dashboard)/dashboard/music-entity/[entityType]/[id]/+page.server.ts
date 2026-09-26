import { error } from '@sveltejs/kit'

import { requireDashboardAccess } from '@/lib/server/dashboard/guards'

import type { PageServerLoad } from './$types'

const types = new Set(['artist', 'album', 'track', 'playlist', 'label'])

export const load = ((event) => {
  requireDashboardAccess(event, 'admin')

  if (!types.has(event.params.entityType)) error(404, 'Unknown music entity')

  return { entityType: event.params.entityType, id: event.params.id }
}) satisfies PageServerLoad
