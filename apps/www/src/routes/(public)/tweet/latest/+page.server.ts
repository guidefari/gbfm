import { getPublicJson, records, text } from '@/lib/server/public/content'
import { redirect } from '@sveltejs/kit'
import type { PageServerLoad } from './$types'
export const load: PageServerLoad = async (event) => {
  const result = await getPublicJson(event, '/api/content/posts/micro?limit=1&offset=0')
  const slug = result.ok ? text(records(result.value)[0]?.slug) : ''
  redirect(307, slug ? `/tweet/${slug}` : '/tweets')
}
