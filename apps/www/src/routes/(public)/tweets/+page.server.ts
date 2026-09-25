import { publicList } from '@/lib/server/public/content'
import type { PageServerLoad } from './$types'

export const load = ((event) =>
  publicList(event, '/api/content/posts/micro?limit=24&offset=0')) satisfies PageServerLoad
