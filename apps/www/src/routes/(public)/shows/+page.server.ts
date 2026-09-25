import { getPublicJson, record, records, text } from '@/lib/server/public/content'
import type { PageServerLoad } from './$types'
export const load = (async (event) => {
  const result = await getPublicJson(event, '/api/shows?limit=100&offset=0')
  if (!result.ok) return { shows: [], selected: null, episodes: [], failure: result.message }
  const shows = records(result.value)
  const slug = event.url.searchParams.get('show') ?? text(shows[0]?.slug)
  const selected = shows.find((show) => text(show.slug) === slug) ?? null
  if (!selected) return { shows, selected, episodes: [], failure: null }
  const episodesResult = await getPublicJson(
    event,
    `/api/shows/${encodeURIComponent(slug)}/episodes`
  )
  return {
    shows,
    selected: record(selected),
    episodes: episodesResult.ok ? records(episodesResult.value) : [],
    failure: null
  }
}) satisfies PageServerLoad
