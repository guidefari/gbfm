import { getPublicJson, record, records, text } from '@/lib/server/public/content'
import { loadPublicActionState } from '@/lib/server/public/action-state'
import type { PageServerLoad } from './$types'
export const load = (async (event) => {
  const result = await getPublicJson(event, '/api/shows?limit=100&offset=0')
  if (!result.ok)
    return {
      shows: [],
      selected: null,
      episodes: [],
      actionActive: false,
      failure: result.message
    }
  const shows = records(result.value)
  const slug = event.url.searchParams.get('show') ?? text(shows[0]?.slug)
  const selected = shows.find((show) => text(show.slug) === slug) ?? null
  if (!selected) return { shows, selected, episodes: [], actionActive: false, failure: null }
  const episodesResult = await getPublicJson(
    event,
    `/api/shows/${encodeURIComponent(slug)}/episodes`
  )
  const actionActive = await loadPublicActionState(event, 'show', text(selected.id))
  return {
    shows,
    selected: record(selected),
    episodes: episodesResult.ok ? records(episodesResult.value) : [],
    actionActive,
    failure: null
  }
}) satisfies PageServerLoad
