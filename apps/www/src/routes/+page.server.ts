import { publicList } from '@/lib/server/public/content'

import type { PageServerLoad } from './$types'

export const load = ((event) =>
  publicList(event, '/api/content/audio/mix?limit=1&offset=0')) satisfies PageServerLoad
