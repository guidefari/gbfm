import { publicList } from '@/lib/server/public/content'
import type { PageServerLoad } from './$types'
export const load = ((event) => publicList(event, '/api/user/djs')) satisfies PageServerLoad
