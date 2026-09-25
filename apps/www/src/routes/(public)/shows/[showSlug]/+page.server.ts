import { getPublicJson, record, records } from '@/lib/server/public/content'
import type { PageServerLoad } from './$types'
export const load = (async (event) => {
  const slug = encodeURIComponent(event.params.showSlug)
  const [show, episodes, allShows] = await Promise.all([
    getPublicJson(event, `/api/shows/${slug}`),
    getPublicJson(event, `/api/shows/${slug}/episodes`),
    getPublicJson(event, '/api/shows?limit=100&offset=0')
  ])
  return {
    item: show.ok ? record(show.value) : null,
    episodes: episodes.ok ? records(episodes.value) : [],
    shows: allShows.ok ? records(allShows.value) : [],
    failure: show.ok ? null : show.message
  }
}) satisfies PageServerLoad
