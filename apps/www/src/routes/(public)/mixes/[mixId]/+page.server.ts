import { getPublicJson, publicDetail, records, text } from '@/lib/server/public/content'
import type { PageServerLoad } from './$types'
export const load = (async (event) => {
  const detail = await publicDetail(
    event,
    `/api/content/audio/mix/${encodeURIComponent(event.params.mixId)}`
  )
  const showId = detail.item ? text(detail.item.showId) : ''
  if (!showId) return { ...detail, relatedShow: null }
  const shows = await getPublicJson(event, '/api/shows?limit=100&offset=0')
  const relatedShow = shows.ok
    ? (records(shows.value).find((show) => text(show.id) === showId) ?? null)
    : null
  return { ...detail, relatedShow }
}) satisfies PageServerLoad
