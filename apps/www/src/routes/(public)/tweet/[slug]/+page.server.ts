import { getPublicJson, publicDetail, record, records, text } from '@/lib/server/public/content'
import type { PageServerLoad } from './$types'
export const load = (async (event) => {
  const detail = await publicDetail(
    event,
    `/api/content/posts/micro/${encodeURIComponent(event.params.slug)}`
  )
  const slug = encodeURIComponent(event.params.slug)
  const [replies, thread] = await Promise.all([
    getPublicJson(event, `/api/content/posts/micro/${slug}/replies?limit=100&offset=0`),
    getPublicJson(event, `/api/content/posts/micro/${slug}/thread?limit=100&offset=0`)
  ])
  const threadValue = thread.ok ? record(thread.value) : null
  const quoteId = text(detail.item?.quotedPostId)
  const quote = quoteId
    ? await getPublicJson(event, `/api/content/posts/micro/by-id/${encodeURIComponent(quoteId)}`)
    : null
  return {
    ...detail,
    replies: replies.ok ? records(replies.value) : [],
    thread: threadValue ? records(threadValue.posts) : [],
    parent: threadValue ? record(threadValue.root) : null,
    quote: quote?.ok ? record(quote.value) : null
  }
}) satisfies PageServerLoad
