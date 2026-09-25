import { publicDetail } from '@/lib/server/public/content'
import type { PageServerLoad } from './$types'
export const load = ((event) =>
  publicDetail(
    event,
    `/api/content/audio/mix/${encodeURIComponent(event.params.mixId)}`
  )) satisfies PageServerLoad
