import { getPublicJson, record, records } from '@/lib/server/public/content'
import type { PageServerLoad } from './$types'
export const load = (async (event) => {
  const slug = encodeURIComponent(event.params.slug)
  const screen = await getPublicJson(event, `/api/content/posts/micro/${slug}/screen`)
  if (!screen.ok) {
    return {
      item: null,
      failure: screen.message,
      replies: [],
      parent: null,
      quote: null
    }
  }
  const value = record(screen.value)
  if (!value) {
    return {
      item: null,
      failure: 'Content is unavailable right now.',
      replies: [],
      parent: null,
      quote: null
    }
  }
  return {
    item: record(value.post),
    failure: null,
    replies: records(value.replies),
    parent: record(value.root),
    quote: record(value.quote)
  }
}) satisfies PageServerLoad
