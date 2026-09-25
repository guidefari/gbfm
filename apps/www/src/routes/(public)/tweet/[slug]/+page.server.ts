import { getPublicJson, publicDetail, records } from '@/lib/server/public/content'
import type { PageServerLoad } from './$types'
export const load = (async (event) => {
  const detail = await publicDetail(
    event,
    `/api/content/posts/micro/${encodeURIComponent(event.params.slug)}`
  )
  const replies = await getPublicJson(
    event,
    `/api/content/posts/micro/${encodeURIComponent(event.params.slug)}/replies`
  )
  return { ...detail, replies: replies.ok ? records(replies.value) : [] }
}) satisfies PageServerLoad
