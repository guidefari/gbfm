import { getPublicJson, record, records } from '@/lib/server/public/content'
import type { PageServerLoad } from './$types'
export const load = (async (event) => {
  const slug = encodeURIComponent(event.params.showSlug)
  const [show, episodes] = await Promise.all([
    getPublicJson(event, `/api/shows/${slug}`),
    getPublicJson(event, `/api/shows/${slug}/episodes`)
  ])
  return {
    item: show.ok ? record(show.value) : null,
    episodes: episodes.ok ? records(episodes.value) : [],
    failure: show.ok ? null : show.message
  }
}) satisfies PageServerLoad
