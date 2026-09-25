import { publicDetail } from '@/lib/server/public/content'
import type { PageServerLoad } from './$types'
export const load = ((event) =>
  publicDetail(
    event,
    `/api/profile/${encodeURIComponent(event.params.username)}`
  )) satisfies PageServerLoad
