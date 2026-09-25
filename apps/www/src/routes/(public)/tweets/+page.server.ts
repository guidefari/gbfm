import { getPublicJson, records, text } from '@/lib/server/public/content'
import { redirect } from '@sveltejs/kit'
import type { PageServerLoad } from './$types'

export const load = (async (event) => {
  const query = event.url.searchParams.get('q')?.trim()
  const result = await getPublicJson(
    event,
    query
      ? `/api/content/posts/micro/search?q=${encodeURIComponent(query)}&limit=24&offset=0`
      : '/api/content/posts/micro?limit=1&offset=0'
  )
  if (!result.ok) return { items: [], failure: result.message, query: query ?? '' }
  const items = records(result.value)
  if (!query) {
    const slug = text(items[0]?.slug)
    if (slug) redirect(307, `/tweet/${slug}`)
  }
  return { items, failure: null, query }
}) satisfies PageServerLoad
