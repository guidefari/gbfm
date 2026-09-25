import { loadPublicActionState } from '@/lib/server/public/action-state'
import { getPublicJson, record, records, text } from '@/lib/server/public/content'

import type { PageServerLoad } from './$types'

export const load = (async (event) => {
  const slug = encodeURIComponent(event.params.showSlug)

  const [show, episodes, allShows] = await Promise.all([
    getPublicJson(event, `/api/shows/${slug}`),
    getPublicJson(event, `/api/shows/${slug}/episodes`),
    getPublicJson(event, '/api/shows?limit=100&offset=0'),
  ])

  const item = show.ok ? record(show.value) : null
  const actionActive = item ? await loadPublicActionState(event, 'show', text(item.id)) : false

  return {
    item,
    episodes: episodes.ok ? records(episodes.value) : [],
    shows: allShows.ok ? records(allShows.value) : [],
    actionActive,
    failure: show.ok ? null : show.message,
  }
}) satisfies PageServerLoad
