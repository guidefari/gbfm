import { getPublicJson, strings } from '@/lib/server/public/content'
import type { PageServerLoad } from './$types'
export const load = (async (event) => {
  const result = await getPublicJson(event, '/api/content/posts/tags')
  return result.ok
    ? { tags: strings(result.value), failure: null }
    : { tags: [], failure: result.message }
}) satisfies PageServerLoad
