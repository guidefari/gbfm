import { publicList } from '@/lib/server/public/content'

import type { PageServerLoad } from './$types'

export const load = ((event) => {
  const tag = event.url.searchParams.get('tag')

  return publicList(
    event,
    `/api/content/posts/editorials?limit=40&offset=0${tag ? `&tag=${encodeURIComponent(tag)}` : ''}`,
  )
}) satisfies PageServerLoad
