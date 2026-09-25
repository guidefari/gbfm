import { publicList } from '@/lib/server/public/content'
import type { PageServerLoad } from './$types'
export const load = ((event) =>
  publicList(event, '/api/shows?limit=100&offset=0')) satisfies PageServerLoad
