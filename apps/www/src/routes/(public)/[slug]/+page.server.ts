import { redirect } from '@sveltejs/kit'

import { getPublicJson, record, text } from '@/lib/server/public/content'

import type { PageServerLoad } from './$types'

export const load = (async (event) => {
  const result = await getPublicJson(event, `/api/resolve/${encodeURIComponent(event.params.slug)}`)

  if (!result.ok) return { item: null, failure: result.message }
  const resolved = record(result.value)
  const item = record(resolved?.data)
  const showSlug = text(item?.slug)

  if (resolved?.type === 'show' && showSlug) redirect(307, `/shows/${showSlug}`)

  return { item, failure: item ? null : 'This page could not be found.' }
}) satisfies PageServerLoad
