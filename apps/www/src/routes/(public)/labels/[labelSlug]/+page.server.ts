import { publicDetail } from '@/lib/server/public/content'
import type { PageServerLoad } from './$types'
export const load = ((event) =>
  publicDetail(
    event,
    `/api/music/labels/slug/${encodeURIComponent(event.params.labelSlug)}`
  )) satisfies PageServerLoad
