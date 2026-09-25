import { publicDetail, text } from '@/lib/server/public/content'
import { loadPublicActionState } from '@/lib/server/public/action-state'
import type { PageServerLoad } from './$types'
export const load = (async (event) => {
  const detail = await publicDetail(
    event,
    `/api/content/audio/track/${encodeURIComponent(event.params.trackId)}`
  )
  const actionActive = detail.item
    ? await loadPublicActionState(event, 'audio', text(detail.item.id))
    : false
  return { ...detail, actionActive }
}) satisfies PageServerLoad
