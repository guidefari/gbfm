import { publicDetail } from '@/lib/server/public/content'

import type { PageServerLoad } from './$types'

export const load = ((event) =>
  publicDetail(
    event,
    `/api/content/releases/${encodeURIComponent(event.params.slug)}`,
  )) satisfies PageServerLoad
