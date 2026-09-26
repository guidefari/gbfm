import { loadPublicActionState } from '@/lib/server/public/action-state'
import { getPublicJson, publicDetail, records, text } from '@/lib/server/public/content'

import type { PageServerLoad } from './$types'

export const load = (async (event) => {
  const detail = await publicDetail(
    event,
    `/api/content/audio/mix/${encodeURIComponent(event.params.mixId)}`,
  )

  const showId = detail.item ? text(detail.item.showId) : ''

  const actionActive = detail.item
    ? loadPublicActionState(event, 'audio', text(detail.item.id))
    : Promise.resolve(false)

  const shows = showId
    ? getPublicJson(event, '/api/shows?limit=100&offset=0')
    : Promise.resolve(null)

  const [active, showResult] = await Promise.all([actionActive, shows])

  const relatedShow = showResult?.ok
    ? (records(showResult.value).find((show) => text(show.id) === showId) ?? null)
    : null

  return { ...detail, relatedShow, actionActive: active }
}) satisfies PageServerLoad
